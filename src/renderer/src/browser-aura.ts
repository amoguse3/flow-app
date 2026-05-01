import type {
  AIStatus,
  AuraAPI,
  ChatTokenEvent,
  Course,
  CourseFeedbackContext,
  CourseFeedbackAnalytics,
  CourseFeedbackAnalyticsItem,
  CourseFeedbackRecord,
  CourseFeedbackSubmission,
  CourseFamiliarity,
  CourseGenerationEvent,
  CourseGenerationRequest,
  CourseGenerationStartResult,
  CourseIntakeAnswer,
  CourseIntakeQuestion,
  CourseIntakeSession,
  CourseReinforcementSummary,
  CourseRecommendation,
  CourseRecommendationDirection,
  DailyLeaderboard,
  Flashcard,
  FlashcardSaveResult,
  GameChallenge,
  GameChallengeSeed,
  GameDifficulty,
  GamePoints,
  GameResult,
  GameScore,
  GameType,
  Lesson,
  LessonPracticeSet,
  LessonQuizQuestion,
  LessonReward,
  MemoryKind,
  MemoryRecord,
  Message,
  Module,
  MotivationState,
  SyncState,
  Task,
  TeacherCheckpoint,
  TeacherCheckpointFlashcard,
  TierCapabilities,
  TierLimitSnapshot,
  TierMode,
  UserProfile,
  VoiceSettings,
} from '../../../shared/types'

const STORAGE_KEY = 'aura-browser-state-v1'
const DAY_MS = 24 * 60 * 60 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const SUPPORTED_GAME_TYPES: GameType[] = ['math_speed', 'memory_tiles', 'pattern_match', 'reaction_time', 'word_scramble', 'color_stroop']

type TokenChannel = 'chat:token' | 'educator:courseGenToken' | 'educator:lessonToken' | 'educator:clarifyToken' | 'overlay:chatMessage'

interface BrowserState {
  nextIds: {
    message: number
    task: number
    energy: number
    course: number
    module: number
    lesson: number
    intakeSession: number
    job: number
    feedback: number
    memory: number
    flashcard: number
    gameScore: number
  }
  messages: Message[]
  tasks: Task[]
  energyLogs: Array<{ id: number; level: number; date: string; created_at: string }>
  profile: UserProfile | null
  motivation: MotivationState
  courses: Course[]
  modules: Module[]
  lessons: Lesson[]
  intakeSessions: CourseIntakeSession[]
  flashcards: Flashcard[]
  feedback: CourseFeedbackRecord[]
  memories: MemoryRecord[]
  gameScores: GameScore[]
  gamePoints: GamePoints
  voiceSettings: VoiceSettings
  syncState: SyncState
  claudeKey: string
  groqKey: string
  usage: {
    courseGenerationTimestamps: string[]
    chatMessageTimestamps: string[]
    lessonCompletionTimestamps: string[]
  }
}

interface ChallengeMeta {
  gameType: GameType
  difficulty: GameDifficulty
  startedAt: number
  maxTimeMs: number
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  ttsEnabled: true,
  sttEnabled: true,
  ttsRate: 0.9,
  ttsPitch: 0.95,
  ttsVolume: 1,
  language: 'en-US',
  voiceName: '',
}

const DEFAULT_SYNC_STATE: SyncState = {
  linked: false,
  linkCode: null,
  lastSync: null,
  syncStatus: 'idle',
  webUsername: null,
}

const DEFAULT_MOTIVATION: MotivationState = {
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
  achievementLevels: {
    lessons: 1,
    courses: 1,
    words: 1,
    time: 1,
  },
  freezesAvailable: 1,
  lastFreezeGrantDate: '',
  welcomeBack: null,
  lastLessonReward: null,
}

const challengeRegistry = new Map<string, ChallengeMeta>()
const listeners = new Map<string, Set<(payload: unknown) => void>>()

function createDefaultState(): BrowserState {
  return {
    nextIds: {
      message: 1,
      task: 1,
      energy: 1,
      course: 1,
      module: 1,
      lesson: 1,
      intakeSession: 1,
      job: 1,
      feedback: 1,
      memory: 1,
      flashcard: 1,
      gameScore: 1,
    },
    messages: [],
    tasks: [],
    energyLogs: [],
    profile: null,
    motivation: { ...DEFAULT_MOTIVATION, achievementLevels: { ...DEFAULT_MOTIVATION.achievementLevels } },
    courses: [],
    modules: [],
    lessons: [],
    intakeSessions: [],
    flashcards: [],
    feedback: [],
    memories: [],
    gameScores: [],
    gamePoints: {
      total: 0,
      todayEarned: 0,
      proDaysRedeemed: 0,
    },
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    syncState: { ...DEFAULT_SYNC_STATE },
    claudeKey: '',
    groqKey: '',
    usage: {
      courseGenerationTimestamps: [],
      chatMessageTimestamps: [],
      lessonCompletionTimestamps: [],
    },
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function loadState(): BrowserState {
  const base = createDefaultState()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<BrowserState>

    return {
      ...base,
      ...parsed,
      nextIds: { ...base.nextIds, ...(parsed.nextIds || {}) },
      messages: Array.isArray(parsed.messages) ? parsed.messages : base.messages,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : base.tasks,
      energyLogs: Array.isArray(parsed.energyLogs) ? parsed.energyLogs : base.energyLogs,
      courses: Array.isArray(parsed.courses) ? parsed.courses : base.courses,
      modules: Array.isArray(parsed.modules) ? parsed.modules : base.modules,
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : base.lessons,
      intakeSessions: Array.isArray(parsed.intakeSessions) ? parsed.intakeSessions : base.intakeSessions,
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : base.flashcards,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : base.feedback,
      memories: Array.isArray(parsed.memories) ? parsed.memories : base.memories,
      gameScores: Array.isArray(parsed.gameScores) ? parsed.gameScores : base.gameScores,
      gamePoints: { ...base.gamePoints, ...(parsed.gamePoints || {}) },
      voiceSettings: { ...base.voiceSettings, ...(parsed.voiceSettings || {}) },
      syncState: { ...base.syncState, ...(parsed.syncState || {}) },
      motivation: {
        ...base.motivation,
        ...(parsed.motivation || {}),
        achievementLevels: {
          ...base.motivation.achievementLevels,
          ...(parsed.motivation?.achievementLevels || {}),
        },
      },
      usage: {
        ...base.usage,
        ...(parsed.usage || {}),
      },
    }
  } catch {
    return base
  }
}

function saveState(state: BrowserState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function updateState<T>(mutate: (state: BrowserState) => T): T {
  const state = loadState()
  const result = mutate(state)
  saveState(state)
  return result
}

function nextId(state: BrowserState, key: keyof BrowserState['nextIds']): number {
  const value = state.nextIds[key]
  state.nextIds[key] += 1
  return value
}

function localDayKey(input: number | string | Date = Date.now()): string {
  const date = new Date(input)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function nowIso(): string {
  return new Date().toISOString()
}

function emit<T>(channel: TokenChannel, payload: T): void {
  const activeListeners = listeners.get(channel)
  if (!activeListeners) return
  for (const listener of activeListeners) {
    listener(payload)
  }
}

function subscribe<T>(channel: TokenChannel, callback: (payload: T) => void): () => void {
  const current = listeners.get(channel) || new Set<(payload: unknown) => void>()
  current.add(callback as (payload: unknown) => void)
  listeners.set(channel, current)
  return () => {
    const active = listeners.get(channel)
    if (!active) return
    active.delete(callback as (payload: unknown) => void)
    if (active.size === 0) listeners.delete(channel)
  }
}

function streamText(channel: Extract<TokenChannel, 'chat:token' | 'educator:lessonToken' | 'educator:clarifyToken'>, text: string): void {
  const chunks = text.match(/.{1,28}(?:\s+|$)|.{1,28}/g) || [text]
  chunks.forEach((chunk, index) => {
    window.setTimeout(() => {
      emit<ChatTokenEvent>(channel, {
        token: chunk,
        done: false,
      })
      if (index === chunks.length - 1) {
        window.setTimeout(() => {
          emit<ChatTokenEvent>(channel, { token: '', done: true })
        }, 40)
      }
    }, index * 36)
  })
}

function buildFallbackProfile(profile: UserProfile | null): UserProfile | null {
  if (!profile) return null
  return {
    name: profile.name || 'AURA',
    hasADHD: Boolean(profile.hasADHD),
    preferSoftMode: Boolean(profile.preferSoftMode),
    selectedModel: profile.selectedModel || 'browser-fallback',
    language: profile.language || 'en',
    onboardingDone: Boolean(profile.onboardingDone),
    dopamineRewards: Array.isArray(profile.dopamineRewards) ? profile.dopamineRewards : [],
    ageGroup: profile.ageGroup || 'unknown',
    onboardingIntent: profile.onboardingIntent,
    onboardingQuickStartDone: profile.onboardingQuickStartDone,
    orbEnabled: profile.orbEnabled !== false,
    orbSize: profile.orbSize || 'medium',
    tierMode: profile.tierMode || 'dev-unlimited',
  }
}

function getLevel(xp: number): number {
  if (xp >= 1600) return 6
  if (xp >= 900) return 5
  if (xp >= 500) return 4
  if (xp >= 250) return 3
  if (xp >= 100) return 2
  return 1
}

function hydrateMotivation(state: BrowserState): MotivationState {
  const completedLessons = state.lessons.filter((lesson) => lesson.completed).length
  const coursesCompleted = state.courses.filter((course) => course.status === 'completed').length
  const motivation = {
    ...DEFAULT_MOTIVATION,
    ...state.motivation,
    achievementLevels: {
      ...DEFAULT_MOTIVATION.achievementLevels,
      ...(state.motivation.achievementLevels || {}),
    },
  }

  motivation.completedLessons = completedLessons
  motivation.coursesCompleted = coursesCompleted
  motivation.level = getLevel(motivation.xp)
  motivation.achievementLevels.lessons = Math.floor(Math.max(0, completedLessons) / 5) + 1
  motivation.achievementLevels.courses = Math.max(1, coursesCompleted + 1)
  motivation.achievementLevels.words = Math.max(1, Math.floor(motivation.wordsTyped / 200) + 1)
  motivation.achievementLevels.time = Math.max(1, Math.floor(motivation.minutesSpent / 30) + 1)

  const badges = new Set(motivation.badges)
  if (motivation.level >= 2) badges.add('level_2')
  if (motivation.level >= 3) badges.add('level_3')
  if (motivation.level >= 5) badges.add('level_5')
  if (completedLessons >= 1) badges.add('lesson_1')
  if (completedLessons >= 5) badges.add('lesson_5')
  if (coursesCompleted >= 1) badges.add('course_1')
  if (motivation.minutesSpent >= 30) badges.add('time_30')
  motivation.badges = [...badges]
  state.motivation = motivation
  return clone(motivation)
}

function countWords(text: string): number {
  const matches = text.trim().match(/[\p{L}\p{N}']+/gu)
  return matches ? matches.length : 0
}

function buildCourseTitle(topic: string): string {
  const cleaned = topic.trim()
  if (!cleaned) return 'New Course'
  return cleaned.length > 48 ? `${cleaned.slice(0, 45)}...` : cleaned
}

function buildLessonContent(topic: string, moduleTitle: string, lessonTitle: string, familiarity: CourseFamiliarity): string {
  const startingPoint = familiarity === 'new'
    ? 'start from zero and make the first frame obvious'
    : familiarity === 'strong'
      ? 'move fast but keep the mental model crisp'
      : 'build a clean mental model before complexity'

  return [
    'HOOK:',
    `Why does **${lessonTitle}** matter inside **${topic}**? Because this is the part that turns vague interest into a usable decision.` ,
    '',
    'CORE:',
    `In **${moduleTitle}**, the goal is to ${startingPoint}. Focus on one stable idea: **${lessonTitle}** should help you notice the pattern, name it clearly, and use it on purpose instead of by accident.`,
    `When you learn **${lessonTitle}**, ask three things: what it is, when it helps, and what mistake it prevents first. That alone is enough to make progress feel tangible.`,
    '',
    'PROVE IT:',
    `Describe one concrete example where **${lessonTitle}** changes what you would do next. Keep it short and practical.`,
    '',
    'RECAP:',
    `The main takeaway is simple: **${lessonTitle}** is useful when you need clarity, sequence, and a repeatable next move inside **${topic}**.`,
    '',
    'CLIFFHANGER:',
    `Next, connect **${lessonTitle}** to a slightly harder situation so the idea stops being abstract and starts becoming automatic.`,
  ].join('\n')
}

function buildCourseGraph(state: BrowserState, topic: string, familiarity: CourseFamiliarity): { course: Course; modules: Module[]; lessons: Lesson[]; jobId: number } {
  const createdAt = nowIso()
  const courseId = nextId(state, 'course')
  const jobId = nextId(state, 'job')
  const course: Course = {
    id: courseId,
    title: buildCourseTitle(topic),
    description: `A browser-local course path for ${topic}.`,
    topic,
    total_modules: 3,
    completed_modules: 0,
    status: 'generating',
    generation_job_id: jobId,
    generation_status: 'running',
    generation_phase: 'roadmap',
    generation_progress: 8,
    generation_summary: `Growing a starter path for ${topic}.`,
    generation_error: null,
    generation_updated_at: createdAt,
    created_at: createdAt,
  }

  const moduleBlueprints = [
    { title: `FOUNDATIONS OF ${topic.toUpperCase()}`, lessonTitles: ['Map the territory', 'Name the core ideas', 'Notice the first mistakes'] },
    { title: `PRACTICE ${topic.toUpperCase()}`, lessonTitles: ['Use a simple workflow', 'Compare weak vs strong moves', 'Apply the idea in context'] },
    { title: `USE ${topic.toUpperCase()} FOR REAL`, lessonTitles: ['Solve a realistic problem', 'Explain it simply', 'Plan the next improvement'] },
  ]

  const modules: Module[] = []
  const lessons: Lesson[] = []

  moduleBlueprints.forEach((blueprint, moduleIndex) => {
    const moduleId = nextId(state, 'module')
    modules.push({
      id: moduleId,
      course_id: courseId,
      title: blueprint.title,
      order_num: moduleIndex + 1,
      pass_threshold: 0.8,
      unlocked: moduleIndex === 0,
      completed: false,
      created_at: createdAt,
    })

    blueprint.lessonTitles.forEach((lessonTitle, lessonIndex) => {
      const finalLessonTitle = `${lessonIndex + 1}. ${lessonTitle}`
      lessons.push({
        id: nextId(state, 'lesson'),
        module_id: moduleId,
        title: finalLessonTitle,
        content: buildLessonContent(topic, blueprint.title, finalLessonTitle, familiarity),
        order_num: lessonIndex + 1,
        completed: false,
        created_at: createdAt,
      })
    })
  })

  return { course, modules, lessons, jobId }
}

function buildCourseIntakeQuestions(topic: string): CourseIntakeQuestion[] {
  return [
    {
      id: 'goal',
      question: `What do you want from ${topic} right now?`,
      placeholder: 'example: build projects, stop feeling lost, pass an exam',
    },
    {
      id: 'pace',
      question: 'How much time can you realistically give this each week?',
      placeholder: 'example: 15 minutes a day, 3 evenings, weekends only',
    },
  ]
}

function normalizeCourseRequest(request: string | CourseGenerationRequest): { topic: string; familiarity: CourseFamiliarity; intakeAnswers: CourseIntakeAnswer[] } {
  if (typeof request === 'string') {
    return { topic: request.trim(), familiarity: 'unsure', intakeAnswers: [] }
  }

  return {
    topic: request.topic.trim(),
    familiarity: request.familiarity || 'unsure',
    intakeAnswers: Array.isArray(request.intakeAnswers) ? request.intakeAnswers : [],
  }
}

function buildLessonReward(state: BrowserState, lessonId: number): LessonReward {
  const completedLessons = state.lessons.filter((lesson) => lesson.completed).length
  const milestoneSize = 5
  const milestoneReached = completedLessons > 0 && completedLessons % milestoneSize === 0
  const nextMilestoneAt = milestoneReached
    ? completedLessons + milestoneSize
    : Math.ceil(Math.max(1, completedLessons) / milestoneSize) * milestoneSize

  return {
    lessonId,
    normalXp: 35,
    bonusXp: 10,
    totalXp: 45,
    completedLessons,
    milestoneSize,
    milestoneReached,
    milestoneReachedAt: milestoneReached ? completedLessons : null,
    nextMilestoneAt,
    lessonsUntilNextMilestone: Math.max(0, nextMilestoneAt - completedLessons),
    milestoneLabel: milestoneReached ? 'Milestone reached.' : 'Steady progress.',
    celebrationText: milestoneReached ? 'You hit a lesson milestone.' : 'One more lesson locked in.',
  }
}

function normalizeFeedbackContextForCourse(
  courseId: number,
  context?: CourseFeedbackContext | null,
): CourseFeedbackContext | null {
  const summary = context?.reinforcementSummary
  if (!summary) return null

  const normalizedGameType = String(summary.latestGameType || '')
  const latestGameType = SUPPORTED_GAME_TYPES.includes(normalizedGameType as GameType)
    ? normalizedGameType as GameType
    : null

  const reinforcementSummary: CourseReinforcementSummary = {
    courseId,
    totalGames: Math.max(0, Math.round(Number(summary.totalGames || 0))),
    verifiedGames: Math.max(0, Math.round(Number(summary.verifiedGames || 0))),
    totalPoints: Math.max(0, Math.round(Number(summary.totalPoints || 0))),
    seededGames: Math.max(0, Math.round(Number(summary.seededGames || 0))),
    latestGameType,
  }

  return { reinforcementSummary }
}

function mergeFeedbackContextForCourse(
  courseId: number,
  current?: CourseFeedbackContext | null,
  next?: CourseFeedbackContext | null,
): CourseFeedbackContext | null {
  return normalizeFeedbackContextForCourse(courseId, next) || normalizeFeedbackContextForCourse(courseId, current)
}

function normalizeSeedToken(value: unknown, maxLength = 16): string | null {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length < 3 || normalized.length > maxLength) {
    return null
  }

  return normalized.toUpperCase()
}

function buildSeedWordPool(seed?: GameChallengeSeed | null): string[] {
  if (!seed) return []

  const tokens = [
    ...(Array.isArray(seed.words) ? seed.words : []),
    ...(Array.isArray(seed.phrases) ? seed.phrases.flatMap((phrase) => String(phrase || '').split(/\s+/)) : []),
  ]

  const unique: string[] = []
  for (const token of tokens) {
    const normalized = normalizeSeedToken(token)
    if (!normalized || unique.includes(normalized)) continue
    unique.push(normalized)
    if (unique.length >= 12) break
  }

  return unique
}

function scrambleWord(word: string): string {
  const chars = word.split('')
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]]
  }
  return chars.join('')
}

function pickCourseRecommendationDirection(feedback: CourseFeedbackSubmission): CourseRecommendationDirection {
  if (feedback.continue_interest_rating <= 4) {
    return 'adjacent'
  }
  if (feedback.difficulty_rating >= 8 || feedback.clarity_rating <= 5) {
    return 'reinforce'
  }
  if (feedback.retention_rating <= 5) {
    return 'practice'
  }
  if (
    feedback.overall_rating >= 8
    && feedback.clarity_rating >= 7
    && feedback.retention_rating >= 7
    && feedback.continue_interest_rating >= 7
    && feedback.difficulty_rating <= 6
  ) {
    return 'advance'
  }
  return feedback.retention_rating < 7 ? 'practice' : 'advance'
}

function buildCourseRecommendation(topic: string, direction: CourseRecommendationDirection): CourseRecommendation {
  const safeTopic = topic.trim() || 'your topic'
  const nextTopic = direction === 'reinforce'
    ? `${safeTopic}: stronger foundations and worked examples`
    : direction === 'practice'
      ? `${safeTopic}: recall drills and applied practice`
      : direction === 'adjacent'
        ? `${safeTopic}: lighter real-world applications`
        : `${safeTopic}: deeper applications and harder decisions`

  return {
    topic: nextTopic,
    title: nextTopic,
    reason: direction === 'advance'
      ? 'Your signals are strong enough to level up without repeating the same path.'
      : direction === 'practice'
        ? 'A tighter practice loop would probably help retention before you climb further.'
        : direction === 'adjacent'
          ? 'An adjacent topic would keep momentum while making the next step feel lighter.'
          : 'A reinforcement pass would likely make the basics more stable before the next jump.',
    direction,
    confidence: direction === 'advance' ? 84 : direction === 'practice' ? 76 : direction === 'adjacent' ? 68 : 74,
    source: 'heuristic',
  }
}

function buildChatReply(message: string, state: BrowserState): string {
  const text = message.trim()
  const lower = text.toLowerCase()
  const firstCourse = state.courses.find((course) => course.status !== 'failed')

  if (/(task|todo|plan|задач|дел)/i.test(lower)) {
    return 'Let us turn this into one visible next step. [[AURA_ACTION:OPEN_TASKS]]'
  }

  if (/(course|learn|study|lesson|учеб|курс|урок)/i.test(lower)) {
    if (firstCourse) {
      return `Continue the path you already started. [[AURA_ACTION:OPEN_COURSE:${firstCourse.id}]]`
    }
    return 'Create one compact course and start small. [[AURA_ACTION:OPEN_COURSE_CREATOR]]'
  }

  if (/(teacher|teach|объясн|препод)/i.test(lower)) {
    if (firstCourse) {
      return `Open teacher mode for guided explanation. [[AURA_ACTION:OPEN_TEACHER:${firstCourse.id}]]`
    }
    return 'Start with a course first, then teacher mode becomes useful. [[AURA_ACTION:OPEN_COURSE_CREATOR]]'
  }

  if (/(flashcard|review|карточ|повтор)/i.test(lower)) {
    return 'Open the flashcards and review the due ones. [[AURA_ACTION:OPEN_FLASHCARDS]]'
  }

  if (/(focus|pomodoro|таймер|собер)/i.test(lower)) {
    return 'Keep it small: pick one action, define a short block, and finish the first visible piece.'
  }

  return `Browser mode is active, so I am running in local fallback mode. I can still help with tasks, simple courses, flashcards, and study flow. Start with one concrete next step from: "${text.slice(0, 80)}".`
}

function buildQuiz(lesson: Lesson): LessonQuizQuestion[] {
  return [
    {
      question: `What is the main purpose of ${lesson.title}?`,
      type: 'text',
      correctAnswer: 'To understand and apply the lesson clearly.',
      hint: 'Answer in one short sentence.',
    },
    {
      question: `Which move best fits ${lesson.title}?`,
      type: 'mcq',
      options: ['Name the idea and use it deliberately', 'Ignore structure and guess', 'Memorize words without context'],
      correctAnswer: 'Name the idea and use it deliberately',
      hint: 'Choose the action that creates clarity.',
    },
    {
      question: 'What mistake should you avoid first?',
      type: 'text',
      correctAnswer: 'Using the idea without understanding when it applies.',
      hint: 'Think about misuse, not perfection.',
    },
  ]
}

function buildPractice(lesson: Lesson): LessonPracticeSet {
  return {
    intro: `Practice ${lesson.title} with one direct check and one applied response.`,
    objective: `Move ${lesson.title} from passive reading into active recall.`,
    isCoding: false,
    requiredToPass: 2,
    exercises: [
      {
        id: `${lesson.id}-core-1`,
        kind: 'mcq',
        difficulty: 'core',
        prompt: `Which statement best matches ${lesson.title}?`,
        options: ['Use the concept intentionally', 'Skip the concept and improvise', 'Only memorize the terminology'],
        correctAnswer: 'Use the concept intentionally',
        acceptableAnswers: ['Use the concept intentionally'],
        hint: 'Pick the option that creates a repeatable move.',
        whyItMatters: 'It shows whether you can distinguish the useful move from noise.',
        taskPrompt: `Review the key move in ${lesson.title}`,
      },
      {
        id: `${lesson.id}-core-2`,
        kind: 'short_text',
        difficulty: 'core',
        prompt: `In one sentence, where would ${lesson.title} help in real life?`,
        correctAnswer: 'It helps when a clear, deliberate next move matters.',
        acceptableAnswers: ['clear next move', 'deliberate next move', 'real situation'],
        hint: 'Keep it practical.',
        whyItMatters: 'Application beats vague recall.',
        taskPrompt: `Write one real example for ${lesson.title}`,
        placeholder: 'A real example where this matters...',
      },
    ],
  }
}

function buildCheckpoint(lesson: Lesson, focus?: string): TeacherCheckpoint {
  const focusText = focus?.trim() || lesson.title
  return {
    anchors: [`Explain ${focusText} in plain language.`, `Name one mistake and one good use.`],
    questions: [
      {
        question: `Which statement best captures ${focusText}?`,
        options: ['A practical move with a clear purpose', 'A random detail with no structure', 'Only a definition to memorize'],
        correctAnswer: 'A practical move with a clear purpose',
        explanation: 'The lesson is meant to help you act with more clarity, not just repeat vocabulary.',
      },
      {
        question: `What should happen after understanding ${focusText}?`,
        options: ['You can apply it to a concrete example', 'You stop checking your understanding', 'You ignore context'],
        correctAnswer: 'You can apply it to a concrete example',
        explanation: 'Understanding becomes real when you can use it in context.',
      },
    ],
    flashcards: [
      { front: `${focusText}: what is it?`, back: 'A practical concept you can name and apply deliberately.' },
      { front: `${focusText}: first mistake to avoid?`, back: 'Using it without knowing when it actually fits.' },
    ],
  }
}

function buildModuleCheckpoint(module: Module, lessons: Lesson[]): TeacherCheckpoint {
  const orderedLessons = [...lessons].sort((left, right) => left.order_num - right.order_num)
  const opener = orderedLessons[0]?.title || module.title
  const closer = orderedLessons[orderedLessons.length - 1]?.title || module.title

  return {
    anchors: [
      `Name the throughline of ${module.title}.`,
      `Connect ${opener} to ${closer}.`,
      `Say the mistake this module prevents.`,
    ],
    questions: [
      {
        question: `What should remain after ${module.title}?`,
        options: [
          'A usable mental model',
          'A random isolated fact',
          'Only the lesson order',
          'A vague feeling with no next step',
        ],
        correctAnswer: 'A usable mental model',
        explanation: 'A module checkpoint should preserve one repeatable move, not loose fragments.',
      },
      {
        question: `What proves you understood ${module.title}?`,
        options: [
          'You can apply it to a concrete example',
          'You can recite one phrase only',
          'You skip the context',
          'You ignore the common mistake',
        ],
        correctAnswer: 'You can apply it to a concrete example',
        explanation: 'Transfer matters more than rote recall at the end of a module.',
      },
      {
        question: `What usually breaks retention in ${module.title}?`,
        options: [
          'Memorizing details without the decision rule',
          'Linking one lesson to another',
          'Reviewing the flashcards later',
          'Checking one misconception',
        ],
        correctAnswer: 'Memorizing details without the decision rule',
        explanation: 'The checkpoint is meant to keep the decision rule alive, not disconnected details.',
      },
    ],
    flashcards: [
      { front: `${module.title}: core`, back: 'Keep one clear throughline across the whole module.' },
      { front: `${module.title}: proof`, back: 'Show understanding with one concrete use case.' },
      { front: `${module.title}: mistake`, back: 'Do not memorize fragments without the decision rule.' },
    ],
  }
}

function defaultCapabilities(tierMode: TierMode): TierCapabilities {
  if (tierMode === 'dev-unlimited') {
    return {
      coursesPer2Hours: null,
      coursesPerMonth: null,
      chatMessagesPerDay: null,
      lessonsPer2Hours: null,
      lessonsPerMonth: null,
      flashcardsTotal: null,
      exportCoursePdf: true,
    }
  }

  if (tierMode === 'premium') {
    return {
      coursesPer2Hours: 6,
      coursesPerMonth: 30,
      chatMessagesPerDay: null,
      lessonsPer2Hours: 15,
      lessonsPerMonth: 250,
      flashcardsTotal: null,
      exportCoursePdf: true,
    }
  }

  return {
    coursesPer2Hours: 2,
    coursesPerMonth: 3,
    chatMessagesPerDay: 20,
    lessonsPer2Hours: 5,
    lessonsPerMonth: 30,
    flashcardsTotal: 20,
    exportCoursePdf: false,
  }
}

function buildTierSnapshot(state: BrowserState): TierLimitSnapshot {
  const profile = buildFallbackProfile(state.profile)
  const tierMode = profile?.tierMode || 'dev-unlimited'
  const capabilities = defaultCapabilities(tierMode)
  const now = Date.now()
  const today = localDayKey(now)
  const month = today.slice(0, 7)

  const courseGenerationTimestamps = state.usage.courseGenerationTimestamps.filter((value) => now - Date.parse(value) < 400 * DAY_MS)
  const chatMessageTimestamps = state.usage.chatMessageTimestamps.filter((value) => now - Date.parse(value) < 400 * DAY_MS)
  const lessonCompletionTimestamps = state.usage.lessonCompletionTimestamps.filter((value) => now - Date.parse(value) < 400 * DAY_MS)

  state.usage.courseGenerationTimestamps = courseGenerationTimestamps
  state.usage.chatMessageTimestamps = chatMessageTimestamps
  state.usage.lessonCompletionTimestamps = lessonCompletionTimestamps

  const coursesLast2Hours = courseGenerationTimestamps.filter((value) => now - Date.parse(value) < TWO_HOURS_MS).length
  const coursesThisMonth = courseGenerationTimestamps.filter((value) => value.startsWith(month)).length
  const chatToday = chatMessageTimestamps.filter((value) => value.startsWith(today)).length
  const lessonsLast2Hours = lessonCompletionTimestamps.filter((value) => now - Date.parse(value) < TWO_HOURS_MS).length
  const lessonsThisMonth = lessonCompletionTimestamps.filter((value) => value.startsWith(month)).length
  const flashcardsTotal = state.flashcards.length
  const endOfToday = new Date()
  endOfToday.setHours(24, 0, 0, 0)
  const lastCourseAt = courseGenerationTimestamps.length > 0 ? Math.max(...courseGenerationTimestamps.map((value) => Date.parse(value))) : null
  const lastLessonAt = lessonCompletionTimestamps.length > 0 ? Math.max(...lessonCompletionTimestamps.map((value) => Date.parse(value))) : null

  const plans = {
    free: {
      label: 'Free',
      note: 'Good for a lightweight browser demo path.',
      capabilities: defaultCapabilities('free'),
    },
    premium: {
      label: 'Premium',
      note: 'Higher limits for sustained learning.',
      capabilities: defaultCapabilities('premium'),
    },
  }

  return {
    tierMode,
    label: tierMode === 'dev-unlimited' ? 'Dev Unlimited' : tierMode === 'premium' ? 'Premium' : 'Free',
    capabilities,
    usage: {
      coursesCreatedLast2Hours: coursesLast2Hours,
      coursesCreatedThisMonth: coursesThisMonth,
      chatMessagesToday: chatToday,
      lessonsStartedLast2Hours: lessonsLast2Hours,
      lessonsStartedThisMonth: lessonsThisMonth,
      flashcardsTotal,
    },
    remaining: {
      coursesPer2Hours: capabilities.coursesPer2Hours === null ? null : Math.max(0, capabilities.coursesPer2Hours - coursesLast2Hours),
      coursesPerMonth: capabilities.coursesPerMonth === null ? null : Math.max(0, capabilities.coursesPerMonth - coursesThisMonth),
      chatMessagesPerDay: capabilities.chatMessagesPerDay === null ? null : Math.max(0, capabilities.chatMessagesPerDay - chatToday),
      lessonsPer2Hours: capabilities.lessonsPer2Hours === null ? null : Math.max(0, capabilities.lessonsPer2Hours - lessonsLast2Hours),
      lessonsPerMonth: capabilities.lessonsPerMonth === null ? null : Math.max(0, capabilities.lessonsPerMonth - lessonsThisMonth),
      flashcardsTotal: capabilities.flashcardsTotal === null ? null : Math.max(0, capabilities.flashcardsTotal - flashcardsTotal),
    },
    notes: {
      courseCreation: tierMode === 'dev-unlimited' ? 'Hosted browser fallback leaves course creation unlocked.' : 'Browser fallback tracks local course usage only.',
      chatBudget: tierMode === 'dev-unlimited' ? 'Chat is local and effectively unlimited here.' : 'Chat usage is tracked locally in browser storage.',
      lessons: 'Lesson pacing is estimated from local progress only.',
      flashcards: 'Flashcards live in browser storage for this hosted fallback.',
      exportCoursePdf: 'Not available in the browser fallback.',
    },
    windows: {
      chatMessagesResetInMs: Math.max(0, endOfToday.getTime() - now),
      courseWindowResetInMs: lastCourseAt ? Math.max(0, TWO_HOURS_MS - (now - lastCourseAt)) : 0,
      lessonWindowResetInMs: lastLessonAt ? Math.max(0, TWO_HOURS_MS - (now - lastLessonAt)) : 0,
    },
    telemetry: {
      total: { input: 0, output: 0, total: 0, requests: 0, averagePerRequest: 0 },
      byTier: {
        free: { input: 0, output: 0, total: 0, requests: 0, averagePerRequest: 0 },
        premium: { input: 0, output: 0, total: 0, requests: 0, averagePerRequest: 0 },
        'dev-unlimited': { input: 0, output: 0, total: 0, requests: 0, averagePerRequest: 0 },
      },
      bySource: [],
      optimization: {
        currentTierTargetVsPremium: null,
        freeTargetVsPremium: 0,
        freeToPremiumAverageRequestRatio: null,
        educatorSharePct: 0,
      },
    },
    plans,
  }
}

function createGameChallenge(gameType: GameType, difficulty: GameDifficulty, seed?: GameChallengeSeed | null): GameChallenge {
  const startedAt = Date.now()
  const id = `${gameType}-${startedAt}-${Math.random().toString(16).slice(2, 8)}`
  let data: any = {}
  let maxTimeMs = 120000

  if (gameType === 'math_speed') {
    data = {
      problems: Array.from({ length: 12 }, (_, index) => ({
        a: 3 + index,
        b: 2 + (index % 6),
        op: index % 2 === 0 ? '+' : 'x',
      })),
    }
    maxTimeMs = 60000
  }

  if (gameType === 'memory_tiles') {
    data = {
      gridSize: 4,
      rounds: [
        { count: 3, showTime: 1200 },
        { count: 4, showTime: 1100 },
        { count: 5, showTime: 1000 },
      ],
    }
    maxTimeMs = 45000
  }

  if (gameType === 'pattern_match') {
    data = {
      rounds: [
        { sequence: [2, 4, 6] },
        { sequence: [3, 6, 9] },
        { sequence: [1, 1, 2, 3] },
        { sequence: [5, 10, 15] },
      ],
    }
    maxTimeMs = 90000
  }

  if (gameType === 'reaction_time') {
    data = { rounds: 5 }
    maxTimeMs = 25000
  }

  if (gameType === 'word_scramble') {
    const defaultWords = ['AURA', 'FOCUS', 'MEMORY', 'LESSON', 'REVIEW', 'TASK']
    const seededWords = buildSeedWordPool(seed)
    const wordPool = seededWords.length >= 4 ? Array.from(new Set([...seededWords, ...defaultWords])) : defaultWords
    data = {
      words: wordPool.slice(0, 6).map((word) => scrambleWord(word)),
      seeded: seededWords.length > 0,
    }
    maxTimeMs = 120000
  }

  if (gameType === 'color_stroop') {
    data = {
      rounds: [
        { text: 'RED', displayColor: '#3b82f6' },
        { text: 'BLUE', displayColor: '#22c55e' },
        { text: 'GREEN', displayColor: '#ef4444' },
        { text: 'YELLOW', displayColor: '#f97316' },
        { text: 'ORANGE', displayColor: '#eab308' },
      ],
    }
    maxTimeMs = 45000
  }

  challengeRegistry.set(id, { gameType, difficulty, startedAt, maxTimeMs })
  return { id, gameType, difficulty, data, startedAt, maxTimeMs }
}

function buildGameLeaderboard(scores: GameScore[], days: number): DailyLeaderboard[] {
  const byDate = new Map<string, GameScore[]>()

  scores.forEach((score) => {
    const bucket = byDate.get(score.date) || []
    bucket.push(score)
    byDate.set(score.date, bucket)
  })

  return [...byDate.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, days)
    .map(([date, dayScores]) => {
      const byGame = new Map<GameType, GameScore[]>()
      dayScores.forEach((score) => {
        const bucket = byGame.get(score.gameType) || []
        bucket.push(score)
        byGame.set(score.gameType, bucket)
      })

      const entries = [...byGame.entries()].map(([gameType, items]) => ({
        gameType,
        bestScore: Math.max(...items.map((item) => item.score)),
        totalPoints: items.reduce((sum, item) => sum + Math.max(10, Math.round(item.score / 10)), 0),
      }))

      return {
        date,
        entries,
        totalDailyPoints: entries.reduce((sum, item) => sum + item.totalPoints, 0),
      }
    })
}

export function createBrowserAura(): AuraAPI {
  return {
    chat: {
      send: async (message: string) => {
        const trimmed = message.trim()
        if (!trimmed) return
        const reply = updateState((state) => {
          const createdAt = nowIso()
          state.messages.push({
            id: nextId(state, 'message'),
            role: 'user',
            content: trimmed,
            created_at: createdAt,
          })
          state.usage.chatMessageTimestamps.push(createdAt)
          state.motivation.wordsTyped += countWords(trimmed)
          state.motivation.xp += 5
          return buildChatReply(trimmed, state)
        })

        streamText('chat:token', reply)

        window.setTimeout(() => {
          updateState((state) => {
            state.messages.push({
              id: nextId(state, 'message'),
              role: 'assistant',
              content: reply,
              created_at: nowIso(),
            })
            hydrateMotivation(state)
          })
        }, 260)
      },
      onToken: (callback) => subscribe<ChatTokenEvent>('chat:token', callback),
      getHistory: async () => updateState((state) => clone(state.messages.slice(-60))),
      clearHistory: async () => {
        updateState((state) => {
          state.messages = []
        })
      },
    },
    tasks: {
      list: async () => updateState((state) => clone([...state.tasks].sort((left, right) => left.id - right.id))),
      add: async (text: string, priority = 'mid', parentId?: number | null) => updateState((state) => {
        const task: Task = {
          id: nextId(state, 'task'),
          text: text.trim(),
          done: false,
          priority: priority === 'high' || priority === 'low' ? priority : 'mid',
          parent_id: parentId ?? null,
          created_at: nowIso(),
          completed_at: null,
        }
        state.tasks.push(task)
        return clone(task)
      }),
      toggle: async (id: number) => {
        updateState((state) => {
          const task = state.tasks.find((item) => item.id === id)
          if (!task) return
          task.done = !task.done
          task.completed_at = task.done ? nowIso() : null
        })
      },
      remove: async (id: number) => {
        updateState((state) => {
          const descendants = new Set<number>([id])
          let changed = true
          while (changed) {
            changed = false
            for (const task of state.tasks) {
              if (task.parent_id !== null && descendants.has(task.parent_id) && !descendants.has(task.id)) {
                descendants.add(task.id)
                changed = true
              }
            }
          }
          state.tasks = state.tasks.filter((task) => !descendants.has(task.id))
        })
      },
    },
    ai: {
      status: async () => ({
        running: true,
        provider: 'deepseek',
        model: 'browser-fallback',
        hasClaude: true,
      } satisfies AIStatus),
    },
    claude: {
      setKey: async (key: string) => updateState((state) => {
        state.claudeKey = key.trim()
        return { ok: Boolean(state.claudeKey) }
      }),
      getKey: async () => updateState((state) => state.claudeKey),
    },
    groq: {
      setKey: async (key: string) => updateState((state) => {
        state.groqKey = key.trim()
        return { ok: Boolean(state.groqKey) }
      }),
      getKey: async () => updateState((state) => state.groqKey),
    },
    motivation: {
      getState: async () => updateState((state) => hydrateMotivation(state)),
      addXP: async (amount: number) => updateState((state) => {
        state.motivation.xp += Math.max(0, Math.floor(amount || 0))
        return hydrateMotivation(state)
      }),
      awardLessonCompletion: async (lessonId: number) => updateState((state) => {
        const lesson = state.lessons.find((item) => item.id === lessonId)
        if (!lesson) throw new Error('Lesson not found')

        if (!lesson.completed) {
          lesson.completed = true
          state.usage.lessonCompletionTimestamps.push(nowIso())
          state.motivation.xp += 45
          state.motivation.bonusXpEarned += 10
        }

        const reward = buildLessonReward(state, lessonId)
        state.motivation.lastLessonReward = reward
        hydrateMotivation(state)
        return clone(reward)
      }),
      updateStreak: async () => updateState((state) => {
        const today = localDayKey()
        const motivation = hydrateMotivation(state)
        if (!motivation.lastActive) {
          motivation.lastActive = today
          motivation.streak = 1
          motivation.welcomeBack = null
          return clone(motivation)
        }

        if (motivation.lastActive === today) {
          return clone(motivation)
        }

        const last = new Date(`${motivation.lastActive}T00:00:00`).getTime()
        const current = new Date(`${today}T00:00:00`).getTime()
        const gap = Math.round((current - last) / DAY_MS)
        if (gap === 1) {
          motivation.streak += 1
          motivation.welcomeBack = null
        } else if (gap > 1) {
          motivation.streak = 1
          motivation.welcomeBack = 'streak_reset'
        }
        motivation.lastActive = today
        state.motivation = motivation
        return clone(motivation)
      }),
      addMinutes: async (minutes: number) => updateState((state) => {
        state.motivation.minutesSpent += Math.max(0, Math.floor(minutes || 0))
        return hydrateMotivation(state)
      }),
      acknowledgeWelcomeBack: async () => updateState((state) => {
        state.motivation.welcomeBack = null
        return hydrateMotivation(state)
      }),
    },
    energy: {
      log: async (level: number) => {
        updateState((state) => {
          const date = localDayKey()
          state.energyLogs = state.energyLogs.filter((entry) => entry.date !== date)
          state.energyLogs.push({
            id: nextId(state, 'energy'),
            level,
            date,
            created_at: nowIso(),
          })
        })
      },
      getToday: async () => updateState((state) => {
        const today = localDayKey()
        const entry = [...state.energyLogs].reverse().find((item) => item.date === today)
        return entry?.level ?? null
      }),
    },
    profile: {
      get: async () => updateState((state) => clone(buildFallbackProfile(state.profile))),
      save: async (profile: UserProfile) => {
        updateState((state) => {
          state.profile = buildFallbackProfile(profile)
        })
      },
      resetAll: async () => {
        saveState(createDefaultState())
        return { ok: true }
      },
    },
    limits: {
      getState: async () => updateState((state) => buildTierSnapshot(state)),
    },
    educator: {
      getCourses: async () => updateState((state) => clone([...state.courses].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()))),
      getCourse: async (id: number) => updateState((state) => clone(state.courses.find((course) => course.id === id) || null)),
      getDueFlashcards: async () => updateState((state) => clone(state.flashcards.filter((card) => Date.parse(card.next_review) <= Date.now()))),
      getCourseFeedback: async (courseId: number) => updateState((state) => clone(state.feedback.find((item) => item.course_id === courseId) || null)),
      getCourseFeedbackAnalytics: async () => updateState((state) => {
        const items: CourseFeedbackAnalyticsItem[] = state.feedback.map((feedback) => {
          const course = state.courses.find((item) => item.id === feedback.course_id)
          return {
            ...feedback,
            course_title: course?.title || 'Unknown course',
            course_topic: course?.topic || 'unknown',
            course_status: course?.status || 'active',
            course_created_at: course?.created_at || feedback.created_at,
          }
        })
        const total = items.length || 1
        const average = (selector: (item: CourseFeedbackAnalyticsItem) => number) => Number((items.reduce((sum, item) => sum + selector(item), 0) / total).toFixed(1))
        const directionCounts: Record<CourseRecommendationDirection, number> = {
          reinforce: 0,
          practice: 0,
          advance: 0,
          adjacent: 0,
        }

        items.forEach((item) => {
          if (item.recommendation?.direction) {
            directionCounts[item.recommendation.direction] += 1
          }
        })

        const analytics: CourseFeedbackAnalytics = {
          total_completed_courses: state.courses.filter((course) => course.status === 'completed').length,
          total_feedback_records: items.length,
          missing_feedback_count: Math.max(0, state.courses.filter((course) => course.status === 'completed').length - items.length),
          average_overall_rating: items.length ? average((item) => item.overall_rating) : 0,
          average_clarity_rating: items.length ? average((item) => item.clarity_rating) : 0,
          average_retention_rating: items.length ? average((item) => item.retention_rating) : 0,
          average_difficulty_rating: items.length ? average((item) => item.difficulty_rating) : 0,
          average_continue_interest_rating: items.length ? average((item) => item.continue_interest_rating) : 0,
          direction_counts: directionCounts,
          needs_attention_count: items.filter((item) => item.overall_rating <= 6 || item.clarity_rating <= 6).length,
          ready_to_advance_count: items.filter((item) => (item.recommendation?.direction || '') === 'advance').length,
          items,
        }
        return clone(analytics)
      }),
      startCourseIntake: async (requestInput: string | CourseGenerationRequest) => updateState((state) => {
        const request = normalizeCourseRequest(requestInput)
        const createdAt = nowIso()
        const session: CourseIntakeSession = {
          id: nextId(state, 'intakeSession'),
          topic: request.topic,
          requested_familiarity: request.familiarity,
          status: 'collecting',
          questions: buildCourseIntakeQuestions(request.topic),
          summary: null,
          created_at: createdAt,
          updated_at: createdAt,
        }
        state.intakeSessions.push(session)
        return clone(session)
      }),
      continueCourseIntake: async (sessionId: number, requestInput: string | CourseGenerationRequest) => updateState((state) => {
        const request = normalizeCourseRequest(requestInput)
        const session = state.intakeSessions.find((item) => item.id === sessionId)
        if (!session) throw new Error('Intake session not found')

        session.status = 'ready'
        session.questions = []
        session.summary = request.intakeAnswers
          .filter((answer) => answer.answer.trim())
          .map((answer) => `${answer.question}: ${answer.answer.trim()}`)
          .join(' | ')
        session.updated_at = nowIso()
        return clone(session)
      }),
      prepareLesson: async (lessonId: number) => updateState((state) => clone(state.lessons.find((lesson) => lesson.id === lessonId) || null)),
      resetLessonRecall: async () => ({ ok: true }),
      generateCourse: async (requestInput: string | CourseGenerationRequest) => updateState((state) => {
        const request = normalizeCourseRequest(requestInput)
        const generated = buildCourseGraph(state, request.topic, request.familiarity)
        state.courses.unshift(generated.course)
        state.modules.push(...generated.modules)
        state.lessons.push(...generated.lessons)
        state.usage.courseGenerationTimestamps.push(nowIso())

        const events: CourseGenerationEvent[] = [
          {
            token: 'Mapping the course path... ',
            done: false,
            courseId: generated.course.id,
            jobId: generated.jobId,
            progress: 18,
            phase: 'roadmap',
            status: 'running',
          },
          {
            token: 'Building modules and lessons... ',
            done: false,
            courseId: generated.course.id,
            jobId: generated.jobId,
            progress: 62,
            phase: 'modules',
            status: 'running',
          },
          {
            token: 'Course ready. ',
            done: false,
            courseId: generated.course.id,
            jobId: generated.jobId,
            progress: 100,
            phase: 'completed',
            status: 'completed',
          },
        ]

        events.forEach((event, index) => {
          window.setTimeout(() => {
            emit<CourseGenerationEvent>('educator:courseGenToken', event)
            if (index === events.length - 1) {
              updateState((currentState) => {
                const course = currentState.courses.find((item) => item.id === generated.course.id)
                if (!course) return
                course.status = 'active'
                course.generation_status = 'completed'
                course.generation_phase = 'completed'
                course.generation_progress = 100
                course.generation_summary = 'Ready to open.'
                course.generation_updated_at = nowIso()
              })
              window.setTimeout(() => {
                emit<CourseGenerationEvent>('educator:courseGenToken', {
                  token: '',
                  done: true,
                  courseId: generated.course.id,
                  jobId: generated.jobId,
                  progress: 100,
                  phase: 'completed',
                  status: 'completed',
                })
              }, 60)
            }
          }, index * 180)
        })

        const result: CourseGenerationStartResult = {
          accepted: true,
          courseId: generated.course.id,
          jobId: generated.jobId,
          message: 'Course created in browser mode.',
        }
        return result
      }),
      retryCourseGeneration: async (courseId: number) => updateState((state) => {
        const course = state.courses.find((item) => item.id === courseId)
        if (!course) throw new Error('Course not found')
        course.status = 'active'
        course.generation_status = 'completed'
        course.generation_phase = 'completed'
        course.generation_progress = 100
        course.generation_error = null
        emit<CourseGenerationEvent>('educator:courseGenToken', {
          token: 'Course restarted successfully. ',
          done: false,
          courseId,
          progress: 100,
          phase: 'completed',
          status: 'completed',
        })
        window.setTimeout(() => {
          emit<CourseGenerationEvent>('educator:courseGenToken', {
            token: '',
            done: true,
            courseId,
            progress: 100,
            phase: 'completed',
            status: 'completed',
          })
        }, 40)
        return { accepted: true, courseId, message: 'Course is active again.' }
      }),
      submitCourseFeedback: async (courseId: number, feedback: CourseFeedbackSubmission, context?: CourseFeedbackContext | null) => updateState((state) => {
        const direction = pickCourseRecommendationDirection(feedback)
        const course = state.courses.find((item) => item.id === courseId)
        const existing = state.feedback.find((item) => item.course_id === courseId)
        const mergedContext = mergeFeedbackContextForCourse(courseId, existing?.context, context)
        const record: CourseFeedbackRecord = {
          id: existing?.id || nextId(state, 'feedback'),
          course_id: courseId,
          overall_rating: feedback.overall_rating,
          clarity_rating: feedback.clarity_rating,
          retention_rating: feedback.retention_rating,
          difficulty_rating: feedback.difficulty_rating,
          continue_interest_rating: feedback.continue_interest_rating,
          notes: feedback.notes || null,
          created_at: existing?.created_at || nowIso(),
          updated_at: nowIso(),
          recommendation: buildCourseRecommendation(course?.topic || 'the topic', direction),
          context: mergedContext,
        }
        state.feedback = state.feedback.filter((item) => item.course_id !== courseId)
        state.feedback.push(record)
        return clone(record)
      }),
      refineCourseRecommendation: async (courseId: number, context?: CourseFeedbackContext | null) => updateState((state) => {
        const feedback = state.feedback.find((item) => item.course_id === courseId)
        const course = state.courses.find((item) => item.id === courseId)
        if (!feedback || !course) throw new Error('Course feedback not found')
        const direction = pickCourseRecommendationDirection(feedback)
        feedback.context = mergeFeedbackContextForCourse(courseId, feedback.context, context)
        const recommendation = buildCourseRecommendation(course.topic, direction)
        feedback.recommendation = recommendation
        feedback.updated_at = nowIso()
        return clone(recommendation)
      }),
      onCourseGenToken: (callback) => subscribe<CourseGenerationEvent>('educator:courseGenToken', callback),
      explainLesson: async (lessonId: number) => {
        const lesson = updateState((state) => clone(state.lessons.find((item) => item.id === lessonId) || null))
        const text = lesson
          ? `Here is the short version of ${lesson.title}: focus on the key move, give one example, then say what mistake it prevents.`
          : 'The lesson is not available right now.'
        streamText('educator:lessonToken', text)
      },
      onLessonToken: (callback) => subscribe<ChatTokenEvent>('educator:lessonToken', callback),
      clarifyLesson: async (lessonId: number, question: string) => {
        const lesson = updateState((state) => clone(state.lessons.find((item) => item.id === lessonId) || null))
        const text = lesson
          ? `Clarify ${lesson.title}: ${question.trim() || 'Focus on the exact part that feels fuzzy, then restate it in plain language.'}`
          : question.trim() || 'Try asking the question in one short sentence.'
        streamText('educator:clarifyToken', text)
      },
      onClarifyToken: (callback) => subscribe<ChatTokenEvent>('educator:clarifyToken', callback),
      getModules: async (courseId: number) => updateState((state) => clone(state.modules.filter((module) => module.course_id === courseId).sort((left, right) => left.order_num - right.order_num))),
      getLessons: async (moduleId: number) => updateState((state) => clone(state.lessons.filter((lesson) => lesson.module_id === moduleId).sort((left, right) => left.order_num - right.order_num))),
      completeLesson: async (lessonId: number) => {
        updateState((state) => {
          const lesson = state.lessons.find((item) => item.id === lessonId)
          if (!lesson) return
          if (!lesson.completed) {
            lesson.completed = true
            state.usage.lessonCompletionTimestamps.push(nowIso())
          }
        })
      },
      completeModule: async (moduleId: number) => {
        updateState((state) => {
          const module = state.modules.find((item) => item.id === moduleId)
          if (!module) return
          module.completed = true
          const course = state.courses.find((item) => item.id === module.course_id)
          if (!course) return
          course.completed_modules = state.modules.filter((item) => item.course_id === course.id && item.completed).length
          const nextModule = state.modules
            .filter((item) => item.course_id === course.id && item.order_num > module.order_num)
            .sort((left, right) => left.order_num - right.order_num)[0]
          if (nextModule) nextModule.unlocked = true
          if (course.completed_modules >= course.total_modules) {
            course.status = 'completed'
          }
        })
      },
      deleteCourse: async (courseId: number) => {
        updateState((state) => {
          const moduleIds = new Set(state.modules.filter((module) => module.course_id === courseId).map((module) => module.id))
          state.courses = state.courses.filter((course) => course.id !== courseId)
          state.modules = state.modules.filter((module) => !moduleIds.has(module.id))
          state.lessons = state.lessons.filter((lesson) => !moduleIds.has(lesson.module_id))
          state.flashcards = state.flashcards.filter((card) => !moduleIds.has(card.module_id))
          state.feedback = state.feedback.filter((item) => item.course_id !== courseId)
        })
      },
      generateLessonQuiz: async (lessonId: number) => updateState((state) => {
        const lesson = state.lessons.find((item) => item.id === lessonId)
        if (!lesson) throw new Error('Lesson not found')
        return clone(buildQuiz(lesson))
      }),
      generateLessonPractice: async (lessonId: number) => updateState((state) => {
        const lesson = state.lessons.find((item) => item.id === lessonId)
        if (!lesson) throw new Error('Lesson not found')
        return clone(buildPractice(lesson))
      }),
      generateTeacherCheckpoint: async (lessonId: number, focus?: string) => updateState((state) => {
        const lesson = state.lessons.find((item) => item.id === lessonId)
        if (!lesson) throw new Error('Lesson not found')
        return clone(buildCheckpoint(lesson, focus))
      }),
      generateModuleCheckpoint: async (moduleId: number) => updateState((state) => {
        const module = state.modules.find((item) => item.id === moduleId)
        if (!module) throw new Error('Module not found')
        const lessons = state.lessons
          .filter((item) => item.module_id === moduleId)
          .sort((left, right) => left.order_num - right.order_num)
        if (lessons.length === 0) throw new Error('Module has no lessons')
        return clone(buildModuleCheckpoint(module, lessons))
      }),
      saveTeacherCheckpointFlashcards: async (lessonId: number, flashcards: TeacherCheckpointFlashcard[]) => updateState((state) => {
        const lesson = state.lessons.find((item) => item.id === lessonId)
        if (!lesson) throw new Error('Lesson not found')
        const module = state.modules.find((item) => item.id === lesson.module_id)
        const course = module ? state.courses.find((item) => item.id === module.course_id) : null

        let saved = 0
        let duplicates = 0
        flashcards.forEach((card) => {
          const exists = state.flashcards.some((item) => item.module_id === lesson.module_id && item.front === card.front && item.back === card.back)
          if (exists) {
            duplicates += 1
            return
          }
          state.flashcards.push({
            id: nextId(state, 'flashcard'),
            module_id: lesson.module_id,
            front: card.front,
            back: card.back,
            next_review: nowIso(),
            interval_days: 1,
            ease_factor: 2.5,
            repetitions: 0,
            created_at: nowIso(),
            module_title: module?.title,
            course_title: course?.title,
          })
          saved += 1
        })

        const result: FlashcardSaveResult = {
          attempted: flashcards.length,
          saved,
          duplicates,
          droppedByLimit: 0,
          limitReached: false,
          totalFlashcards: state.flashcards.length,
          remainingFlashcards: null,
        }
        return clone(result)
      }),
      reviewFlashcard: async (id: number, quality: number) => {
        updateState((state) => {
          const card = state.flashcards.find((item) => item.id === id)
          if (!card) return
          const nextInterval = quality >= 4 ? Math.max(1, Math.round(card.interval_days * 1.8)) : 1
          card.interval_days = nextInterval
          card.repetitions += 1
          card.next_review = new Date(Date.now() + nextInterval * DAY_MS).toISOString()
        })
        return { ok: true }
      },
    },
    voice: {
      getSettings: async () => updateState((state) => clone(state.voiceSettings)),
      saveSettings: async (settings) => {
        updateState((state) => {
          state.voiceSettings = { ...state.voiceSettings, ...settings }
        })
      },
    },
    games: {
      startChallenge: async (gameType: GameType, difficulty: GameDifficulty = 'normal', seed?: GameChallengeSeed | null) => createGameChallenge(gameType, difficulty, seed),
      submitResult: async (result: GameResult) => updateState((state) => {
        const meta = challengeRegistry.get(result.challengeId)
        const gameType = meta?.gameType || (result.challengeId.split('-')[0] as GameType)
        const score = Math.max(0, Math.floor(result.claimedScore || 0))
        const points = Math.max(10, Math.round(score / 10))
        const scoreRow: GameScore = {
          id: nextId(state, 'gameScore'),
          gameType,
          score,
          maxScore: Math.max(100, score),
          timeMs: meta ? Math.max(0, result.completedAt - meta.startedAt) : 0,
          date: localDayKey(),
          verified: true,
          created_at: nowIso(),
        }
        state.gameScores.push(scoreRow)
        state.gamePoints.total += points
        if (scoreRow.date === localDayKey()) {
          state.gamePoints.todayEarned += points
        }
        return { verified: true, score, points }
      }),
      getDailyScores: async () => updateState((state) => clone([...state.gameScores].sort((left, right) => right.created_at.localeCompare(left.created_at)))),
      getLeaderboard: async (days = 7) => updateState((state) => clone(buildGameLeaderboard(state.gameScores, days))),
      getPoints: async () => updateState((state) => clone(state.gamePoints)),
      redeemProDay: async () => updateState((state) => {
        const success = state.gamePoints.total >= 300
        if (success) {
          state.gamePoints.total -= 300
          state.gamePoints.proDaysRedeemed += 1
        }
        return { success, remaining: state.gamePoints.total }
      }),
    },
    sync: {
      getState: async () => updateState((state) => clone(state.syncState)),
      link: async (code: string) => updateState((state) => {
        const normalized = code.trim().toUpperCase()
        if (normalized.length < 4) {
          return { success: false, error: 'Enter a longer code.' }
        }
        state.syncState = {
          linked: true,
          linkCode: normalized,
          lastSync: null,
          syncStatus: 'success',
          webUsername: 'browser-user',
        }
        return { success: true, username: 'browser-user' }
      }),
      unlink: async () => {
        updateState((state) => {
          state.syncState = { ...DEFAULT_SYNC_STATE }
        })
      },
      syncNow: async () => updateState((state) => {
        state.syncState.lastSync = nowIso()
        state.syncState.syncStatus = 'success'
        return { success: true, merged: { xp: hydrateMotivation(state).xp } }
      }),
    },
    window: {
      minimize: () => undefined,
      close: () => undefined,
      toggleVisibility: () => undefined,
    },
    overlay: {
      setEnabled: async () => undefined,
      setSize: async () => undefined,
      onMessage: (callback) => subscribe<string>('overlay:chatMessage', callback),
    },
    memory: {
      list: async (kind?: MemoryKind) => updateState((state) => clone(kind ? state.memories.filter((item) => item.kind === kind) : state.memories)),
      add: async (content: string, kind: MemoryKind = 'episodic', tag?: string | null, importance = 3) => updateState((state) => {
        const text = content.trim()
        if (!text) return null
        const record: MemoryRecord = {
          id: nextId(state, 'memory'),
          content: text,
          kind,
          tag: tag || null,
          importance,
          last_recalled: null,
          created_at: nowIso(),
        }
        state.memories.unshift(record)
        return clone(record)
      }),
      remove: async (id: number) => {
        updateState((state) => {
          state.memories = state.memories.filter((item) => item.id !== id)
        })
        return { ok: true }
      },
      pickCallback: async () => updateState((state) => {
        const record = [...state.memories].sort((left, right) => right.importance - left.importance)[0] || null
        if (record) record.last_recalled = nowIso()
        return clone(record)
      }),
      decay: async () => {
        updateState((state) => {
          state.memories = state.memories.map((record) => ({
            ...record,
            importance: Math.max(1, record.importance - (record.kind === 'working' ? 1 : 0)),
          }))
        })
        return { ok: true }
      },
      semantic: async () => updateState((state) => clone([...state.memories].sort((left, right) => right.importance - left.importance).slice(0, 8))),
    },
  }
}