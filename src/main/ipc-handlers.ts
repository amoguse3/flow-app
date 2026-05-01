import { ipcMain, BrowserWindow } from 'electron'
import {
  addMessage, getMessages, clearMessages,
  getState, setState, resetUserData,
  getTasks, addTask, toggleTask, removeTask,
  logEnergy, getTodayEnergy,
  getCourses, getDB, getLesson, completeLesson as dbCompleteLesson, getCompletedLessonsCount,
  getModules, getLessons, getAllDueFlashcards,
  getSemanticFacts, pickCallbackMemory, markMemoryRecalled, addMemory,
} from './db'
import { streamClaudeChat, checkClaudeHealth, setClaudeApiKey, getClaudeApiKey, CLAUDE_CHAT_DEEP_MODEL, CLAUDE_CHAT_MODEL } from './claude'
import { addTotalTokens, getTokenStats, getMachineId } from './telemetry'
import { setGroqApiKey, getGroqApiKey, checkGroqHealth } from './groq'
import { buildSystemPrompt } from './personality'
import type { LessonReward, MotivationState, UserProfile } from '../../shared/types'
import { LEVELS, LESSON_MILESTONE_SIZE, LESSON_REWARD_BONUS_XP, LESSON_REWARD_NORMAL_XP, LESSON_REWARD_TOTAL_XP } from '../../shared/constants'
import { buildTierLimitSnapshot, evaluateChatBudget, evaluateCourseCreation, normalizeTierMode, recordAIUsage, recordChatMessage } from './tier-limits'
import {
  acknowledgeWelcomeBack as acknowledgeWelcomeBackState,
  addMinutes as addMotivationMinutes,
  addXp as addMotivationXp,
  defaultMotivation as createDefaultMotivation,
  hydrateMotivationProgress as hydrateStoredMotivationProgress,
  normalizeMotivation as normalizeStoredMotivation,
  recordWordsTyped as recordMotivationWordsTyped,
  rewardChatReply as rewardMotivationChatReply,
  updateStreak as updateMotivationStreak,
  awardLessonCompletion as awardMotivationLessonCompletion,
  type MotivationLessonDeps,
  type MotivationProgressDeps,
  type MotivationStreakDeps,
} from './services/motivation-service'

const HIDDEN_TEACHER_INSTRUCTION_PATTERN = /^\[\s*(?:instrucțiune|instructiune)\s+profesoral(?:ă|a)/i
const CHAT_ACTION_PATTERN = /\[\[AURA_ACTION:[A-Z_]+(?::#?\d+)?\]\]/g
const SIMPLE_CHAT_COMPLEXITY_PATTERN = /```|\n|\b(debug|bug|refactor|architecture|arhitectur|design|compare|analiz|analysis|eseu|essay|proof|derive|strategie|strategy|de ce|why|implement|code|cod|math|matemat|review)\b/i
const PRODUCT_CONTEXT_PATTERN = /\b(curs|course|lec(ț|t)ie|lesson|task|flashcard|teacher|profesor|oglind|mirror|progres|continue|continu|resume|unde am rămas|where did i stop|summary|rezumat)\b/i

function isHiddenTeacherInstruction(text: string): boolean {
  return HIDDEN_TEACHER_INSTRUCTION_PATTERN.test((text || '').trim())
}

function getLevel(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return i + 1
  }
  return 1
}

function normalizeProfile(profile: UserProfile | null): UserProfile | null {
  if (!profile) return null
  return {
    ...profile,
    ageGroup: profile.ageGroup || 'unknown',
    tierMode: normalizeTierMode(profile.tierMode),
  }
}

function flattenForPrompt(text: string, max = 220): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function stripChatActionTokens(text: string): string {
  return String(text || '')
    .replace(CHAT_ACTION_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildChatCourseContext(profile: UserProfile | null, message: string) {
  const lowerMsg = message.toLowerCase()
  const declineKeywords = /nu vreau|nu acum|altădată|lasă|nu mai|stop|destul|gata cu/i
  const declined = declineKeywords.test(lowerMsg)
  const createDecision = evaluateCourseCreation(profile)
  const dueFlashcardsCount = getAllDueFlashcards().length
  const courses = getCourses()

  const activeCourseSummaries: string[] = []
  const completedCourseSummaries: string[] = []
  const activeCourseNames: string[] = []

  for (const course of courses) {
    const modules = getModules(Number(course.id))
    let totalLessons = 0
    let completedLessons = 0
    let nextLessonTitle: string | null = null
    let nextLessonLabel: string | null = null
    let lessonCursor = 0

    for (const module of modules) {
      const lessons = getLessons(Number(module.id))
      totalLessons += lessons.length
      completedLessons += lessons.filter((lesson: any) => Boolean(lesson.completed)).length

      for (const lesson of lessons) {
        lessonCursor += 1
        if (!nextLessonTitle && Boolean(module.unlocked) && !lesson.completed) {
          nextLessonTitle = lesson.title
          nextLessonLabel = `lesson ${lessonCursor}: ${lesson.title}`
        }
      }
    }

    const courseStatusLabel = course.status === 'completed'
      ? 'completed'
      : course.status === 'generating'
        ? 'generating'
        : course.status === 'failed'
          ? 'failed'
          : 'in progress'

    const summary = `[#${course.id}] ${course.title} — ${courseStatusLabel} — modules ${course.completed_modules}/${course.total_modules}${totalLessons > 0 ? `, lessons ${completedLessons}/${totalLessons}` : ''}${nextLessonLabel ? `, next ${nextLessonLabel}` : nextLessonTitle ? `, next: ${nextLessonTitle}` : ''}`

    if (course.status === 'completed') {
      completedCourseSummaries.push(summary)
    } else {
      activeCourseSummaries.push(summary)
      activeCourseNames.push(course.title)
    }
  }

  return {
    activeCourseNames,
    activeCourseSummaries: activeCourseSummaries.slice(0, 6),
    completedCourseSummaries: completedCourseSummaries.slice(0, 5),
    canOpenCourseCreator: createDecision.allowed,
    creatorBlockedReason: createDecision.allowed ? null : flattenForPrompt(createDecision.message || ''),
    dueFlashcardsCount,
    declined,
  }
}

function buildChatTaskContext() {
  const allTasks = getTasks()
  const parentTasks = allTasks.filter((task: any) => !task.parent_id)
  const pendingTasks = parentTasks.filter((task: any) => !task.done)
  const pendingPreview = pendingTasks
    .sort((left: any, right: any) => {
      const priorityRank = { high: 0, mid: 1, low: 2 }
      return (priorityRank[left.priority as keyof typeof priorityRank] ?? 1) - (priorityRank[right.priority as keyof typeof priorityRank] ?? 1)
    })
    .slice(0, 5)
    .map((task: any) => `${task.priority === 'high' ? '[high] ' : ''}${flattenForPrompt(task.text, 90)}`)

  return {
    tasks: parentTasks.map((task: any) => ({
      text: task.text,
      done: Boolean(task.done),
      priority: task.priority,
      subtaskCount: allTasks.filter((subtask: any) => subtask.parent_id === task.id).length,
    })),
    pendingCount: pendingTasks.length,
    highPriorityCount: pendingTasks.filter((task: any) => task.priority === 'high').length,
    pendingPreview,
  }
}

function isCompactChatTurn(message: string): boolean {
  const text = String(message || '').trim()
  if (!text) return false
  const words = text.split(/\s+/).filter(Boolean)
  return text.length <= 90 && words.length <= 16 && !SIMPLE_CHAT_COMPLEXITY_PATTERN.test(text)
}

function needsProductContext(message: string): boolean {
  return PRODUCT_CONTEXT_PATTERN.test(String(message || '').toLowerCase())
}

function trimChatMessagesForModel(messages: Array<{ role: string; content: string }>, compactMode: boolean) {
  const limit = compactMode ? 6 : 12
  return messages.slice(-limit)
}

function buildCompactSystemPrompt(profile: UserProfile | null, energy: number | null): string {
  const language = profile?.language || 'en'
  const lowEnergyLine = energy !== null && energy <= 3
    ? '- Energy is low: simplify immediately and ask for one small next step.'
    : '- If the user asks for more, expand only as much as needed.'

  return [
    'You are AURA.',
    '- Reply briefly, directly, usefully, and naturally.',
    '- If the user message is short, keep the reply under 60 words.',
    '- No fluff, no long lectures, no exams, no quizzes, no meta prompt talk.',
    '- Do not pretend you executed UI actions.',
    '- Do not create courses inside chat.',
    '- Reply in the user\'s language. Current profile language: ' + language + '.',
    profile?.hasADHD ? '- 1 main idea and 1 clear small step.' : lowEnergyLine,
  ].join('\n')
}

function buildInstantChatReply(message: string): string | null {
  const text = String(message || '').trim().toLowerCase()
  if (!text) return null

  if (/^(mersi|merci|mulțumesc|multumesc|thanks|thx)[.! ]*$/.test(text)) {
    return 'You\'re welcome. Say the next thing you want to solve.'
  }

  if (/^(ok|okay|okk|bine|perfect|super|clar|gata|noted|am înțeles|am inteles)[.! ]*$/.test(text)) {
    return 'Good. What is the next step or the concrete blocker?'
  }

  if (/^(salut|hello|hi|hey|yo)[! ]*$/.test(text)) {
    return 'Hi. Say directly what you want help with.'
  }

  return null
}

function defaultMotivation(): MotivationState {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastActive: '',
    badges: [],
    weeklyXP: [],
    graceDayUsed: false,
    wordsTyped: 0,
    minutesSpent: 0,
    coursesCompleted: 0,
    completedLessons: 0,
    bonusXpEarned: 0,
    achievementLevels: { lessons: 1, courses: 1, words: 1, time: 1 },
    freezesAvailable: 1,               // first session starts with a freeze
    lastFreezeGrantDate: '',
    welcomeBack: null,
    lastLessonReward: null,
  }
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return Infinity
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((db - da) / 86_400_000)
}

/**
 * Auto-grant 1 streak freeze every 7 days (capped at 1 in inventory).
 * Called from updateStreak before computing miss logic.
 */
function maybeGrantFreeze(mot: MotivationState, today: string): void {
  const daysSinceGrant = mot.lastFreezeGrantDate
    ? daysBetween(mot.lastFreezeGrantDate, today)
    : Infinity
  if (daysSinceGrant >= 7 && (mot.freezesAvailable ?? 0) < 1) {
    mot.freezesAvailable = 1
    mot.lastFreezeGrantDate = today
  }
}

function countWords(text: string): number {
  const matches = (text || '').trim().match(/[\p{L}\p{N}']+/gu)
  return matches ? matches.length : 0
}

function getTrackLevel(value: number, milestones: number[]): number {
  let level = 1
  for (const m of milestones) {
    if (value >= m) level += 1
  }
  return level
}

function normalizeMotivation(raw: MotivationState | null): MotivationState {
  const base = defaultMotivation()
  const mot = raw || base
  return {
    ...base,
    ...mot,
    achievementLevels: {
      ...base.achievementLevels,
      ...(mot.achievementLevels || {}),
    },
  }
}

function syncLevelAndXpBadges(mot: MotivationState): MotivationState {
  mot.level = getLevel(mot.xp)

  if (mot.level >= 3 && !mot.badges.includes('level_3')) mot.badges.push('level_3')
  if (mot.level >= 5 && !mot.badges.includes('level_5')) mot.badges.push('level_5')
  if (mot.xp >= 500 && !mot.badges.includes('xp_500')) mot.badges.push('xp_500')
  if (mot.xp >= 1000 && !mot.badges.includes('xp_1000')) mot.badges.push('xp_1000')

  return mot
}

function getLessonLevel(completedLessons: number): number {
  return Math.floor(Math.max(0, completedLessons) / LESSON_MILESTONE_SIZE) + 1
}

function buildLessonReward(lessonId: number, completedLessons: number): LessonReward {
  const milestoneReached = completedLessons > 0 && completedLessons % LESSON_MILESTONE_SIZE === 0
  const milestoneReachedAt = milestoneReached ? completedLessons : null
  const nextMilestoneAt = milestoneReached
    ? completedLessons + LESSON_MILESTONE_SIZE
    : Math.ceil(Math.max(1, completedLessons) / LESSON_MILESTONE_SIZE) * LESSON_MILESTONE_SIZE
  const lessonsUntilNextMilestone = Math.max(0, nextMilestoneAt - completedLessons)
  const milestoneLabel = milestoneReached
    ? `Milestone reached. Next one in ${LESSON_MILESTONE_SIZE} lessons.`
    : `${lessonsUntilNextMilestone} lessons until the next milestone.`
  const celebrationText = milestoneReached
    ? `Small win: you closed ${completedLessons} lessons. Keep the rhythm.`
    : `Another concept locked in. ${lessonsUntilNextMilestone} lessons until the next threshold.`

  return {
    lessonId,
    normalXp: LESSON_REWARD_NORMAL_XP,
    bonusXp: LESSON_REWARD_BONUS_XP,
    totalXp: LESSON_REWARD_TOTAL_XP,
    completedLessons,
    milestoneSize: LESSON_MILESTONE_SIZE,
    milestoneReached,
    milestoneReachedAt,
    nextMilestoneAt,
    lessonsUntilNextMilestone,
    milestoneLabel,
    celebrationText,
  }
}

function applyAchievementProgress(mot: MotivationState): MotivationState {
  const coursesCompleted = getCourses().filter((c: any) => c.status === 'completed').length
  const completedLessons = getCompletedLessonsCount()
  mot.coursesCompleted = coursesCompleted
  mot.completedLessons = completedLessons

  const wordMilestones = [200, 1000, 5000, 15000]

  mot.achievementLevels = {
    lessons: getLessonLevel(mot.completedLessons),
    courses: getTrackLevel(mot.coursesCompleted, [1, 3, 5, 10]),
    words: getTrackLevel(mot.wordsTyped, wordMilestones),
    time: getTrackLevel(mot.minutesSpent, [30, 120, 600, 1800]),
  }

  if (mot.coursesCompleted >= 1 && !mot.badges.includes('course_1')) mot.badges.push('course_1')
  if (mot.coursesCompleted >= 3 && !mot.badges.includes('course_3')) mot.badges.push('course_3')
  if (mot.coursesCompleted >= 5 && !mot.badges.includes('course_5')) mot.badges.push('course_5')
  if (mot.coursesCompleted >= 10 && !mot.badges.includes('course_10')) mot.badges.push('course_10')

  if (mot.wordsTyped >= 200 && !mot.badges.includes('words_200')) mot.badges.push('words_200')
  if (mot.wordsTyped >= 1000 && !mot.badges.includes('words_1000')) mot.badges.push('words_1000')
  if (mot.wordsTyped >= 5000 && !mot.badges.includes('words_5000')) mot.badges.push('words_5000')
  if (mot.wordsTyped >= 15000 && !mot.badges.includes('words_15000')) mot.badges.push('words_15000')

  if (mot.minutesSpent >= 30 && !mot.badges.includes('time_30')) mot.badges.push('time_30')
  if (mot.minutesSpent >= 120 && !mot.badges.includes('time_120')) mot.badges.push('time_120')
  if (mot.minutesSpent >= 600 && !mot.badges.includes('time_600')) mot.badges.push('time_600')
  if (mot.minutesSpent >= 1800 && !mot.badges.includes('time_1800')) mot.badges.push('time_1800')

  return mot
}

const motivationProgressDeps: MotivationProgressDeps = {
  getCoursesCompletedCount: () => getCourses().filter((course: any) => course.status === 'completed').length,
  getCompletedLessonsCount,
}

const motivationLessonDeps: MotivationLessonDeps = {
  ...motivationProgressDeps,
  getLessonById: (lessonId: number) => getLesson(lessonId),
  completeLesson: (lessonId: number) => dbCompleteLesson(lessonId),
}

const motivationStreakDeps: MotivationStreakDeps = {
  ...motivationProgressDeps,
  getToday: () => new Date().toISOString().split('T')[0],
}

export function registerIpcHandlers() {
  // --- Clean up old rate-limit spam, exam spam & stale token usage from DB ---
  try {
    getDB().run("DELETE FROM messages WHERE content LIKE '%Ai atins limita de conversa%'")
    getDB().run("DELETE FROM messages WHERE content LIKE '%EXAMEN ORAL%'")
    getDB().run("DELETE FROM messages WHERE content LIKE '%EXAMEN TRECUT%'")
    getDB().run("DELETE FROM messages WHERE content LIKE '%Întrebarea 1%' AND content LIKE '%Întrebarea 2%'")
    getDB().run("DELETE FROM messages WHERE content LIKE '[INSTRUCȚIUNE PROFESORALĂ%'")
    getDB().run("DELETE FROM messages WHERE content LIKE '[INSTRUCTIUNE PROFESORALA%'")
    setState('chatTokenUsage', { used: 0, resetAt: null })
  } catch (err) {
    console.error('[ipc] Failed to clean legacy chat rows.', err)
  }

  // --- Chat (DeepSeek chat/reasoner) ---
  ipcMain.handle('chat:send', async (event, message: string) => {

    addMessage('user', message)

    const motStart = recordMotivationWordsTyped(
      getState('motivation') as MotivationState | null,
      message,
      motivationProgressDeps,
    )
    setState('motivation', motStart)

    const history = getMessages(20).reverse()
    const examPattern = /EXAMEN\s*ORAL|═{3,}.*EXAMEN|Întrebarea\s+\d+\s*[/:]|Să vedem ce ai reținut|EXAMEN TRECUT/i
    const messages = history
      .filter(m => !examPattern.test(m.content) && !isHiddenTeacherInstruction(m.content))
      .map(m => ({ role: m.role, content: m.content }))

    const profile = normalizeProfile(getState('profile') as UserProfile | null)
    const compactChatMode = isCompactChatTurn(message)
    const modelMessages = trimChatMessagesForModel(messages, compactChatMode)
    const chatBudget = evaluateChatBudget(profile, message, modelMessages)
    if (!chatBudget.allowed) {
      const limitMessage = chatBudget.message || 'Your AI chat window is closed for now. Come back a little later.'
      event.sender.send('chat:token', { token: limitMessage, done: true })
      addMessage('assistant', limitMessage)
      return
    }

    const instantReply = buildInstantChatReply(message)

    if (instantReply) {
      recordChatMessage()
      event.sender.send('chat:token', { token: instantReply, done: true })
      addMessage('assistant', instantReply)

      const mot = rewardMotivationChatReply(getState('motivation') as MotivationState | null)
      setState('motivation', mot)
      return
    }
    const energy = getTodayEnergy()
    const motivation = normalizeStoredMotivation(getState('motivation') as MotivationState | null) || createDefaultMotivation()

    const includeProductContext = !compactChatMode || needsProductContext(message)
    const courseContext = includeProductContext ? buildChatCourseContext(profile, message) : undefined
    const taskContext = includeProductContext ? buildChatTaskContext() : undefined

    let systemPrompt = compactChatMode
      ? buildCompactSystemPrompt(profile, energy)
      : buildSystemPrompt(profile, energy, motivation, courseContext, taskContext, { lastUserMessage: message })

    // ─── Memory injection ─────────────────────────────────────────────────
    // Stable facts go in as-is. One old episodic memory is surfaced as a
    // natural callback opportunity ("remember when..."), picked at most
    // every other turn to avoid nagging.
    if (!compactChatMode) {
      try {
        const semantic = getSemanticFacts().slice(0, 6)
        const callback = Math.random() < 0.45 ? pickCallbackMemory() : null
        const memBlock: string[] = []
        if (semantic.length > 0) {
          memBlock.push('\n\nWHAT YOU KNOW ABOUT THEM (stable facts):')
          for (const m of semantic) memBlock.push(`- ${m.content}`)
        }
        if (callback) {
          memBlock.push(`\n\nOLDER MEMORY TO RECONNECT (use naturally, like "I remember that...", ONLY if it fits the conversation organically):\n"${callback.content}"`)
          markMemoryRecalled(callback.id)
        }
        if (memBlock.length > 0) {
          memBlock.push('\n\nDo not list these facts mechanically. Use them only when they connect naturally to what the user says.')
          systemPrompt += memBlock.join('\n')
        }
      } catch (err) {
        console.error('[ipc] Memory injection failed.', err)
        // memory injection is best-effort; never block chat
      }
    }

    // ─── Auto-extract episodic memories from user's message ───────────────
    // Simple heuristics: strong emotional keywords or explicit statements
    // ("vreau să...", "îmi place...", "mă stresează...") get saved.
    try {
      const msgLower = message.toLowerCase()
      const memoryPatterns: Array<{ re: RegExp; tag: string; importance: number }> = [
        { re: /\b(vreau|vrea|vreau\s+s[aă])\s+s[aă]\s+(.{8,80})/i, tag: 'goal', importance: 4 },
        { re: /\b(îmi\s+place|iubesc|ador)\s+(.{4,60})/i, tag: 'preference', importance: 3 },
        { re: /\b(m[aă]\s+stresea[zș][aă]|m[aă]\s+enervea[zș][aă]|ur[aă]sc)\s+(.{4,60})/i, tag: 'struggle', importance: 4 },
        { re: /\b(am\s+reu[sș]it|am\s+terminat|am\s+finalizat)\s+(.{4,60})/i, tag: 'win', importance: 4 },
      ]
      for (const p of memoryPatterns) {
        const m = message.match(p.re)
        if (m) {
          const content = message.slice(m.index || 0, (m.index || 0) + m[0].length).trim()
          if (content.length >= 8) {
            addMemory(content, 'episodic', p.tag, p.importance)
          }
        }
      }
      // also detect "I am X" / "sunt X" for semantic facts
      const selfDescribe = msgLower.match(/\b(sunt)\s+(student|profesor|programator|dezvoltator|designer|freelancer|manager|antreprenor|elev|student[aă])/i)
      if (selfDescribe) {
        addMemory(`Este ${selfDescribe[2]}`, 'semantic', 'fact', 5)
      }
    } catch (err) {
      console.error('[ipc] Episodic memory extraction failed.', err)
      // ignore extraction failures
    }

    let fullResponse = ''
    let sentLength = 0
    const maxReplyTokens = compactChatMode ? 220 : message.length > 360 ? 900 : 640

    try {
      recordChatMessage()

      for await (const chunk of streamClaudeChat(modelMessages, systemPrompt, maxReplyTokens)) {
        fullResponse += chunk.token

        // Real-time filter: if bot starts generating exam or structured lesson content, kill stream
        const examPattern = /EXAMEN\s*ORAL|═{3,}.*EXAMEN|Întrebarea\s+\d+\s*[/:]|Să vedem ce ai reținut|──\s*Lecția\s+\d+/i
        if (examPattern.test(fullResponse) && !chunk.done) {
          // Strip the bad content and send a clean ending
          const cleanEnd = fullResponse.replace(/[\s\S]*(EXAMEN|═{3,}|──\s*Lecția)[\s\S]*/gi, '').trim()
          // Send only the unsent clean part
          const unsent = cleanEnd.substring(sentLength)
          if (unsent) event.sender.send('chat:token', { token: unsent, done: false })
          event.sender.send('chat:token', { token: '', done: true })
          fullResponse = cleanEnd || 'What can I help with?'
          addMessage('assistant', stripChatActionTokens(fullResponse) || fullResponse)
          break
        }

        event.sender.send('chat:token', { token: chunk.token, done: chunk.done })
        sentLength = fullResponse.length

        if (chunk.done) {
          addMessage('assistant', stripChatActionTokens(fullResponse) || fullResponse)

          // Cumulative telemetry tracking
          if (chunk.inputTokens || chunk.outputTokens) {
            addTotalTokens(chunk.inputTokens || 0, chunk.outputTokens || 0, {
              source: 'chat',
              tierMode: normalizeProfile(getState('profile') as UserProfile | null)?.tierMode,
            })
            recordAIUsage(chunk.inputTokens || 0, chunk.outputTokens || 0, 'chat')
          }

          // Award XP for conversation
          const mot = rewardMotivationChatReply(getState('motivation') as MotivationState | null)
          setState('motivation', mot)
        }
      }
    } catch (err: any) {
      const errorMsg = `Error: ${err.message || 'Could not reach the API.'}`
      event.sender.send('chat:token', { token: errorMsg, done: true })
      addMessage('assistant', errorMsg)
    }
  })

  ipcMain.handle('chat:history', async () => {
    return getMessages(50).reverse().filter((message) => !isHiddenTeacherInstruction(message.content))
  })

  ipcMain.handle('chat:clear', async () => {
    clearMessages()
  })

  // --- AI Status ---
  ipcMain.handle('ai:status', async () => {
    const running = await checkClaudeHealth()
    const stats = getTokenStats()
    return {
      running,
      provider: 'deepseek',
      model: `${CLAUDE_CHAT_MODEL} + ${CLAUDE_CHAT_DEEP_MODEL}`,
      hasClaude: Boolean(getClaudeApiKey()),
      machineId: getMachineId(),
      totalTokensInput: stats.totalInput,
      totalTokensOutput: stats.totalOutput,
      totalRequests: stats.totalRequests,
    }
  })

  // --- DeepSeek API Key (legacy claude channel) ---
  ipcMain.handle('claude:setKey', async (_e, key: string) => {
    setClaudeApiKey(key)
    // Also persist in db
    setState('claudeApiKey', key)
    const ok = await checkClaudeHealth()
    return { ok }
  })

  ipcMain.handle('claude:getKey', async () => {
    return getClaudeApiKey()
  })

  // --- Groq API Key ---
  ipcMain.handle('groq:setKey', async (_e, key: string) => {
    setGroqApiKey(key)
    setState('groqApiKey', key)
    const ok = await checkGroqHealth()
    return { ok }
  })

  ipcMain.handle('groq:getKey', async () => {
    return getGroqApiKey()
  })

  // --- Tasks ---
  ipcMain.handle('tasks:list', async () => {
    return getTasks().map(t => ({
      ...t,
      done: Boolean(t.done)
    }))
  })

  ipcMain.handle('tasks:add', async (_event, text: string, priority?: string, parentId?: number | null) => {
    return addTask(text, priority || 'mid', parentId || null)
  })

  ipcMain.handle('tasks:toggle', async (_event, id: number) => {
    toggleTask(id)
  })

  ipcMain.handle('tasks:remove', async (_event, id: number) => {
    removeTask(id)
  })

  // --- Motivation ---
  ipcMain.handle('motivation:getState', async () => {
    const mot = hydrateStoredMotivationProgress(getState('motivation') as MotivationState | null, motivationProgressDeps)
    setState('motivation', mot)
    return mot
  })

  ipcMain.handle('motivation:addXP', async (_event, amount: number) => {
    const mot = addMotivationXp(getState('motivation') as MotivationState | null, amount, motivationProgressDeps)
    setState('motivation', mot)
    return mot
  })

  ipcMain.handle('motivation:awardLessonCompletion', async (_event, lessonId: number) => {
    const result = awardMotivationLessonCompletion(
      getState('motivation') as MotivationState | null,
      lessonId,
      motivationLessonDeps,
    )
    setState('motivation', result.motivation)
    return result.reward
  })

  ipcMain.handle('motivation:updateStreak', async () => {
    const mot = updateMotivationStreak(getState('motivation') as MotivationState | null, motivationStreakDeps)
    setState('motivation', mot)
    return mot
  })

  // Clears the welcomeBack flag once the UI has shown the re-entry toast.
  ipcMain.handle('motivation:acknowledgeWelcomeBack', async () => {
    const mot = acknowledgeWelcomeBackState(getState('motivation') as MotivationState | null)
    setState('motivation', mot)
    return mot
  })

  ipcMain.handle('motivation:addMinutes', async (_event, minutes: number) => {
    const mot = addMotivationMinutes(getState('motivation') as MotivationState | null, minutes, motivationProgressDeps)
    setState('motivation', mot)
    return mot
  })

  // --- Energy ---
  ipcMain.handle('energy:log', async (_event, level: number) => {
    logEnergy(level)
  })

  ipcMain.handle('energy:getToday', async () => {
    return getTodayEnergy()
  })

  // --- Profile ---
  ipcMain.handle('profile:get', async () => {
    return normalizeProfile(getState('profile') as UserProfile | null)
  })

  ipcMain.handle('profile:save', async (_event, profile: UserProfile) => {
    setState('profile', normalizeProfile(profile))
  })

  ipcMain.handle('profile:resetAll', async () => {
    resetUserData()
    return { ok: true }
  })

  ipcMain.handle('limits:getState', async () => {
    return buildTierLimitSnapshot(normalizeProfile(getState('profile') as UserProfile | null))
  })

  // --- Window ---
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide()
  })
}
