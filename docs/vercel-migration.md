# Vercel migration plan

## Current blocker summary

This project is not deployable to Vercel as-is because the current browser mode still depends on an Electron-owned backend:

- `src/renderer/src/web-bridge.ts` talks to `POST /api/invoke` and `GET /api/events`.
- `src/main/web-local.ts` implements those endpoints inside Electron using `ipcMain` and an in-memory invoke handler map.
- `src/main/db.ts` persists state into a local `sql.js` file at `app.getPath('userData')/aura.db`.
- Long-running features depend on local process state, intervals, and local event emitters.

Vercel does not provide a persistent local Electron process, durable local filesystem, or stable in-memory IPC state across requests.

## Good news

The renderer already depends on the shared `AuraAPI` contract from `shared/types.ts`, so the UI does not need a full rewrite.

These parts are already reusable for a server backend:

- `shared/types.ts`
- `shared/constants.ts`
- `src/main/services/motivation-service.ts`
- `src/main/services/tier-limit-service.ts`

That means the migration is mostly a backend extraction problem, not a renderer redesign.

## Required architecture change

### Current flow

Renderer -> `window.aura` -> preload/web bridge -> Electron IPC -> local DB / local timers / local AI calls

### Target flow for Vercel

Renderer -> web client SDK -> Vercel API routes -> real database + server-side AI providers + background jobs

## What must move out of Electron

### 1. Persistence layer

Replace `src/main/db.ts` with a real remote database adapter.

Recommended target:

- Neon Postgres + Drizzle or Prisma
- or Supabase Postgres if you want auth and storage in one stack

Why:

- `sql.js` + `app.getPath('userData')` is local-desktop storage only
- Vercel filesystem is ephemeral
- current data is effectively single-user local state

Minimum tables to migrate first:

- `user_state`
- `messages`
- `tasks`
- `energy_log`
- `courses`
- `course_generation_jobs`
- `course_intake_sessions`
- `course_intake_answers`
- `modules`
- `lessons`
- `lesson_ai_cache`
- `flashcards`
- `course_feedback`
- `memories`
- `game_scores`
- `game_points`

Important schema change:

Every user-owned table needs a `user_id` because the desktop app currently assumes one local user.

### 2. Authentication

There is no real web auth boundary right now.

For Vercel you need one of:

- Clerk
- NextAuth/Auth.js
- Supabase Auth

Without auth, all Vercel API routes would operate on shared global state, which is incorrect.

### 3. AI provider access

Current desktop flow stores provider keys in app state and exposes setters/getters through `claude:setKey`, `claude:getKey`, `groq:setKey`, `groq:getKey`.

That is acceptable for local desktop, but not for a hosted web app.

For Vercel you should choose one model:

- Server-managed keys only: best default
- BYOK with encrypted-at-rest user secrets: more work

Recommended first migration:

- remove browser access to `getKey`
- keep provider credentials only in server env vars
- keep `AIError.tsx` as status/error UI, not a raw secret input for production web

### 4. Streaming model

Current streaming channels:

- `chat:token`
- `educator:courseGenToken`
- `educator:lessonToken`
- `educator:clarifyToken`

Current implementation uses local event emitters plus `GET /api/events` SSE.

For Vercel, split these cases:

- Chat / explain / clarify: use direct streamed HTTP responses per request
- Course generation: do not keep the whole generation inside one long serverless request

Recommended design:

- `POST /api/chat/stream`
- `POST /api/educator/lessons/:lessonId/explain/stream`
- `POST /api/educator/lessons/:lessonId/clarify/stream`
- `POST /api/educator/courses/generate` returns `jobId`
- `GET /api/educator/jobs/:jobId` for polling status

For async course generation, use a background job system:

- Inngest
- Trigger.dev
- Upstash QStash
- or a separate worker service

This is the hardest backend migration point. `educator:generateCourse` and `retryCourseGeneration` should become job producers, not long-running request handlers.

## API migration strategy

There are two possible paths.

### Path A. Keep the current RPC contract first

Implement a server-side replacement for the current `channel + args` contract used by `web-bridge.ts`.

Pros:

- smallest renderer diff
- fastest first deployment

Cons:

- harder to evolve
- not idiomatic web API design
- awkward for auth, validation, and streamed operations

### Path B. Replace RPC with explicit endpoints

This is the cleaner long-term shape.

Suggested route groups:

- `/api/chat/*`
- `/api/tasks/*`
- `/api/profile/*`
- `/api/motivation/*`
- `/api/energy/*`
- `/api/limits/*`
- `/api/educator/*`
- `/api/games/*`
- `/api/memory/*`
- `/api/sync/*`

Recommendation:

Use a hybrid migration.

- Step 1: keep RPC for non-streaming low-risk routes
- Step 2: break streaming and educator generation into explicit endpoints first
- Step 3: gradually replace the rest of RPC with explicit REST-style routes

## Renderer changes required

### Keep

These can largely stay:

- most components under `src/renderer/src/components`
- contexts
- `shared/types.ts` contracts
- `web` runtime branch in `App.tsx`

### Change

#### `src/renderer/src/web-bridge.ts`

This file becomes the main migration seam.

Change it to:

- call real hosted API routes
- include auth credentials/cookies
- stop relying on local `clientId` event multiplexing for long-lived backend state
- replace SSE multiplexing with direct streamed request handlers or job polling

#### `src/renderer/src/App.tsx`

Keep the web runtime branch, but make these behaviors explicit no-ops in hosted web:

- `window.minimize`
- `window.close`
- overlay message handling

#### `src/renderer/src/components/Settings.tsx`

Overlay controls should be hidden or disabled on hosted web.

#### `src/renderer/src/components/AIError.tsx`

Replace provider-key input UX with either:

- generic AI unavailable messaging
- admin-only key management
- or BYOK encrypted settings flow

#### `src/renderer/src/hooks/useVoice.ts`

Voice settings can remain client-side if they only configure browser Web Speech behavior. If server persistence is desired, save them via profile/settings API.

## Desktop-only modules to exclude from the web deploy

These should not be part of the Vercel runtime target:

- `src/main/index.ts`
- `src/main/window.ts`
- `src/main/overlay.ts`
- `src/main/hotkey.ts`
- `src/main/tray.ts`
- `src/main/updater.ts`
- Electron preload files when building the hosted web app

Web equivalents:

- tray: none
- global hotkey: none or browser shortcut help text only
- overlay window: none
- app updater: handled by deploy pipeline, not `electron-updater`
- native window controls: remove or no-op

## Feature-by-feature backend readiness

### Easy first movers

- profile
- tasks
- motivation
- energy log
- tier limits
- memory CRUD
- voice settings

### Medium complexity

- chat history
- flashcard review
- games leaderboard and points
- sync state

### Hard

- educator generation
- streamed lesson explain/clarify
- async course generation progress
- AI caching and retry flows

## Concrete file move plan

### Phase 1. Create a web backend package

Create a new backend area, for example:

- `src/server/db/*`
- `src/server/domain/*`
- `src/server/routes/*`
- `src/server/auth/*`

Move pure business logic from Electron entry files into `src/server/domain`.

Start with:

- motivation logic
- tier-limit logic
- task/profile/energy state handlers

### Phase 2. Replace `db.ts` with repository interfaces

Create repository interfaces for:

- messages
- tasks
- profile state
- motivation state
- courses/modules/lessons
- flashcards
- memories
- game scores

Then implement them for Postgres.

### Phase 3. Split `ipc-handlers.ts`

`src/main/ipc-handlers.ts` currently mixes transport, business logic, AI routing, and persistence.

Split it into:

- chat service
- task service
- profile service
- motivation service adapter
- limits service adapter

Then the Vercel routes call those services directly.

### Phase 4. Split `educator-ipc.ts`

This file should become:

- educator service
- educator repositories
- educator job runner
- educator API routes

Do not migrate it as a single file. It is already the largest risk surface.

### Phase 5. Replace web-local transport

Retire `src/main/web-local.ts` once the renderer talks directly to hosted routes.

## Recommended first deploy slice

If the goal is to get something running on Vercel fast, do not start with full educator generation.

Ship in this order:

1. hosted renderer
2. auth
3. profile + tasks + motivation + energy + tier limits
4. chat streaming
5. courses read-only
6. lesson read-only
7. educator generation jobs
8. flashcards / games / sync refinement

That order gets you a usable hosted app much earlier.

## Minimal realistic first implementation

If starting today, the smallest sensible Vercel-first slice is:

- Next.js frontend for hosting the renderer
- Vercel Route Handlers for non-streaming APIs
- Neon Postgres for persistence
- Inngest or Trigger.dev for async course generation
- server-side env vars for AI keys
- keep desktop app alive separately until educator migration is complete

## What should not be done

- Do not try to deploy `src/main/web-local.ts` unchanged as a Vercel function.
- Do not keep local `sql.js` file persistence for hosted users.
- Do not expose provider secret getters in a public web app.
- Do not run long course-generation pipelines inside a single serverless request and hope it scales.

## Best next engineering step

The best first coding slice is:

1. create a real web backend scaffold
2. move profile/tasks/motivation/energy/limits to it
3. point `web-bridge.ts` to those routes
4. leave educator generation on desktop until the job system exists

That is the shortest path to a real Vercel deployment without pretending Electron local mode is already a cloud backend.