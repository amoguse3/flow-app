import type { AuraAPI, ChatTokenEvent, CourseFeedbackContext, CourseFeedbackSubmission, CourseGenerationEvent, CourseGenerationRequest, GameChallengeSeed, GameDifficulty, GameResult, GameType, MemoryKind, UserProfile, VoiceSettings } from '../../../shared/types'
import { createBrowserAura } from './browser-aura'

type AuraEventPayload = ChatTokenEvent | CourseGenerationEvent | string

const CLIENT_ID_STORAGE_KEY = 'aura_web_client_id'

function shouldUseHostedBrowserFallback(): boolean {
  const hostname = window.location.hostname
  const port = window.location.port
  const isKnownLocalBridge = (hostname === '127.0.0.1' || hostname === 'localhost') && port === '4315'
  return !isKnownLocalBridge
}

function getClientId(): string {
  const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY)
  if (existing) return existing

  const next = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `aura-${Date.now()}-${Math.random().toString(16).slice(2)}`

  window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, next)
  return next
}

function installWebAuraBridge(): void {
  if (typeof window === 'undefined' || window.aura) return

  window.__AURA_RUNTIME__ = 'web'
  document.documentElement.dataset.auraRuntime = 'web'

  if (shouldUseHostedBrowserFallback()) {
    document.documentElement.dataset.auraBackend = 'browser-fallback'
    window.aura = createBrowserAura()
    return
  }

  const clientId = getClientId()
  const listeners = new Map<string, Set<(payload: AuraEventPayload) => void>>()
  const dispatchers = new Map<string, (event: MessageEvent<string>) => void>()
  let eventSource: EventSource | null = null

  function ensureEventSource(): EventSource {
    if (eventSource) return eventSource

    const url = new URL('/api/events', window.location.origin)
    url.searchParams.set('clientId', clientId)
    eventSource = new EventSource(url)
    eventSource.onerror = () => {
      // Native EventSource reconnect is enough here.
    }
    return eventSource
  }

  function subscribe(channel: string, callback: (payload: AuraEventPayload) => void): () => void {
    const source = ensureEventSource()
    let channelListeners = listeners.get(channel)
    if (!channelListeners) {
      channelListeners = new Set()
      listeners.set(channel, channelListeners)
    }

    if (!dispatchers.has(channel)) {
      const dispatcher = (event: MessageEvent<string>) => {
        let payload: AuraEventPayload = event.data
        try {
          payload = JSON.parse(event.data) as AuraEventPayload
        } catch {
          payload = event.data
        }

        const active = listeners.get(channel)
        if (!active) return
        for (const listener of active) {
          listener(payload)
        }
      }

      dispatchers.set(channel, dispatcher)
      source.addEventListener(channel, dispatcher as EventListener)
    }

    channelListeners.add(callback)

    return () => {
      const active = listeners.get(channel)
      if (!active) return
      active.delete(callback)
      if (active.size === 0) {
        const dispatcher = dispatchers.get(channel)
        if (dispatcher && eventSource) {
          eventSource.removeEventListener(channel, dispatcher as EventListener)
        }
        dispatchers.delete(channel)
        listeners.delete(channel)
      }
    }
  }

  async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    const response = await fetch('/api/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, args, clientId }),
    })

    if (!response.ok) {
      let message = `Request failed: ${response.status}`
      try {
        const errorBody = await response.json() as { error?: string }
        if (errorBody?.error) {
          message = errorBody.error
        }
      } catch {
        // Ignore parse failures and use the fallback message.
      }
      throw new Error(message)
    }

    if (response.status === 204) {
      return undefined as T
    }

    const payload = await response.json() as { value: T }
    return payload.value
  }

  const aura: AuraAPI = {
    chat: {
      send: (message: string) => invoke<void>('chat:send', message),
      onToken: (callback: (data: ChatTokenEvent) => void) => subscribe('chat:token', (payload) => callback(payload as ChatTokenEvent)),
      getHistory: () => invoke('chat:history'),
      clearHistory: () => invoke<void>('chat:clear'),
    },
    tasks: {
      list: () => invoke('tasks:list'),
      add: (text, priority, parentId) => invoke('tasks:add', text, priority, parentId),
      toggle: (id) => invoke<void>('tasks:toggle', id),
      remove: (id) => invoke<void>('tasks:remove', id),
    },
    ai: {
      status: () => invoke('ai:status'),
    },
    claude: {
      setKey: (key: string) => invoke('claude:setKey', key),
      getKey: () => invoke('claude:getKey'),
    },
    groq: {
      setKey: (key: string) => invoke('groq:setKey', key),
      getKey: () => invoke('groq:getKey'),
    },
    motivation: {
      getState: () => invoke('motivation:getState'),
      addXP: (amount: number) => invoke('motivation:addXP', amount),
      awardLessonCompletion: (lessonId: number) => invoke('motivation:awardLessonCompletion', lessonId),
      updateStreak: () => invoke('motivation:updateStreak'),
      addMinutes: (minutes: number) => invoke('motivation:addMinutes', minutes),
      acknowledgeWelcomeBack: () => invoke('motivation:acknowledgeWelcomeBack'),
    },
    energy: {
      log: (level: number) => invoke<void>('energy:log', level),
      getToday: () => invoke('energy:getToday'),
    },
    profile: {
      get: () => invoke('profile:get'),
      save: (profile: UserProfile) => invoke<void>('profile:save', profile),
      resetAll: () => invoke('profile:resetAll'),
    },
    limits: {
      getState: () => invoke('limits:getState'),
    },
    educator: {
      getCourses: () => invoke('educator:getCourses'),
      getCourse: (id) => invoke('educator:getCourse', id),
      getDueFlashcards: () => invoke('educator:getDueFlashcards'),
      getCourseFeedback: (courseId: number) => invoke('educator:getCourseFeedback', courseId),
      getCourseFeedbackAnalytics: () => invoke('educator:getCourseFeedbackAnalytics'),
      startCourseIntake: (request: string | CourseGenerationRequest) => invoke('educator:startCourseIntake', request),
      continueCourseIntake: (sessionId: number, request: string | CourseGenerationRequest) => invoke('educator:continueCourseIntake', sessionId, request),
      prepareLesson: (lessonId) => invoke('educator:prepareLesson', lessonId),
      resetLessonRecall: (lessonId) => invoke('educator:resetLessonRecall', lessonId),
      generateCourse: (request: string | CourseGenerationRequest) => invoke('educator:generateCourse', request),
      retryCourseGeneration: (courseId) => invoke('educator:retryCourseGeneration', courseId),
      submitCourseFeedback: (courseId: number, feedback: CourseFeedbackSubmission, context?: CourseFeedbackContext | null) => invoke('educator:submitCourseFeedback', courseId, feedback, context),
      refineCourseRecommendation: (courseId: number, context?: CourseFeedbackContext | null) => invoke('educator:refineCourseRecommendation', courseId, context),
      onCourseGenToken: (callback: (data: CourseGenerationEvent) => void) => subscribe('educator:courseGenToken', (payload) => callback(payload as CourseGenerationEvent)),
      explainLesson: (lessonId) => invoke<void>('educator:explainLesson', lessonId),
      onLessonToken: (callback: (data: ChatTokenEvent) => void) => subscribe('educator:lessonToken', (payload) => callback(payload as ChatTokenEvent)),
      clarifyLesson: (lessonId, question, understandingScore) => invoke<void>('educator:clarifyLesson', lessonId, question, understandingScore),
      onClarifyToken: (callback: (data: ChatTokenEvent) => void) => subscribe('educator:clarifyToken', (payload) => callback(payload as ChatTokenEvent)),
      getModules: (courseId) => invoke('educator:getModules', courseId),
      getLessons: (moduleId) => invoke('educator:getLessons', moduleId),
      completeLesson: (lessonId) => invoke<void>('educator:completeLesson', lessonId),
      completeModule: (moduleId) => invoke<void>('educator:completeModule', moduleId),
      deleteCourse: (courseId) => invoke<void>('educator:deleteCourse', courseId),
      generateLessonQuiz: (lessonId) => invoke('educator:generateLessonQuiz', lessonId),
      generateLessonPractice: (lessonId) => invoke('educator:generateLessonPractice', lessonId),
      generateTeacherCheckpoint: (lessonId, focus) => invoke('educator:generateTeacherCheckpoint', lessonId, focus),
      generateModuleCheckpoint: (moduleId) => invoke('educator:generateModuleCheckpoint', moduleId),
      saveTeacherCheckpointFlashcards: (lessonId, flashcards) => invoke('educator:saveTeacherCheckpointFlashcards', lessonId, flashcards),
      reviewFlashcard: (id, quality) => invoke('educator:reviewFlashcard', id, quality),
    },
    voice: {
      getSettings: () => invoke<VoiceSettings>('voice:getSettings'),
      saveSettings: (settings) => invoke<void>('voice:saveSettings', settings),
    },
    games: {
      startChallenge: (gameType: GameType, difficulty?: GameDifficulty, seed?: GameChallengeSeed | null) => invoke('games:startChallenge', gameType, difficulty, seed),
      submitResult: (result: GameResult) => invoke('games:submitResult', result),
      getDailyScores: () => invoke('games:getDailyScores'),
      getLeaderboard: (days?: number) => invoke('games:getLeaderboard', days),
      getPoints: () => invoke('games:getPoints'),
      redeemProDay: () => invoke('games:redeemProDay'),
    },
    sync: {
      getState: () => invoke('sync:getState'),
      link: (code: string) => invoke('sync:link', code),
      unlink: () => invoke<void>('sync:unlink'),
      syncNow: () => invoke('sync:syncNow'),
    },
    window: {
      minimize: () => undefined,
      close: () => undefined,
      toggleVisibility: () => undefined,
    },
    overlay: {
      setEnabled: async () => undefined,
      setSize: async () => undefined,
      onMessage: (callback: (msg: string) => void) => subscribe('overlay:chatMessage', (payload) => callback(String(payload))),
    },
    memory: {
      list: (kind?: MemoryKind) => invoke('memory:list', kind),
      add: (content, kind, tag, importance) => invoke('memory:add', content, kind, tag, importance),
      remove: (id) => invoke('memory:delete', id),
      pickCallback: () => invoke('memory:pickCallback'),
      decay: () => invoke('memory:decay'),
      semantic: () => invoke('memory:semantic'),
    },
  }

  window.aura = aura
}

installWebAuraBridge()