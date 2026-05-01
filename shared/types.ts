export interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  mood?: string
  created_at: string
}

export interface Task {
  id: number
  text: string
  done: boolean
  priority: 'low' | 'mid' | 'high'
  parent_id: number | null
  created_at: string
  completed_at: string | null
}

export interface EnergyLog {
  id: number
  level: number
  date: string
  created_at: string
}

export interface MotivationState {
  xp: number
  level: number
  streak: number
  lastActive: string
  badges: string[]
  weeklyXP: number[]
  graceDayUsed: boolean
  wordsTyped: number
  minutesSpent: number
  coursesCompleted: number
  completedLessons: number
  bonusXpEarned: number
  achievementLevels: {
    lessons: number
    courses: number
    words: number
    time: number
  }
  // --- Streak Forgiveness (1 auto-freeze per 7 days) ---
  freezesAvailable?: number          // 0 or 1, consumed when missing a day
  lastFreezeGrantDate?: string       // ISO date when a freeze was last auto-granted
  welcomeBack?: 'freeze_used' | 'streak_reset' | null  // transient flag shown once post-absence
  lastLessonReward?: LessonReward | null
}

export type AgeGroup = 'under16' | '16to25' | '25plus' | 'unknown'
export type QuickStartIntent = 'organize' | 'learn' | 'focus'
export type TierMode = 'free' | 'premium' | 'dev-unlimited'

export interface TierCapabilities {
  coursesPer2Hours: number | null
  coursesPerMonth: number | null
  chatMessagesPerDay: number | null
  lessonsPer2Hours: number | null
  lessonsPerMonth: number | null
  flashcardsTotal: number | null
  exportCoursePdf: boolean
}

export interface TierUsage {
  coursesCreatedLast2Hours: number
  coursesCreatedThisMonth: number
  chatMessagesToday: number
  lessonsStartedLast2Hours: number
  lessonsStartedThisMonth: number
  flashcardsTotal: number
}

export interface TierRemaining {
  coursesPer2Hours: number | null
  coursesPerMonth: number | null
  chatMessagesPerDay: number | null
  lessonsPer2Hours: number | null
  lessonsPerMonth: number | null
  flashcardsTotal: number | null
}

export interface TierNotes {
  courseCreation: string
  chatBudget: string
  lessons: string
  flashcards: string
  exportCoursePdf: string
}

export interface TierWindows {
  chatMessagesResetInMs: number | null
  courseWindowResetInMs: number | null
  lessonWindowResetInMs: number | null
}

export interface TokenTelemetryBucket {
  input: number
  output: number
  total: number
  requests: number
  averagePerRequest: number
}

export interface TokenTelemetrySourceBucket extends TokenTelemetryBucket {
  source: string
}

export interface TierTelemetryOptimization {
  currentTierTargetVsPremium: number | null
  freeTargetVsPremium: number
  freeToPremiumAverageRequestRatio: number | null
  educatorSharePct: number
}

export interface TierTelemetrySummary {
  total: TokenTelemetryBucket
  byTier: Record<TierMode, TokenTelemetryBucket>
  bySource: TokenTelemetrySourceBucket[]
  optimization: TierTelemetryOptimization
}

export interface TierPlanSnapshot {
  label: string
  note: string
  capabilities: TierCapabilities
}

export interface TierLimitSnapshot {
  tierMode: TierMode
  label: string
  capabilities: TierCapabilities
  usage: TierUsage
  remaining: TierRemaining
  notes: TierNotes
  windows: TierWindows
  telemetry: TierTelemetrySummary
  plans: Record<'free' | 'premium', TierPlanSnapshot>
}

export interface UserProfile {
  name: string
  hasADHD: boolean
  preferSoftMode: boolean
  selectedModel: string
  language: 'en' | 'ru' | 'ro'
  onboardingDone: boolean
  dopamineRewards: string[]
  ageGroup?: AgeGroup
  onboardingIntent?: QuickStartIntent
  onboardingQuickStartDone?: boolean
  orbEnabled?: boolean
  orbSize?: 'small' | 'medium' | 'large'
  tierMode?: TierMode
}

export interface AIStatus {
  running: boolean
  provider: 'groq' | 'claude' | 'deepseek'
  model: string
  hasClaude?: boolean
}

export interface ChatTokenEvent {
  token: string
  done: boolean
}

// --- Educator ---

export type CourseStatus = 'generating' | 'active' | 'completed' | 'paused' | 'failed'
export type CourseGenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed'
export type CourseGenerationPhase = 'queued' | 'roadmap' | 'modules' | 'finalizing' | 'completed' | 'failed'

export interface Course {
  id: number
  title: string
  description: string
  topic: string
  total_modules: number
  completed_modules: number
  status: CourseStatus
  generation_job_id?: number | null
  generation_status?: CourseGenerationJobStatus | null
  generation_phase?: CourseGenerationPhase | null
  generation_progress?: number | null
  generation_summary?: string | null
  generation_error?: string | null
  generation_updated_at?: string | null
  created_at: string
}

export interface Module {
  id: number
  course_id: number
  title: string
  order_num: number
  pass_threshold: number
  unlocked: boolean
  completed: boolean
  created_at: string
}

export interface Lesson {
  id: number
  module_id: number
  title: string
  content: string
  order_num: number
  completed: boolean
  created_at: string
}

export type CourseFamiliarity = 'new' | 'rusty' | 'comfortable' | 'strong' | 'unsure'

export interface CourseIntakeQuestion {
  id: string
  question: string
  placeholder?: string
}

export interface CourseIntakeAnswer {
  questionId: string
  question: string
  answer: string
}

export interface CourseIntakeSession {
  id: number
  topic: string
  requested_familiarity: CourseFamiliarity | null
  status: 'draft' | 'collecting' | 'ready' | 'submitted' | 'cancelled'
  questions: CourseIntakeQuestion[]
  summary?: string | null
  created_at: string
  updated_at: string
}

export interface CourseGenerationRequest {
  topic: string
  familiarity?: CourseFamiliarity
  intakeSessionId?: number
  intakeAnswers?: CourseIntakeAnswer[]
}

export type CourseRecommendationDirection = 'reinforce' | 'practice' | 'advance' | 'adjacent'

export interface CourseRecommendation {
  topic: string
  title: string
  reason: string
  direction: CourseRecommendationDirection
  confidence: number
  source?: 'heuristic' | 'ai'
}

export interface CourseReinforcementSummary {
  courseId: number
  totalGames: number
  verifiedGames: number
  totalPoints: number
  seededGames: number
  latestGameType?: GameType | null
}

export interface CourseFeedbackContext {
  reinforcementSummary?: CourseReinforcementSummary | null
}

export interface CourseFeedbackSubmission {
  overall_rating: number
  clarity_rating: number
  retention_rating: number
  difficulty_rating: number
  continue_interest_rating: number
  notes?: string | null
}

export interface CourseFeedbackRecord extends CourseFeedbackSubmission {
  id: number
  course_id: number
  notes: string | null
  created_at: string
  updated_at: string
  recommendation: CourseRecommendation | null
  context?: CourseFeedbackContext | null
}

export interface CourseFeedbackAnalyticsItem extends CourseFeedbackRecord {
  course_title: string
  course_topic: string
  course_status: CourseStatus
  course_created_at: string
}

export interface CourseFeedbackAnalytics {
  total_completed_courses: number
  total_feedback_records: number
  missing_feedback_count: number
  average_overall_rating: number
  average_clarity_rating: number
  average_retention_rating: number
  average_difficulty_rating: number
  average_continue_interest_rating: number
  direction_counts: Record<CourseRecommendationDirection, number>
  needs_attention_count: number
  ready_to_advance_count: number
  items: CourseFeedbackAnalyticsItem[]
}

export interface CourseGenerationJob {
  id: number
  course_id: number
  intake_session_id?: number | null
  topic: string
  familiarity: CourseFamiliarity | null
  status: CourseGenerationJobStatus
  phase: CourseGenerationPhase
  progress: number
  summary: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface CourseGenerationEvent extends ChatTokenEvent {
  courseId?: number
  jobId?: number
  progress?: number
  phase?: CourseGenerationPhase
  status?: CourseGenerationJobStatus
  message?: string
  error?: string
}

export interface CourseGenerationStartResult {
  accepted: boolean
  courseId?: number
  jobId?: number
  message?: string
}

export interface LessonQuizQuestion {
  question: string
  type: 'mcq' | 'text'
  options?: string[]
  correctAnswer: string
  hint: string
}

export type LessonPracticeKind = 'mcq' | 'short_text'
export type LessonPracticeDifficulty = 'core' | 'stretch'
export type LessonPracticeMode = 'default' | 'language-learning'

export interface LessonPracticeExercise {
  id: string
  kind: LessonPracticeKind
  difficulty: LessonPracticeDifficulty
  prompt: string
  options?: string[]
  correctAnswer: string
  acceptableAnswers?: string[]
  hint: string
  whyItMatters: string
  taskPrompt: string
  placeholder?: string
  contextCode?: string | null
}

export interface LessonPracticeSet {
  intro: string
  objective: string
  mode?: LessonPracticeMode
  modeLabel?: string | null
  recommendedGames?: GameType[]
  gameSeed?: GameChallengeSeed | null
  isCoding: boolean
  requiredToPass: number
  exercises: LessonPracticeExercise[]
}

export interface LessonReward {
  lessonId: number
  normalXp: number
  bonusXp: number
  totalXp: number
  completedLessons: number
  milestoneSize: number
  milestoneReached: boolean
  milestoneReachedAt: number | null
  nextMilestoneAt: number
  lessonsUntilNextMilestone: number
  milestoneLabel: string
  celebrationText: string
}

export interface BrainGameCompletion {
  gameType: GameType
  verified: boolean
  score: number
  points: number
  completedAt: number
}

export interface LessonPracticeGameLaunch {
  courseId: number
  lessonId: number
  gameType?: GameType
  gameSeed?: GameChallengeSeed | null
}

export interface LessonPracticeReinforcement extends BrainGameCompletion {
  lessonId: number
}

export interface Flashcard {
  id: number
  module_id: number
  front: string
  back: string
  next_review: string
  interval_days: number
  ease_factor: number
  repetitions: number
  created_at: string
  module_title?: string
  course_title?: string
}

export interface TeacherCheckpointQuestion {
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

export interface TeacherCheckpointFlashcard {
  front: string
  back: string
}

export interface TeacherCheckpoint {
  anchors: string[]
  questions: TeacherCheckpointQuestion[]
  flashcards: TeacherCheckpointFlashcard[]
}

export interface FlashcardSaveResult {
  attempted: number
  saved: number
  duplicates: number
  droppedByLimit: number
  limitReached: boolean
  totalFlashcards: number
  remainingFlashcards: number | null
}

// --- Brain Games (Anti-cheat) ---

export type GameType = 'math_speed' | 'memory_tiles' | 'pattern_match' | 'reaction_time' | 'word_scramble' | 'color_stroop'

export type GameDifficulty = 'normal' | 'x2' | 'x3' | 'x5'

export interface GameChallengeSeed {
  source?: 'lesson-practice'
  topic?: string | null
  targetLanguage?: string | null
  words?: string[]
  phrases?: string[]
}

export interface GameChallenge {
  id: string           // HMAC-signed challenge ID from main process
  gameType: GameType
  difficulty: GameDifficulty
  data: any            // Game-specific challenge data (generated server-side)
  startedAt: number    // Timestamp when challenge was issued
  maxTimeMs: number    // Maximum allowed time for this challenge
}

export interface GameAction {
  type: string         // Game-specific action type
  value: any           // Action payload
  timestamp: number    // When the action occurred
}

export interface GameResult {
  challengeId: string
  actions: GameAction[]  // Full action replay for verification
  claimedScore: number
  completedAt: number
}

export interface GameScore {
  id: number
  gameType: GameType
  score: number
  maxScore: number
  timeMs: number
  date: string
  verified: boolean    // Server-verified score
  created_at: string
}

export interface DailyLeaderboard {
  date: string
  entries: Array<{
    gameType: GameType
    bestScore: number
    totalPoints: number
  }>
  totalDailyPoints: number
}

export interface GamePoints {
  total: number
  todayEarned: number
  proDaysRedeemed: number
}

// --- Sync with Wisp+Flow ---

export interface SyncState {
  linked: boolean
  linkCode: string | null
  lastSync: string | null
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  webUsername: string | null
}

export interface VoiceSettings {
  ttsEnabled: boolean
  sttEnabled: boolean
  ttsRate: number
  ttsPitch: number
  ttsVolume: number
  language: string
  voiceName: string
}

export interface AuraAPI {
  chat: {
    send: (message: string) => Promise<void>
    onToken: (callback: (data: ChatTokenEvent) => void) => () => void
    getHistory: () => Promise<Message[]>
    clearHistory: () => Promise<void>
  }
  tasks: {
    list: () => Promise<Task[]>
    add: (text: string, priority?: string, parentId?: number | null) => Promise<Task>
    toggle: (id: number) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  ai: {
    status: () => Promise<AIStatus>
  }
  claude: {
    setKey: (key: string) => Promise<{ ok: boolean }>
    getKey: () => Promise<string>
  }
  groq: {
    setKey: (key: string) => Promise<{ ok: boolean }>
    getKey: () => Promise<string>
  }
  motivation: {
    getState: () => Promise<MotivationState>
    addXP: (amount: number) => Promise<MotivationState>
    awardLessonCompletion: (lessonId: number) => Promise<LessonReward>
    updateStreak: () => Promise<MotivationState>
    addMinutes: (minutes: number) => Promise<MotivationState>
    acknowledgeWelcomeBack: () => Promise<MotivationState>
  }
  energy: {
    log: (level: number) => Promise<void>
    getToday: () => Promise<number | null>
  }
  profile: {
    get: () => Promise<UserProfile | null>
    save: (profile: UserProfile) => Promise<void>
    resetAll: () => Promise<{ ok: boolean }>
  }
  limits: {
    getState: () => Promise<TierLimitSnapshot>
  }
  educator: {
    getCourses: () => Promise<Course[]>
    getCourse: (id: number) => Promise<Course | null>
    getDueFlashcards: () => Promise<Flashcard[]>
    getCourseFeedback: (courseId: number) => Promise<CourseFeedbackRecord | null>
    getCourseFeedbackAnalytics: () => Promise<CourseFeedbackAnalytics>
    startCourseIntake: (request: string | CourseGenerationRequest) => Promise<CourseIntakeSession>
    continueCourseIntake: (sessionId: number, request: string | CourseGenerationRequest) => Promise<CourseIntakeSession>
    prepareLesson: (lessonId: number) => Promise<Lesson | null>
    resetLessonRecall: (lessonId: number) => Promise<{ ok: boolean }>
    generateCourse: (request: string | CourseGenerationRequest) => Promise<CourseGenerationStartResult>
    retryCourseGeneration: (courseId: number) => Promise<CourseGenerationStartResult>
    submitCourseFeedback: (courseId: number, feedback: CourseFeedbackSubmission, context?: CourseFeedbackContext | null) => Promise<CourseFeedbackRecord>
    refineCourseRecommendation: (courseId: number, context?: CourseFeedbackContext | null) => Promise<CourseRecommendation>
    onCourseGenToken: (callback: (data: CourseGenerationEvent) => void) => () => void
    explainLesson: (lessonId: number) => Promise<void>
    onLessonToken: (callback: (data: ChatTokenEvent) => void) => () => void
    clarifyLesson: (lessonId: number, question: string, understandingScore?: number | null) => Promise<void>
    onClarifyToken: (callback: (data: ChatTokenEvent) => void) => () => void
    getModules: (courseId: number) => Promise<Module[]>
    getLessons: (moduleId: number) => Promise<Lesson[]>
    completeLesson: (lessonId: number) => Promise<void>
    completeModule: (moduleId: number) => Promise<void>
    deleteCourse: (courseId: number) => Promise<void>
    generateLessonQuiz: (lessonId: number) => Promise<LessonQuizQuestion[]>
    generateLessonPractice: (lessonId: number) => Promise<LessonPracticeSet>
    generateTeacherCheckpoint: (lessonId: number, focus?: string) => Promise<TeacherCheckpoint>
    generateModuleCheckpoint: (moduleId: number) => Promise<TeacherCheckpoint>
    saveTeacherCheckpointFlashcards: (lessonId: number, flashcards: TeacherCheckpointFlashcard[]) => Promise<FlashcardSaveResult>
    reviewFlashcard: (id: number, quality: number) => Promise<{ ok: boolean }>
  }
  voice: {
    getSettings: () => Promise<VoiceSettings>
    saveSettings: (settings: VoiceSettings) => Promise<void>
  }
  games: {
    startChallenge: (gameType: GameType, difficulty?: GameDifficulty, seed?: GameChallengeSeed | null) => Promise<GameChallenge>
    submitResult: (result: GameResult) => Promise<{ verified: boolean; score: number; points: number }>
    getDailyScores: () => Promise<GameScore[]>
    getLeaderboard: (days?: number) => Promise<DailyLeaderboard[]>
    getPoints: () => Promise<GamePoints>
    redeemProDay: () => Promise<{ success: boolean; remaining: number }>
  }
  sync: {
    getState: () => Promise<SyncState>
    link: (code: string) => Promise<{ success: boolean; username?: string; error?: string }>
    unlink: () => Promise<void>
    syncNow: () => Promise<{ success: boolean; merged?: any; error?: string }>
  }
  window: {
    minimize: () => void
    close: () => void
    toggleVisibility: () => void
  }
  overlay: {
    setEnabled: (enabled: boolean) => Promise<void>
    setSize: (size: string) => Promise<void>
    onMessage: (callback: (msg: string) => void) => () => void
  }
  memory: {
    list: (kind?: MemoryKind) => Promise<MemoryRecord[]>
    add: (content: string, kind?: MemoryKind, tag?: string | null, importance?: number) => Promise<MemoryRecord | null>
    remove: (id: number) => Promise<{ ok: boolean }>
    pickCallback: () => Promise<MemoryRecord | null>
    decay: () => Promise<{ ok: boolean }>
    semantic: () => Promise<MemoryRecord[]>
  }
}

// --- Memory ---

export type MemoryKind = 'working' | 'episodic' | 'semantic'

export interface MemoryRecord {
  id: number
  content: string
  kind: MemoryKind
  tag: string | null
  importance: number
  last_recalled: string | null
  created_at: string
}
