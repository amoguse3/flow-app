import { useState, useEffect, useRef, useCallback } from 'react'
import type { Course, CourseFeedbackRecord, CourseFeedbackSubmission, CourseFamiliarity, CourseIntakeQuestion, CourseIntakeSession, CourseReinforcementSummary, Module, Lesson, ChatTokenEvent, LessonReward, TeacherCheckpoint, LessonPracticeGameLaunch, LessonPracticeReinforcement } from '../../../../shared/types'
import { playBlip, playDing, playClick, playWhoosh } from '../lib/sounds'
import LessonSupportPanel from './LessonSupportPanel'
import LessonPractice from './LessonPractice'
import LessonRichText from './LessonRichText'

const PX = "'Press Start 2P', monospace"
const READING = "'Palatino Linotype', 'Book Antiqua', Georgia, serif"
const UI = "'Trebuchet MS', 'Segoe UI', sans-serif"
const SESSION_DURATION = 20 * 60 * 1000
const COOLDOWN_DURATION = 60 * 60 * 1000
const QUIZ_PASS_TARGET = 2
const TEACHER_TEXT_SCALE = 1.3
const LESSON_TEXT_SCALE = 0.5
const TEACHER_LIMIT_PREFIX = '[[AURA_LIMIT]]'

const COURSE_FAMILIARITY_OPTIONS: Array<{ code: CourseFamiliarity; label: string; note: string }> = [
  { code: 'new', label: 'NEW', note: 'start from zero' },
  { code: 'rusty', label: 'RUSTY', note: 'I saw it before' },
  { code: 'comfortable', label: 'COMFORTABLE', note: 'I know the basics' },
  { code: 'strong', label: 'STRONG', note: 'skip obvious basics' },
  { code: 'unsure', label: 'NOT SURE', note: 'deduce it for me' },
]

const tSize = (size: number) => Number((size * TEACHER_TEXT_SCALE).toFixed(1))
const lessonSize = (size: number) => Number((size * LESSON_TEXT_SCALE).toFixed(1))

function extractIntakeExamples(placeholder?: string): string[] {
  return String(placeholder || '')
    .replace(/^(example|exemplu|например)\s*:\s*/i, '')
    .split(',')
    .map((item) => item.replace(/\.\.\.$/, '').trim())
    .filter((item) => item.length >= 4)
    .slice(0, 4)
}

// ═════════════════════════════════════════════════════════════════════════════
// AURORA BOREALIS BACKGROUND
// ═════════════════════════════════════════════════════════════════════════════
function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #020808 0%, #040e08 40%, #060d0a 100%)' }} />
      <div className="absolute" style={{
        top: '-10%', left: '-20%', width: '140%', height: '60%',
        background: 'radial-gradient(ellipse at 50% 80%, rgba(40,200,120,0.12) 0%, rgba(20,140,80,0.06) 40%, transparent 70%)',
        animation: 'auroraDrift1 12s ease-in-out infinite', filter: 'blur(60px)',
      }} />
      <div className="absolute" style={{
        top: '5%', left: '-10%', width: '120%', height: '50%',
        background: 'radial-gradient(ellipse at 60% 70%, rgba(180,220,60,0.08) 0%, rgba(120,200,40,0.04) 40%, transparent 70%)',
        animation: 'auroraDrift2 16s ease-in-out infinite', filter: 'blur(80px)',
      }} />
      <div className="absolute" style={{
        top: '-5%', left: '10%', width: '100%', height: '45%',
        background: 'radial-gradient(ellipse at 40% 60%, rgba(200,180,40,0.07) 0%, rgba(160,140,20,0.03) 40%, transparent 70%)',
        animation: 'auroraDrift3 20s ease-in-out infinite', filter: 'blur(70px)',
      }} />
      <div className="absolute" style={{
        top: '8%', left: '15%', width: '70%', height: '35%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(80,220,120,0.04) 30%, rgba(160,200,40,0.03) 60%, transparent 100%)',
        animation: 'auroraShimmer 8s ease-in-out infinite', filter: 'blur(40px)',
      }} />
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="absolute rounded-full" style={{
          width: 1 + (i % 3), height: 1 + (i % 3),
          background: `rgba(200,220,180,${0.1 + (i % 5) * 0.06})`,
          left: `${(i * 37 + 13) % 100}%`, top: `${(i * 23 + 7) % 70}%`,
          animation: `starTwinkle ${3 + (i % 4)}s ease-in-out ${(i % 3) * 0.8}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes auroraDrift1 { 0%,100%{transform:translateX(0) translateY(0) scaleX(1);opacity:.7} 25%{transform:translateX(3%) translateY(-2%) scaleX(1.05);opacity:1} 50%{transform:translateX(-2%) translateY(1%) scaleX(.95);opacity:.8} 75%{transform:translateX(1%) translateY(-1%) scaleX(1.02);opacity:.9} }
        @keyframes auroraDrift2 { 0%,100%{transform:translateX(0) scaleY(1);opacity:.6} 33%{transform:translateX(-4%) scaleY(1.08);opacity:.9} 66%{transform:translateX(3%) scaleY(.92);opacity:.7} }
        @keyframes auroraDrift3 { 0%,100%{transform:translateX(2%) rotate(0);opacity:.5} 50%{transform:translateX(-3%) rotate(2deg);opacity:.8} }
        @keyframes auroraShimmer { 0%,100%{opacity:.3;transform:scaleX(1)} 50%{opacity:.7;transform:scaleX(1.1)} }
        @keyframes starTwinkle { 0%,100%{opacity:.15} 50%{opacity:.6} }
      `}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TEACHER ORB
// ═════════════════════════════════════════════════════════════════════════════
type TeacherMood = 'idle' | 'speaking' | 'thinking' | 'listening' | 'pleased'
const T_MOOD: Record<TeacherMood, { glow: string; anim: string; speed: string }> = {
  idle:      { glow: 'rgba(107,58,26,0.3)',  anim: 'orbBreathe', speed: '4s' },
  speaking:  { glow: 'rgba(139,94,60,0.35)', anim: 'orbSpeak',   speed: '0.8s' },
  thinking:  { glow: 'rgba(90,53,32,0.3)',   anim: 'orbSpin',    speed: '3s' },
  listening: { glow: 'rgba(155,74,42,0.35)', anim: 'orbBreathe', speed: '2s' },
  pleased:   { glow: 'rgba(160,112,58,0.35)', anim: 'orbBounce', speed: '1.5s' },
}

function TeacherOrbFace({ mood, speaking }: { mood: TeacherMood; speaking: boolean }) {
  const c = '#d4b896'
  const eL = mood === 'pleased' ? 'M32,38 Q36,33 40,38' : 'M32,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0'
  const eR = mood === 'pleased' ? 'M60,38 Q64,33 68,38' : 'M60,38 a4,4 0 1,1 8,0 a4,4 0 1,1 -8,0'
  const mouth = mood === 'speaking' ? 'M36,52 Q50,70 64,52'
    : mood === 'pleased' ? 'M38,54 Q50,68 62,54'
    : mood === 'thinking' ? 'M44,58 L56,58'
    : mood === 'listening' ? 'M44,58 a6,6 0 1,0 12,0'
    : 'M40,56 Q50,62 60,56'
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute z-20" style={{
      filter: `drop-shadow(0 0 8px ${c}40)`, animation: speaking ? 'faceSpeak 0.6s ease-in-out infinite' : undefined,
      imageRendering: 'pixelated',
    }} shapeRendering="crispEdges">
      <path d={eL} fill="none" stroke={`${c}cc`} strokeWidth={4} strokeLinecap="square"
        style={{ transition: 'all .8s', animation: mood === 'idle' ? 'eyeLook 4s ease-in-out infinite' : undefined }} />
      <path d={eR} fill="none" stroke={`${c}cc`} strokeWidth={4} strokeLinecap="square" style={{ transition: 'all .8s' }} />
      {mood === 'pleased' && <><circle cx="28" cy="46" r="5" fill={`${c}15`} /><circle cx="72" cy="46" r="5" fill={`${c}15`} /></>}
      <path d={mouth} fill={mood === 'speaking' ? `${c}30` : 'none'} stroke={`${c}aa`} strokeWidth={3.5} strokeLinecap="square"
        style={{ transition: 'all .8s', animation: speaking ? 'mouthTalk 0.4s ease-in-out infinite' : undefined }} />
      {mood === 'thinking' && <>
        <rect x="74" y="22" width="4" height="4" fill={`${c}50`} style={{ animation: 'thinkDot 1.5s ease-in-out infinite' }} />
        <rect x="80" y="16" width="5" height="5" fill={`${c}40`} style={{ animation: 'thinkDot 1.5s ease-in-out .3s infinite' }} />
        <rect x="84" y="8" width="6" height="6" fill={`${c}30`} style={{ animation: 'thinkDot 1.5s ease-in-out .6s infinite' }} />
      </>}
    </svg>
  )
}

function TeacherOrb({ mood, speaking, size = 140 }: { mood: TeacherMood; speaking: boolean; size?: number }) {
  const cfg = T_MOOD[mood]
  const activeAnim = speaking ? 'orbSpeak' : cfg.anim
  const bodySize = Math.round(size * 0.62)
  return (
    <div className="shrink-0 relative z-10" style={{ width: size, height: size }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute rounded-full" style={{
          width: size - 20, height: size - 20,
          background: 'rgba(140,90,40,0.12)', filter: 'blur(50px)',
          animation: 'orbPulse 4s ease-in-out infinite', opacity: 0.6,
        }} />
        <div className="relative rounded-full flex items-center justify-center" style={{
          width: bodySize, height: bodySize,
          background: `radial-gradient(circle at 40% 35%, rgba(180,130,80,0.85), rgba(120,70,30,0.6) 45%, rgba(50,25,10,0.4) 75%, rgba(20,10,5,0.2) 100%)`,
          boxShadow: `0 0 30px ${cfg.glow}, 0 0 60px rgba(140,90,40,0.15)`,
          animation: `${activeAnim} ${speaking ? '0.8s' : cfg.speed} ease-in-out infinite`, overflow: 'hidden',
        }}>
          <TeacherOrbFace mood={mood} speaking={speaking} />
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SESSION TIMER (compact)
// ═════════════════════════════════════════════════════════════════════════════
function SessionTimer({ startTime, onExpired }: { startTime: number; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(SESSION_DURATION)
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, SESSION_DURATION - (Date.now() - startTime))
      setRemaining(left)
      if (left === 0) onExpired()
    }, 1000)
    return () => clearInterval(t)
  }, [startTime, onExpired])
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const warn = remaining < 5 * 60 * 1000
  return (
    <span style={{
      fontFamily: PX, fontSize: 5, letterSpacing: '0.08em',
      color: warn ? 'rgba(239,160,60,0.6)' : 'rgba(40,180,120,0.4)',
    }}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// XP TOAST
// ═════════════════════════════════════════════════════════════════════════════
function XPToast({ amount, visible }: { amount: number; visible: boolean }) {
  if (!visible) return null
  return (
    <div className="absolute top-4 right-4 z-50" style={{ animation: 'xpFloat 1.5s ease-out forwards', pointerEvents: 'none' }}>
      <div style={{ fontFamily: PX, fontSize: 8, color: 'rgba(200,180,40,0.9)', textShadow: '0 0 12px rgba(200,180,40,0.3)' }}>+{amount} XP</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════
type Phase = 'pick-course' | 'learning' | 'session-end' | 'cooldown' | 'create-course' | 'course-feedback'
type BoardStep = 'idle' | 'explaining' | 'checkpoint' | 'done'
type RecallStage = 'hidden' | 'loading' | 'quiz' | 'flashcards' | 'practice' | 'passed' | 'failed'
type FeedbackField = 'overall_rating' | 'clarity_rating' | 'retention_rating' | 'difficulty_rating' | 'continue_interest_rating'

interface QuizFeedback {
  correct: boolean
  explanation: string
  correctAnswer: string
  score: number
}

type CheckpointPromptState = 'idle' | 'preparing' | 'ready'

interface Props {
  onClose: () => void
  initialCourseId?: number
  onOpenGames?: (launch: LessonPracticeGameLaunch) => void
  gameReinforcement?: LessonPracticeReinforcement | null
  courseReinforcementMap?: Record<number, CourseReinforcementSummary>
  onAcknowledgeGameReinforcement?: (reinforcement: LessonPracticeReinforcement) => void
}

function buildTeacherFeedbackDraft(record?: CourseFeedbackRecord | null): CourseFeedbackSubmission {
  return {
    overall_rating: record?.overall_rating ?? 8,
    clarity_rating: record?.clarity_rating ?? 8,
    retention_rating: record?.retention_rating ?? 7,
    difficulty_rating: record?.difficulty_rating ?? 6,
    continue_interest_rating: record?.continue_interest_rating ?? 8,
    notes: record?.notes ?? '',
  }
}

function clampCopy(value: unknown, fallback: string, max = 180): string {
  const next = String(value || '').replace(/\s+/g, ' ').trim()
  if (!next) return fallback
  return next.slice(0, max)
}

function stripDraftLessonText(value: string): string {
  return String(value || '')
    .replace('[[AURA_PENDING_LESSON]]', '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*(HOOK|CORE|PROVE IT|RECAP|CLIFFHANGER):\s*/gim, '')
    .replace(/^(Curs|Course):\s.*$/gim, '')
    .replace(/^(Modul|Module):\s.*$/gim, '')
    .replace(/^(Lecția|Lectia|Lesson)\s\d+:\s.*$/gim, '')
    .replace(/Conținutul complet se pregătește la prima deschidere, ca să păstrăm cursul rapid și eficient la cost\./gim, '')
    .replace(/The full content is prepared on first open to keep the course fast and cost-efficient\./gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function collectLessonMoments(lesson: Lesson, explanation: string): string[] {
  const clean = `${lesson.title}. ${stripDraftLessonText(lesson.content || '')} ${explanation || ''}`
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[•▪◦]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const unique: string[] = []
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    const next = sentence.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim()
    if (!next || next.length < 28) continue
    if (!unique.some((item) => item.toLowerCase() === next.toLowerCase())) {
      unique.push(next)
    }
    if (unique.length >= 4) break
  }

  if (unique.length === 0) {
    unique.push(`The core idea from ${lesson.title} is worth remembering clearly.`)
  }

  while (unique.length < 3) {
    unique.push(unique[unique.length - 1])
  }

  return unique.slice(0, 3)
}

function buildFallbackCheckpoint(lesson: Lesson, explanation: string): TeacherCheckpoint {
  const anchors = collectLessonMoments(lesson, explanation).map((anchor) => clampCopy(anchor, `The core idea from ${lesson.title}.`, 120))
  const prompts = [
    `What key idea supports the lesson ${lesson.title}?`,
    'What is worth locking in before moving on?',
    'Which phrasing preserves the lesson\'s meaning?',
  ]
  const distractors = [
    'Skip the practical example.',
    'Memorize without context.',
    'Ignore the key concept.',
    'Only retain small details.',
  ]

  return {
    anchors,
    questions: anchors.map((anchor, index) => ({
      question: clampCopy(prompts[index], 'What idea is worth locking in now?', 110),
      options: [
        anchor,
        distractors[index % distractors.length],
        distractors[(index + 1) % distractors.length],
        distractors[(index + 2) % distractors.length],
      ],
      correctAnswer: anchor,
      explanation: clampCopy(anchor, `This is the core idea from ${lesson.title}.`, 150),
    })),
    flashcards: anchors.map((anchor, index) => ({
      front: clampCopy(anchor.replace(/[.,!?]/g, '').split(/\s+/).slice(0, 6).join(' '), `Anchor ${index + 1}`, 56),
      back: clampCopy(anchor, `Remember the core idea from ${lesson.title}.`, 150),
    })),
  }
}

function ensureCheckpoint(data: TeacherCheckpoint | null | undefined, lesson: Lesson, explanation: string): TeacherCheckpoint {
  const fallback = buildFallbackCheckpoint(lesson, explanation)

  const anchors = Array.isArray(data?.anchors)
    ? data.anchors.map((anchor, index) => clampCopy(anchor, fallback.anchors[index] || fallback.anchors[0], 120)).filter(Boolean)
    : []
  while (anchors.length < 3) anchors.push(fallback.anchors[anchors.length])

  const questions = Array.isArray(data?.questions)
    ? data.questions.map((question, index) => {
        const base = fallback.questions[index] || fallback.questions[0]
        const options = Array.isArray(question?.options)
          ? question.options.map((option, optionIndex) => clampCopy(option, base.options[optionIndex] || base.options[0], 90)).filter(Boolean)
          : []

        while (options.length < 4) options.push(base.options[options.length])

        const correctAnswer = clampCopy(question?.correctAnswer, base.correctAnswer, 90)
        if (!options.some((option) => option.toLowerCase() === correctAnswer.toLowerCase())) {
          options[0] = correctAnswer
        }

        return {
          question: clampCopy(question?.question, base.question, 110),
          options: options.slice(0, 4),
          correctAnswer,
          explanation: clampCopy(question?.explanation, base.explanation, 160),
        }
      })
    : []
  while (questions.length < 3) questions.push(fallback.questions[questions.length])

  const flashcards = Array.isArray(data?.flashcards)
    ? data.flashcards.map((card, index) => {
        const base = fallback.flashcards[index] || fallback.flashcards[0]
        return {
          front: clampCopy(card?.front, base.front, 56),
          back: clampCopy(card?.back, base.back, 160),
        }
      })
    : []
  while (flashcards.length < 3) flashcards.push(fallback.flashcards[flashcards.length])

  return {
    anchors: anchors.slice(0, 3),
    questions: questions.slice(0, 3),
    flashcards: flashcards.slice(0, 3),
  }
}

type TeacherLessonBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'intro'; text: string }
  | { kind: 'body'; text: string }
  | { kind: 'callout'; text: string }
  | { kind: 'code'; text: string }

function looksLikeTeacherCallout(text: string): boolean {
  const normalized = text.toLowerCase()
  return /analogi|imagin|gândește|gandeste|intu|pe scurt|altfel spus|ca și cum|ca si cum|exemplu|think|as if|in short|analogy/.test(normalized)
}

function looksLikeTeacherCode(text: string): boolean {
  return /(?:const |let |function |return |def |class |=>|\{|\}|;)/.test(text) && /\n/.test(text)
}

function buildTeacherLessonBlocks(raw: string): TeacherLessonBlock[] {
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  let introUsed = false

  return paragraphs.map((paragraph, index) => {
    if (/^[─═-]/.test(paragraph)) {
      return { kind: 'heading', text: paragraph.replace(/[─═]/g, ' ').replace(/\s+/g, ' ').trim() }
    }

    if (looksLikeTeacherCode(paragraph)) {
      return { kind: 'code', text: paragraph }
    }

    if (!introUsed) {
      introUsed = true
      return { kind: 'intro', text: paragraph }
    }

    if (looksLikeTeacherCallout(paragraph) || (index === paragraphs.length - 1 && paragraphs.length > 2)) {
      return { kind: 'callout', text: paragraph }
    }

    return { kind: 'body', text: paragraph }
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN — LESSON BOARD (no chat, teacher writes on the board)
// ═════════════════════════════════════════════════════════════════════════════
export default function TeacherMode({ onClose, initialCourseId, onOpenGames, gameReinforcement, courseReinforcementMap, onAcknowledgeGameReinforcement }: Props) {
  // ─── State ──────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [phase, setPhase] = useState<Phase>('pick-course')

  // Session
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('aura_teacher_cooldown')
    if (saved) { const end = parseInt(saved, 10); if (end > Date.now()) return end }
    return null
  })

  // Board content (what the teacher writes)
  const [boardText, setBoardText] = useState('')          // accumulated full text
  const [streamText, setStreamText] = useState('')         // currently streaming
  const [boardStep, setBoardStep] = useState<BoardStep>('idle')
  const [teacherMood, setTeacherMood] = useState<TeacherMood>('idle')
  const [isTyping, setIsTyping] = useState(false)
  const [recallStage, setRecallStage] = useState<RecallStage>('hidden')
  const [checkpointPromptState, setCheckpointPromptState] = useState<CheckpointPromptState>('idle')
  const [checkpoint, setCheckpoint] = useState<TeacherCheckpoint | null>(null)
  const [keyMoments, setKeyMoments] = useState<string[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState('')
  const [quizScore, setQuizScore] = useState(0)
  const [quizFeedback, setQuizFeedback] = useState<QuizFeedback | null>(null)
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flashcardFlipped, setFlashcardFlipped] = useState(false)
  const [flashcardHovered, setFlashcardHovered] = useState(false)
  const [lessonReward, setLessonReward] = useState<LessonReward | null>(null)
  const [practiceUnlocked, setPracticeUnlocked] = useState(false)
  const [understandingScore, setUnderstandingScore] = useState<number | null>(null)
  const [readingConfirmed, setReadingConfirmed] = useState(false)
  const [boardHasLimitNotice, setBoardHasLimitNotice] = useState(false)
  const [memoryExpanded, setMemoryExpanded] = useState(() => {
    const saved = localStorage.getItem('aura_teacher_memory_expanded')
    return saved === null ? true : saved === '1'
  })
  const boardEndRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const lessonStreamRef = useRef('')
  const lessonFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lessonFallbackUsedRef = useRef(false)
  const savedMemoryLessonsRef = useRef<Set<number>>(new Set())

  // Teaching refs
  const boardStepRef = useRef<BoardStep>('idle')
  const lessonQueueRef = useRef<Lesson[]>([])
  const selectedLessonRef = useRef<Lesson | null>(null)
  const selectedModuleRef = useRef<Module | null>(null)
  const initialCourseOpenedRef = useRef(false)
  const [lessonProgress, setLessonProgress] = useState({ current: 0, total: 0 })



  // XP
  const [xpToast, setXpToast] = useState<{ amount: number; key: number } | null>(null)
  const [totalXP, setTotalXP] = useState(0)

  // Course creation
  const [newCourseTopic, setNewCourseTopic] = useState('')
  const [newCourseFamiliarity, setNewCourseFamiliarity] = useState<CourseFamiliarity>('unsure')
  const [intakeSession, setIntakeSession] = useState<CourseIntakeSession | null>(null)
  const [intakeQuestionHistory, setIntakeQuestionHistory] = useState<CourseIntakeQuestion[]>([])
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({})
  const [isPreparingIntake, setIsPreparingIntake] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState('')
  const [retryingCourseId, setRetryingCourseId] = useState<number | null>(null)
  const [courseFeedbackRecord, setCourseFeedbackRecord] = useState<CourseFeedbackRecord | null>(null)
  const [courseFeedbackDraft, setCourseFeedbackDraft] = useState<CourseFeedbackSubmission>(() => buildTeacherFeedbackDraft())
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [recommendationError, setRecommendationError] = useState<string | null>(null)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [refiningRecommendation, setRefiningRecommendation] = useState(false)
  const courseReinforcement = (selectedCourse?.id ? courseReinforcementMap?.[selectedCourse.id] : null) || courseFeedbackRecord?.context?.reinforcementSummary || null
  const reinforcementSummaryText = courseReinforcement
    ? `${courseReinforcement.verifiedGames}/${courseReinforcement.totalGames} verified game loops · +${courseReinforcement.totalPoints} points${courseReinforcement.seededGames > 0 ? ` · ${courseReinforcement.seededGames} lesson-seeded` : ''}`
    : null

  // ─── Refs sync ──────────────────────────────────────────────────────────
  const updateStep = (s: BoardStep) => { boardStepRef.current = s; setBoardStep(s) }
  const clearLessonFallbackTimer = () => {
    if (lessonFallbackTimerRef.current) {
      clearTimeout(lessonFallbackTimerRef.current)
      lessonFallbackTimerRef.current = null
    }
  }

  useEffect(() => {
    localStorage.setItem('aura_teacher_memory_expanded', memoryExpanded ? '1' : '0')
  }, [memoryExpanded])

  // ─── Helpers ────────────────────────────────────────────────────────────
  const showXP = (amount: number) => {
    setTotalXP(p => p + amount)
    setXpToast({ amount, key: Date.now() })
    playDing()
    setTimeout(() => setXpToast(null), 1600)
  }
  const startSession = () => { setSessionStart(Date.now()); playWhoosh() }
  const loadVisibleCourses = useCallback(async () => {
    const nextCourses = await window.aura.educator.getCourses()
    const visible = nextCourses.filter((course: Course) => course.status === 'active' || course.status === 'generating' || course.status === 'failed')
    setCourses(visible)

    if (!initialCourseId || initialCourseOpenedRef.current) return
    const target = visible.find((course: Course) => course.id === initialCourseId && course.status === 'active')
    if (!target) return

    initialCourseOpenedRef.current = true
    setSelectedCourse(target)
    loadCourseModules(target)
  }, [initialCourseId])

  const resetCourseFeedbackState = () => {
    setCourseFeedbackRecord(null)
    setCourseFeedbackDraft(buildTeacherFeedbackDraft())
    setFeedbackError(null)
    setRecommendationError(null)
    setSubmittingFeedback(false)
    setRefiningRecommendation(false)
  }

  const openCourseFeedbackPhase = async (courseId: number) => {
    const [nextCourse, feedback] = await Promise.all([
      window.aura.educator.getCourse(courseId),
      window.aura.educator.getCourseFeedback(courseId),
    ])
    if (!nextCourse) return

    setSelectedCourse(nextCourse)
    setCourseFeedbackRecord(feedback)
    setCourseFeedbackDraft(buildTeacherFeedbackDraft(feedback))
    setFeedbackError(null)
    setRecommendationError(null)
    setSessionStart(null)
    setPhase('course-feedback')
  }

  const handleSessionExpired = useCallback(() => {
    const end = Date.now() + COOLDOWN_DURATION
    setCooldownEnd(end)
    sessionStorage.setItem('aura_teacher_cooldown', String(end))
    setSessionStart(null)
    setPhase('session-end')
  }, [])

  const resetCheckpoint = () => {
    setRecallStage('hidden')
    setCheckpointPromptState('idle')
    setCheckpoint(null)
    setLessonReward(null)
    setPracticeUnlocked(false)
    setUnderstandingScore(null)
    setReadingConfirmed(false)
    setBoardHasLimitNotice(false)
    setQuestionIndex(0)
    setSelectedOption('')
    setQuizScore(0)
    setQuizFeedback(null)
    setFlashcardIndex(0)
    setFlashcardFlipped(false)
    setFlashcardHovered(false)
  }

  const setBoardSnapshot = (text: string) => {
    setBoardText(text)
    if (selectedModuleRef.current) {
      localStorage.setItem(`aura_board_${selectedModuleRef.current.id}`, text)
    }
  }

  const appendBoard = (text: string) => {
    setBoardText(prev => {
      const next = prev + (prev ? '\n\n' : '') + text
      if (selectedModuleRef.current) {
        localStorage.setItem(`aura_board_${selectedModuleRef.current.id}`, next)
      }
      return next
    })
  }

  const prepareTeacherLesson = async (lesson: Lesson): Promise<Lesson> => {
    const readyLesson = await window.aura.educator.prepareLesson(lesson.id)
    if (!readyLesson) return lesson

    setLessons(prev => prev.map(item => item.id === readyLesson.id ? readyLesson : item))
    lessonQueueRef.current = lessonQueueRef.current.map(item => item.id === readyLesson.id ? readyLesson : item)

    if (selectedLessonRef.current?.id === readyLesson.id) {
      selectedLessonRef.current = readyLesson
    }

    return readyLesson
  }

  // ─── Load courses ──────────────────────────────────────────────────────
  useEffect(() => {
    loadVisibleCourses()
    const unsubscribe = window.aura.educator.onCourseGenToken((event) => {
      if (event.courseId || event.done) {
        loadVisibleCourses().catch(() => null)
      }
    })
    return unsubscribe
  }, [loadVisibleCourses])

  const loadCourseModules = async (course: Course) => {
    const mods = await window.aura.educator.getModules(course.id)
    setModules(mods)
    const nextMod = mods.find((m: Module) => m.unlocked && !m.completed) || mods[0]
    if (nextMod) {
      setSelectedModule(nextMod)
      selectedModuleRef.current = nextMod
      const ls = await window.aura.educator.getLessons(nextMod.id)
      setLessons(ls)
      const remaining = ls.filter((l: Lesson) => !l.completed)
      lessonQueueRef.current = [...remaining]
      setLessonProgress({ current: ls.length - remaining.length, total: ls.length })
      // Restore saved board text for this module
      const saved = localStorage.getItem(`aura_board_${nextMod.id}`)
      setBoardText(saved || '')
      setKeyMoments([])
      resetCheckpoint()
      setPhase('learning')
      if (!sessionStart) startSession()
      if (remaining.length > 0) {
        selectedLessonRef.current = remaining[0]
        setTimeout(() => teachLesson(remaining[0]), 600)
      } else {
        setTimeout(() => finishModule(), 600)
      }
    }
  }

  // ─── Token subscription ────────────────────────────────────────────────
  useEffect(() => {
    unsubRef.current = window.aura.educator.onLessonToken((data: ChatTokenEvent) => {
      if (data.done) {
        clearLessonFallbackTimer()
        const finalText = `${lessonStreamRef.current}${data.token || ''}`.trim()
        const isLimitMessage = finalText.startsWith(TEACHER_LIMIT_PREFIX)
        const cleanedText = isLimitMessage
          ? finalText.replace(TEACHER_LIMIT_PREFIX, '').trim()
          : finalText
        lessonStreamRef.current = ''
        setIsTyping(false)
        setStreamText('')
        if (lessonFallbackUsedRef.current) {
          lessonFallbackUsedRef.current = false
          return
        }
        if (cleanedText) appendBoard(cleanedText)

        if (isLimitMessage) {
          setBoardHasLimitNotice(true)
          setReadingConfirmed(false)
          setCheckpointPromptState('idle')
          setRecallStage('hidden')
          setTeacherMood('thinking')
          return
        }

        setBoardHasLimitNotice(false)

        const step = boardStepRef.current
        if (step === 'explaining') {
          const lesson = selectedLessonRef.current
          if (lesson) {
            setTeacherMood('pleased')
            setTimeout(() => setTeacherMood('idle'), 900)
            setTimeout(() => prepareCheckpoint(lesson, cleanedText), 900)
          }
        }
      } else {
        if (lessonFallbackUsedRef.current) return
        lessonStreamRef.current += data.token || ''
        setStreamText(lessonStreamRef.current)
      }
    })
    return () => {
      unsubRef.current?.()
      clearLessonFallbackTimer()
    }
  }, [])

  // Auto-scroll board
  useEffect(() => { boardEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [boardText, streamText])

  const prepareCheckpoint = async (lesson: Lesson, explanation: string) => {
    updateStep('checkpoint')
    setCheckpointPromptState('preparing')
    setTeacherMood('thinking')

    let nextCheckpoint = buildFallbackCheckpoint(lesson, explanation)
    try {
      const response = await window.aura.educator.generateTeacherCheckpoint(lesson.id)
      nextCheckpoint = ensureCheckpoint(response, lesson, explanation)
    } catch {
      nextCheckpoint = buildFallbackCheckpoint(lesson, explanation)
    }

    if (selectedLessonRef.current?.id !== lesson.id) return

    setCheckpoint(nextCheckpoint)
    setKeyMoments(nextCheckpoint.anchors)
    window.aura.educator.saveTeacherCheckpointFlashcards(lesson.id, nextCheckpoint.flashcards).catch(() => null)

    if (!savedMemoryLessonsRef.current.has(lesson.id)) {
      savedMemoryLessonsRef.current.add(lesson.id)
      window.aura.memory.add(`${lesson.title}: ${nextCheckpoint.anchors.join(' · ')}`, 'working', 'learning', 4).catch(() => null)
    }

    setQuestionIndex(0)
    setSelectedOption('')
    setQuizScore(0)
    setQuizFeedback(null)
    setFlashcardIndex(0)
    setFlashcardFlipped(false)
    setFlashcardHovered(false)
    setRecallStage('hidden')
    setCheckpointPromptState('ready')
    setTeacherMood('idle')
  }

  const startCheckpoint = () => {
    if (checkpointPromptState !== 'ready' || !checkpoint || understandingScore === null || understandingScore < 7) return
    playClick()
    setCheckpointPromptState('idle')
    setRecallStage('quiz')
    setTeacherMood('listening')
  }

  const openPractice = () => {
    setPracticeUnlocked(true)
    setRecallStage('practice')
    setTeacherMood('pleased')
  }

  // ─── Teach a lesson (teacher writes on the board) ─────────────────────
  const teachLesson = async (lesson: Lesson) => {
    updateStep('explaining')
    resetCheckpoint()
    setKeyMoments([])
    selectedLessonRef.current = lesson
    setBoardSnapshot(`── ${lesson.title} ──`)
    playBlip()
    setIsTyping(true)
    clearLessonFallbackTimer()
    lessonFallbackUsedRef.current = false
    lessonStreamRef.current = ''
    setStreamText('')
    setUnderstandingScore(null)
    setTeacherMood('thinking')
    setBoardHasLimitNotice(false)
    selectedLessonRef.current = lesson

    await window.aura.educator.explainLesson(lesson.id)
  }

  const submitQuizOption = () => {
    const activeQuestion = checkpoint?.questions[questionIndex]
    if (!activeQuestion || !selectedOption || quizFeedback) return

    const correct = selectedOption === activeQuestion.correctAnswer
    const nextScore = quizScore + (correct ? 1 : 0)

    setQuizScore(nextScore)
    setQuizFeedback({
      correct,
      explanation: activeQuestion.explanation,
      correctAnswer: activeQuestion.correctAnswer,
      score: nextScore,
    })
    setTeacherMood(correct ? 'pleased' : 'thinking')
    if (correct) playDing()
    else playBlip()
  }

  const continueQuiz = () => {
    if (!checkpoint || !quizFeedback) return

    if (questionIndex + 1 >= checkpoint.questions.length) {
      if (quizFeedback.score >= QUIZ_PASS_TARGET) {
        setRecallStage('flashcards')
        setFlashcardIndex(0)
        setFlashcardFlipped(false)
        setFlashcardHovered(false)
        setQuizFeedback(null)
        setSelectedOption('')
        setTeacherMood('pleased')
      } else {
        setRecallStage('failed')
        setTeacherMood('thinking')
      }
      return
    }

    setQuestionIndex(prev => prev + 1)
    setSelectedOption('')
    setQuizFeedback(null)
    setTeacherMood('listening')
  }

  const completeFlashcards = () => {
    openPractice()
  }

  const advanceFlashcard = () => {
    if (!checkpoint) return
    playClick()
    if (flashcardIndex + 1 >= checkpoint.flashcards.length) {
      completeFlashcards()
      return
    }
    setFlashcardIndex(prev => prev + 1)
    setFlashcardFlipped(false)
    setFlashcardHovered(false)
  }

  const retryLesson = async () => {
    const lesson = selectedLessonRef.current
    if (!lesson) return
    resetCheckpoint()
    setKeyMoments([])
    setBoardSnapshot('')
    setStreamText('')
    try {
      await window.aura.educator.resetLessonRecall(lesson.id)
    } catch {
      // Fresh checkpoint generation is best-effort.
    }
    setTimeout(() => teachLesson(lesson), 250)
  }

  const continueAfterCheckpoint = () => {
    resetCheckpoint()
    setKeyMoments([])
    advanceToNext()
  }

  // ─── Advance to next lesson ────────────────────────────────────────────
  const advanceToNext = () => {
    resetCheckpoint()
    const queue = lessonQueueRef.current
    if (queue.length > 0) {
      queue.shift()
      lessonQueueRef.current = queue
      setLessonProgress(p => ({ ...p, current: p.total - queue.length }))
    }
    if (queue.length > 0) {
      selectedLessonRef.current = queue[0]
      setTimeout(() => teachLesson(queue[0]), 1200)
    } else {
      setTimeout(() => finishModule(), 1200)
    }
  }

  // ─── Finish module (all lessons done) ──────────────────────────────────
  const finishModule = async () => {
    resetCheckpoint()
    setKeyMoments([])
    const mod = selectedModuleRef.current
    if (mod) {
      try { await window.aura.educator.completeModule(mod.id) } catch { /* ignore */ }
    }
    try { await window.aura.motivation.addXP(50) } catch { /* ignore */ }
    showXP(50)
    appendBoard('\nWell done! You finished all lessons in this module.')
    setTeacherMood('pleased')

    // Auto-advance to next module
    if (selectedCourse) {
      const mods = await window.aura.educator.getModules(selectedCourse.id)
      setModules(mods)
      const nextMod = mods.find((m: Module) => m.unlocked && !m.completed)
      if (nextMod) {
        appendBoard(`\nMoving to the next module: ${nextMod.title}`)
        setTimeout(async () => {
          setSelectedModule(nextMod)
          selectedModuleRef.current = nextMod
          const ls = await window.aura.educator.getLessons(nextMod.id)
          setLessons(ls)
          const remaining = ls.filter((l: Lesson) => !l.completed)
          lessonQueueRef.current = [...remaining]
          setLessonProgress({ current: ls.length - remaining.length, total: ls.length })
          const saved = localStorage.getItem(`aura_board_${nextMod.id}`)
          setBoardText(saved || '')
          if (remaining.length > 0) {
            selectedLessonRef.current = remaining[0]
            setTimeout(() => teachLesson(remaining[0]), 600)
          } else {
            updateStep('done')
          }
        }, 3000)
      } else {
        appendBoard('\nCongratulations! You finished the entire course! 🎉')
        updateStep('done')
        await loadVisibleCourses()
        await openCourseFeedbackPhase(selectedCourse.id)
        return
      }
    } else {
      updateStep('done')
    }
  }

  const updateCourseFeedbackField = (field: FeedbackField, value: number) => {
    setCourseFeedbackDraft((prev) => ({ ...prev, [field]: value }))
    setFeedbackError(null)
  }

  const submitCourseFeedback = async () => {
    if (!selectedCourse || submittingFeedback) return

    setSubmittingFeedback(true)
    setFeedbackError(null)
    setRecommendationError(null)
    try {
      const saved = await window.aura.educator.submitCourseFeedback(
        selectedCourse.id,
        courseFeedbackDraft,
        courseReinforcement ? { reinforcementSummary: courseReinforcement } : null,
      )
      setCourseFeedbackRecord(saved)
      setCourseFeedbackDraft(buildTeacherFeedbackDraft(saved))
    } catch (error: any) {
      setFeedbackError(String(error?.message || 'Could not save course feedback.'))
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const refineCourseRecommendation = async () => {
    if (!selectedCourse || !courseFeedbackRecord || refiningRecommendation) return

    setRefiningRecommendation(true)
    setRecommendationError(null)
    try {
      const recommendation = await window.aura.educator.refineCourseRecommendation(
        selectedCourse.id,
        courseReinforcement ? { reinforcementSummary: courseReinforcement } : null,
      )
      setCourseFeedbackRecord((prev) => prev ? {
        ...prev,
        recommendation,
        context: courseReinforcement ? { reinforcementSummary: courseReinforcement } : (prev.context || null),
      } : prev)
    } catch (error: any) {
      setRecommendationError(String(error?.message || 'Could not refine the recommendation right now.'))
    } finally {
      setRefiningRecommendation(false)
    }
  }

  const startSuggestedTeacherCourse = () => {
    const nextTopic = courseFeedbackRecord?.recommendation?.topic?.trim()
    if (!nextTopic) return

    setNewCourseTopic(nextTopic)
    setNewCourseFamiliarity('unsure')
    setIntakeSession(null)
    setIntakeQuestionHistory([])
    setIntakeAnswers({})
    setGenStatus('')
    resetCheckpoint()
    resetCourseFeedbackState()
    setSelectedCourse(null)
    setSelectedModule(null)
    setLessons([])
    setBoardText('')
    setKeyMoments([])
    setPhase('create-course')
    playClick()
  }

  const mergeIntakeQuestions = (questions: CourseIntakeQuestion[]) => {
    setIntakeQuestionHistory((prev) => {
      const seen = new Set(prev.map((question) => question.id))
      const next = [...prev]
      for (const question of questions) {
        if (seen.has(question.id)) continue
        seen.add(question.id)
        next.push(question)
      }
      return next
    })
  }

  const buildIntakeAnswerPayload = () => intakeQuestionHistory.map((question) => ({
    questionId: question.id,
    question: question.question,
    answer: intakeAnswers[question.id] || '',
  }))

  const applyIntakeExample = (questionId: string, example: string) => {
    setIntakeAnswers((prev) => {
      const current = (prev[questionId] || '').trim()
      if (!current) {
        return { ...prev, [questionId]: example }
      }
      if (current.toLowerCase().includes(example.toLowerCase())) {
        return prev
      }
      const separator = /[.!?]$/.test(current) ? ' ' : '; '
      return { ...prev, [questionId]: `${current}${separator}${example}` }
    })
  }

  const teacherIntakeReady = intakeSession?.status === 'ready'
  const currentTeacherIntakeComplete = !!intakeSession && intakeSession.questions.every((question) => Boolean((intakeAnswers[question.id] || '').trim()))

  // ─── Generate course ──────────────────────────────────────────────────
  const handleGenerateCourse = async () => {
    if (!newCourseTopic.trim() || isGenerating || (intakeSession && !teacherIntakeReady)) return
    setIsGenerating(true); setGenStatus('Generating course...')
    try {
      const result = await window.aura.educator.generateCourse({
        topic: newCourseTopic.trim(),
        familiarity: newCourseFamiliarity,
        intakeSessionId: intakeSession?.id,
        intakeAnswers: buildIntakeAnswerPayload(),
      })
      if (!result.accepted) {
        setGenStatus(result.message || 'Error. Try again.')
        setIsGenerating(false)
        return
      }

      await loadVisibleCourses()
      setNewCourseTopic(''); setNewCourseFamiliarity('unsure'); setIntakeSession(null); setIntakeQuestionHistory([]); setIntakeAnswers({}); setPhase('pick-course'); playDing()
      setGenStatus('Growing in background...')
    } catch { setGenStatus('Error. Try again.') }
    setIsGenerating(false)
  }

  const handleStartCourseIntake = async () => {
    if (!newCourseTopic.trim() || isGenerating || isPreparingIntake) return
    setIsPreparingIntake(true)
    setGenStatus('Preparing questions...')
    try {
      const session = await window.aura.educator.startCourseIntake({
        topic: newCourseTopic.trim(),
        familiarity: newCourseFamiliarity,
      })
      setIntakeSession(session)
      setIntakeQuestionHistory(session.questions)
      setIntakeAnswers(Object.fromEntries(session.questions.map((question) => [question.id, ''])))
      setGenStatus('')
    } catch (error: any) {
      setGenStatus(String(error?.message || 'Could not prepare questions. Try again.'))
    } finally {
      setIsPreparingIntake(false)
    }
  }

  const handleContinueCourseIntake = async () => {
    if (!newCourseTopic.trim() || isGenerating || isPreparingIntake || !intakeSession || !currentTeacherIntakeComplete) return
    setIsPreparingIntake(true)
    setGenStatus('Refining course fit...')
    try {
      const session = await window.aura.educator.continueCourseIntake(intakeSession.id, {
        topic: newCourseTopic.trim(),
        familiarity: newCourseFamiliarity,
        intakeSessionId: intakeSession.id,
        intakeAnswers: buildIntakeAnswerPayload(),
      })
      setIntakeSession(session)
      mergeIntakeQuestions(session.questions)
      setIntakeAnswers((prev) => {
        const next = { ...prev }
        for (const question of session.questions) {
          if (next[question.id] !== undefined) continue
          next[question.id] = ''
        }
        return next
      })
      setGenStatus('')
    } catch (error: any) {
      setGenStatus(String(error?.message || 'Could not continue intake. Try again.'))
    } finally {
      setIsPreparingIntake(false)
    }
  }

  const handleRetryCourseGeneration = async (courseId: number) => {
    if (retryingCourseId === courseId) return

    setRetryingCourseId(courseId)
    setGenStatus('Restarting failed course...')
    try {
      await window.aura.educator.retryCourseGeneration(courseId)
      await loadVisibleCourses()
      setGenStatus('Failed course restarted in background.')
    } catch (error: any) {
      setGenStatus(String(error?.message || 'Could not restart the failed course.'))
    } finally {
      setRetryingCourseId(null)
    }
  }

  // ─── Computed ──────────────────────────────────────────────────────────
  const orbMood: TeacherMood = isTyping ? 'thinking' : teacherMood
  const orbSpeaking = false
  const inCooldown = cooldownEnd !== null && cooldownEnd > Date.now()
  const activeQuestion = checkpoint?.questions[questionIndex] || null
  const activeCard = checkpoint?.flashcards[flashcardIndex] || null
  const orbStatusLabel = isTyping
    ? 'WRITING...'
    : checkpointPromptState === 'preparing'
      ? 'PREPARING'
      : checkpointPromptState === 'ready' && recallStage === 'hidden'
        ? 'TEST READY'
        : recallStage === 'quiz'
        ? 'LISTENING'
        : recallStage === 'flashcards'
          ? 'MEMORIZE'
          : recallStage === 'practice'
            ? 'PRACTICE'
          : recallStage === 'passed'
            ? 'PASSED'
            : recallStage === 'failed'
              ? 'RETRY'
              : 'TEACHER'

  const canStartTeacherCheckpoint = practiceUnlocked || (checkpointPromptState === 'ready' && understandingScore !== null && understandingScore >= 7)
  const checkpointButtonLabel = practiceUnlocked
    ? 'RESUME PRACTICE →'
    : checkpointPromptState !== 'ready'
    ? 'PREPARING TEST...'
    : 'START TEST →'

  const activeSupportLesson = selectedLessonRef.current
  const activeLessonDisplay = activeSupportLesson
    ? Math.min(lessonProgress.current + 1, Math.max(lessonProgress.total, 1))
    : lessonProgress.current
  const activeLessonProgressPct = lessonProgress.total > 0
    ? (activeLessonDisplay / lessonProgress.total) * 100
    : 0
  const hiddenLessonMood: TeacherMood = understandingScore === null
    ? orbMood
    : understandingScore < 7 ? 'thinking' : 'pleased'
  const currentLessonIndex = activeSupportLesson ? lessons.findIndex((lesson) => lesson.id === activeSupportLesson.id) : -1
  const nextLessonTitle = currentLessonIndex >= 0 ? lessons[currentLessonIndex + 1]?.title : null
  const nextModuleTitle = selectedModule
    ? modules
        .filter((module) => module.unlocked && module.order_num > selectedModule.order_num)
        .sort((left, right) => left.order_num - right.order_num)[0]?.title
    : null
  const nextTeacherTeaser = nextLessonTitle
    ? `Next: ${nextLessonTitle}`
    : nextModuleTitle
      ? `Next module: ${nextModuleTitle}`
      : 'Almost done with the module.'
  const lessonDisplayText = [boardText.trim(), streamText.trim()].filter(Boolean).join('\n\n')
  const hasGeneratedLessonBody = lessonDisplayText.replace(/^──\s.*?\s──$/m, '').trim().length > 0
  const canShowReadGate = !boardHasLimitNotice && !readingConfirmed && hasGeneratedLessonBody && !isTyping
  const canShowSupportPanel = !boardHasLimitNotice && readingConfirmed && activeSupportLesson

  const memoryStrip = keyMoments.length > 0 && recallStage === 'quiz' ? (
    <div style={{
      marginBottom: 20,
      padding: '16px 18px',
      borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(196,154,60,0.08), rgba(40,180,120,0.05))',
      border: '1px solid rgba(196,154,60,0.16)',
      boxShadow: '0 0 30px rgba(196,154,60,0.06)',
    }}>
      <button
        onClick={() => setMemoryExpanded((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{
          fontFamily: PX,
          fontSize: tSize(5),
          color: 'rgba(200,180,40,0.56)',
          letterSpacing: '0.12em',
          lineHeight: 2,
          textAlign: 'left',
        }}>
          MEMORY ANCHORS
        </div>
        <div style={{
          fontFamily: PX,
          fontSize: tSize(4.4),
          color: 'rgba(40,180,120,0.46)',
          lineHeight: 2,
          transform: memoryExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform .18s ease',
        }}>
          ›
        </div>
      </button>
      {memoryExpanded && (
        <>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {keyMoments.map((anchor, index) => (
              <div key={index} style={{
                fontFamily: UI,
                fontSize: 18,
                color: 'rgba(220,235,215,0.88)',
                lineHeight: 1.6,
                textShadow: '0 0 14px rgba(120,210,170,0.08)',
              }}>
                {anchor}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 12,
            fontFamily: PX,
            fontSize: tSize(4.5),
            color: 'rgba(40,180,120,0.38)',
            letterSpacing: '0.08em',
            lineHeight: 2,
          }}>
            SAVED TO MEMORY · SESSION
          </div>
        </>
      )}
    </div>
  ) : null

  // ═════════════════════════════════════════════════════════════════════════
  // SESSION END / COOLDOWN
  // ═════════════════════════════════════════════════════════════════════════
  if (phase === 'session-end') return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <AuroraBackground />
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="text-center" style={{ animation: 'fadeIn .5s ease', maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌙</div>
          <h2 style={{ fontFamily: PX, fontSize: 12, color: 'rgba(200,220,180,0.85)', lineHeight: 2, marginBottom: 8 }}>Session complete!</h2>
          <p style={{ fontFamily: PX, fontSize: 6, color: 'rgba(40,180,120,0.4)', lineHeight: 2.2, marginBottom: 4 }}>You studied for 20 minutes. Great!</p>
          <p style={{ fontFamily: PX, fontSize: 7, color: 'rgba(200,180,40,0.6)', marginBottom: 20 }}>+{totalXP} XP</p>
          <button onClick={onClose} style={{
            fontFamily: PX, fontSize: 7, padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
            color: 'rgba(40,180,120,0.7)', background: 'rgba(40,180,120,0.06)', border: '1px solid rgba(40,180,120,0.15)',
          }}>← Back to AURA</button>
        </div>
      </div>
    </div>
  )

  if (phase === 'course-feedback') return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <AuroraBackground />
      <div className="relative z-10 flex items-center justify-between px-5 py-2.5 shrink-0" style={{ borderBottom: '1px solid rgba(40,180,120,0.06)' }}>
        <button onClick={() => { resetCourseFeedbackState(); setPhase('pick-course'); setSelectedCourse(null); setSelectedModule(null); setLessons([]); setBoardText(''); setKeyMoments([]) }} style={{
          fontFamily: PX, fontSize: 6, color: 'rgba(40,180,120,0.4)',
          background: 'rgba(40,180,120,0.04)', border: '1px solid rgba(40,180,120,0.1)',
          borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
        }}>← Back</button>
        <span style={{ fontFamily: PX, fontSize: 8, color: 'rgba(40,180,120,0.5)', letterSpacing: '0.1em' }}>COURSE REFLECTION</span>
        <div style={{ width: 82 }} />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto" style={{ padding: 24 }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'grid', gap: 18 }}>
          <div style={{
            padding: '18px 18px 16px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(10,18,12,0.92), rgba(12,14,12,0.84))',
            border: '1px solid rgba(46,184,122,0.18)',
            boxShadow: '0 0 28px rgba(46,184,122,0.08)',
          }}>
            <div style={{ fontFamily: PX, fontSize: 5, color: 'rgba(46,184,122,0.54)', lineHeight: 2, letterSpacing: '0.12em', marginBottom: 8 }}>COURSE COMPLETE</div>
            <div style={{ fontFamily: PX, fontSize: 8, color: 'rgba(245,228,168,0.88)', lineHeight: 2, marginBottom: 8 }}>
              {selectedCourse?.title || 'Finished course'}
            </div>
            <div style={{ fontFamily: UI, fontSize: 16, color: 'rgba(220,235,215,0.78)', lineHeight: 1.55 }}>
              Save how this run landed, then launch the next course from a recommendation shaped by the actual outcome instead of guesswork.
            </div>
          </div>

          {!courseFeedbackRecord ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['overall_rating', 'OVERALL VALUE', 'Was the course worth the time it took?', 'thin', 'strong'],
                ['clarity_rating', 'CLARITY', 'Did the explanations land cleanly enough?', 'foggy', 'clear'],
                ['retention_rating', 'RETENTION', 'How much feels like it will still stick tomorrow?', 'slipping', 'sticky'],
                ['difficulty_rating', 'DIFFICULTY', 'How intense did the course feel for your current level?', 'light', 'heavy'],
                ['continue_interest_rating', 'CONTINUE', 'How much do you want to keep going in this area?', 'not now', 'more please'],
              ].map(([field, label, hint, low, high]) => {
                const key = field as FeedbackField
                const value = Number(courseFeedbackDraft[key] || 0)
                return (
                  <label key={key} style={{
                    display: 'grid',
                    gap: 8,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(196,154,60,0.035)',
                    border: '1px solid rgba(196,154,60,0.1)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: PX, fontSize: 4.8, color: 'rgba(196,154,60,0.42)', lineHeight: 2 }}>{label}</div>
                        <div style={{ fontFamily: UI, fontSize: 14, color: 'rgba(220,235,215,0.74)', lineHeight: 1.45 }}>{hint}</div>
                      </div>
                      <div style={{ fontFamily: PX, fontSize: 6, color: 'rgba(245,228,168,0.86)', lineHeight: 2 }}>{value}</div>
                    </div>
                    <input type="range" min={1} max={10} step={1} value={value} onChange={(event) => updateCourseFeedbackField(key, Number(event.target.value))} style={{ width: '100%', accentColor: 'rgba(46,184,122,0.92)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: UI, fontSize: 12, color: 'rgba(196,154,60,0.42)' }}>
                      <span>{low}</span>
                      <span>{high}</span>
                    </div>
                  </label>
                )
              })}

              <label style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontFamily: PX, fontSize: 4.8, color: 'rgba(196,154,60,0.42)', lineHeight: 2 }}>OPTIONAL NOTE</div>
                <textarea
                  value={String(courseFeedbackDraft.notes || '')}
                  onChange={(event) => { setCourseFeedbackDraft((prev) => ({ ...prev, notes: event.target.value.slice(0, 800) })); setFeedbackError(null) }}
                  placeholder="What should the next course change?"
                  style={{
                    minHeight: 96,
                    resize: 'vertical',
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: 'rgba(5,14,8,0.82)',
                    border: '1px solid rgba(196,154,60,0.12)',
                    color: 'rgba(240,230,220,0.84)',
                    fontFamily: UI,
                    fontSize: 15,
                    lineHeight: 1.55,
                  }}
                />
              </label>

              {feedbackError && (
                <div style={{ fontFamily: UI, fontSize: 14, color: 'rgba(255,186,186,0.82)', lineHeight: 1.45 }}>{feedbackError}</div>
              )}

              <button onClick={() => { void submitCourseFeedback() }} disabled={submittingFeedback} style={{
                fontFamily: PX, fontSize: 5.2, padding: '12px 16px', borderRadius: 10, cursor: submittingFeedback ? 'wait' : 'pointer',
                color: 'rgba(245,228,168,0.88)', background: 'rgba(46,184,122,0.12)', border: '1px solid rgba(46,184,122,0.2)', lineHeight: 2,
                opacity: submittingFeedback ? 0.72 : 1,
              }}>{submittingFeedback ? 'SAVING...' : 'SAVE FEEDBACK'}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                {[
                  ['OVERALL', courseFeedbackRecord.overall_rating],
                  ['CLARITY', courseFeedbackRecord.clarity_rating],
                  ['RETENTION', courseFeedbackRecord.retention_rating],
                  ['DIFFICULTY', courseFeedbackRecord.difficulty_rating],
                  ['CONTINUE', courseFeedbackRecord.continue_interest_rating],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ padding: '12px 12px', borderRadius: 10, background: 'rgba(196,154,60,0.035)', border: '1px solid rgba(196,154,60,0.1)' }}>
                    <div style={{ fontFamily: PX, fontSize: 4.8, color: 'rgba(196,154,60,0.38)', lineHeight: 2 }}>{label}</div>
                    <div style={{ fontFamily: PX, fontSize: 8, color: 'rgba(245,228,168,0.9)', lineHeight: 2 }}>{value}/10</div>
                  </div>
                ))}
              </div>

              {courseFeedbackRecord.notes && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(196,154,60,0.035)', border: '1px solid rgba(196,154,60,0.1)' }}>
                  <div style={{ fontFamily: PX, fontSize: 4.8, color: 'rgba(196,154,60,0.42)', lineHeight: 2, marginBottom: 6 }}>NOTES</div>
                  <div style={{ fontFamily: UI, fontSize: 15, color: 'rgba(240,230,220,0.82)', lineHeight: 1.55 }}>{courseFeedbackRecord.notes}</div>
                </div>
              )}

              {reinforcementSummaryText && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(96,180,255,0.04)', border: '1px solid rgba(96,180,255,0.1)' }}>
                  <div style={{ fontFamily: PX, fontSize: 4.8, color: 'rgba(96,180,255,0.46)', lineHeight: 2, marginBottom: 6 }}>REINFORCEMENT LOOP</div>
                  <div style={{ fontFamily: UI, fontSize: 15, color: 'rgba(220,235,245,0.76)', lineHeight: 1.55 }}>{reinforcementSummaryText}</div>
                </div>
              )}

              {courseFeedbackRecord.recommendation && (
                <div style={{ padding: '16px 16px 14px', borderRadius: 12, background: 'rgba(46,184,122,0.08)', border: '1px solid rgba(46,184,122,0.16)' }}>
                  <div style={{ fontFamily: PX, fontSize: 4.8, color: 'rgba(46,184,122,0.5)', lineHeight: 2, marginBottom: 8 }}>RECOMMENDED NEXT COURSE</div>
                  <div style={{ fontFamily: PX, fontSize: 6.4, color: 'rgba(220,245,210,0.88)', lineHeight: 2, marginBottom: 8 }}>{courseFeedbackRecord.recommendation.title}</div>
                  <div style={{ fontFamily: PX, fontSize: 4.6, color: 'rgba(140,220,180,0.56)', lineHeight: 2, marginBottom: 10 }}>
                    {courseFeedbackRecord.recommendation.direction.toUpperCase()} PATH · {courseFeedbackRecord.recommendation.confidence}% fit · {courseFeedbackRecord.recommendation.source === 'ai' ? 'AI REFINED' : 'HEURISTIC BASE'}
                  </div>
                  <div style={{ fontFamily: UI, fontSize: 15, color: 'rgba(220,235,215,0.76)', lineHeight: 1.55, marginBottom: 12 }}>{courseFeedbackRecord.recommendation.reason}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={startSuggestedTeacherCourse} style={{
                      fontFamily: PX, fontSize: 5, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                      color: 'rgba(245,228,168,0.88)', background: 'rgba(46,184,122,0.12)', border: '1px solid rgba(46,184,122,0.22)', lineHeight: 2,
                    }}>USE AS NEXT COURSE</button>
                    <button onClick={() => { void refineCourseRecommendation() }} disabled={refiningRecommendation} style={{
                      fontFamily: PX, fontSize: 5, padding: '10px 12px', borderRadius: 9, cursor: refiningRecommendation ? 'wait' : 'pointer',
                      color: 'rgba(210,225,255,0.82)', background: 'rgba(96,180,255,0.08)', border: '1px solid rgba(96,180,255,0.18)', lineHeight: 2,
                      opacity: refiningRecommendation ? 0.72 : 1,
                    }}>{refiningRecommendation ? 'REFINING...' : 'AI REFINE'}</button>
                    <button onClick={() => { setCourseFeedbackRecord(null); setCourseFeedbackDraft(buildTeacherFeedbackDraft(courseFeedbackRecord)); setRecommendationError(null) }} style={{
                      fontFamily: PX, fontSize: 5, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                      color: 'rgba(232,197,106,0.72)', background: 'rgba(196,154,60,0.06)', border: '1px solid rgba(196,154,60,0.14)', lineHeight: 2,
                    }}>ADJUST REFLECTION</button>
                  </div>
                  {recommendationError && (
                    <div style={{ marginTop: 10, fontFamily: UI, fontSize: 14, color: 'rgba(255,186,186,0.82)', lineHeight: 1.45 }}>{recommendationError}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <XPToast amount={xpToast?.amount || 0} visible={!!xpToast} />
      <style>{KEYFRAMES}</style>
    </div>
  )

  if (inCooldown) return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <AuroraBackground />
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="text-center" style={{ animation: 'fadeIn .5s ease', maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontFamily: PX, fontSize: 10, color: 'rgba(200,220,180,0.7)', lineHeight: 2, marginBottom: 8 }}>Active break</h2>
          <p style={{ fontFamily: PX, fontSize: 6, color: 'rgba(40,180,120,0.35)', lineHeight: 2.2, marginBottom: 16 }}>
            Come back in {Math.ceil((cooldownEnd! - Date.now()) / 60000)} minutes.
          </p>
          <button onClick={onClose} style={{
            fontFamily: PX, fontSize: 7, padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
            color: 'rgba(40,180,120,0.6)', background: 'rgba(40,180,120,0.06)', border: '1px solid rgba(40,180,120,0.12)',
          }}>← Back</button>
        </div>
      </div>
    </div>
  )

  // ═════════════════════════════════════════════════════════════════════════
  // COURSE PICKER
  // ═════════════════════════════════════════════════════════════════════════
  if (phase === 'pick-course' || phase === 'create-course') return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <AuroraBackground />
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2.5 shrink-0" style={{ borderBottom: '1px solid rgba(40,180,120,0.06)' }}>
        <button onClick={onClose} style={{
          fontFamily: PX, fontSize: 6, color: 'rgba(40,180,120,0.4)',
          background: 'rgba(40,180,120,0.04)', border: '1px solid rgba(40,180,120,0.1)',
          borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
        }}>← Back</button>
        <span style={{ fontFamily: PX, fontSize: 8, color: 'rgba(40,180,120,0.5)', letterSpacing: '0.1em' }}>TEACHER</span>
        {totalXP > 0 ? <span style={{ fontFamily: PX, fontSize: 6, color: 'rgba(200,180,40,0.5)' }}>✦ {totalXP} XP</span> : <div style={{ width: 60 }} />}
      </div>

      <div className="relative z-10 flex-1 flex min-h-0">
        {/* Orb */}
        <div className="flex flex-col items-center justify-center" style={{ width: '38%', minWidth: 240 }}>
          <TeacherOrb mood={orbMood} speaking={orbSpeaking} size={220} />
          <span style={{ fontFamily: PX, fontSize: 5, color: 'rgba(40,180,120,0.2)', marginTop: 4, letterSpacing: '0.1em' }}>TEACHER</span>
        </div>

        {/* Course list / create */}
        <div className="flex-1 flex items-center justify-center overflow-y-auto" style={{ padding: 24 }}>
          {phase === 'create-course' ? (
            <div style={{ maxWidth: 380, width: '100%', animation: 'fadeIn .4s ease' }}>
              <button onClick={() => {
                if (intakeSession) {
                  setIntakeSession(null)
                  setIntakeQuestionHistory([])
                  setIntakeAnswers({})
                  return
                }
                setPhase('pick-course')
              }} style={{ fontFamily: PX, fontSize: 5, color: 'rgba(40,180,120,0.2)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12 }}>← Back</button>

              {!intakeSession ? (
                <>
                  <h2 style={{ fontFamily: PX, fontSize: 9, color: 'rgba(200,220,180,0.8)', lineHeight: 2, marginBottom: 12 }}>Generate a new course</h2>
                  <input value={newCourseTopic} onChange={e => setNewCourseTopic(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleStartCourseIntake() }}
                    placeholder="ex: Python, React..."
                    style={{ width: '100%', fontFamily: PX, fontSize: 7, padding: '10px 14px', borderRadius: 8, marginBottom: 10,
                      color: 'rgba(200,220,180,0.7)', background: 'rgba(2,8,4,0.8)', border: '1px solid rgba(40,180,120,0.12)', outline: 'none' }} />
                  <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    <div style={{ fontFamily: PX, fontSize: 4.6, color: 'rgba(40,180,120,0.28)', lineHeight: 2 }}>
                      HOW MUCH DO YOU ALREADY KNOW ABOUT THIS TOPIC?
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {COURSE_FAMILIARITY_OPTIONS.map((item) => (
                        <button
                          key={item.code}
                          onClick={() => setNewCourseFamiliarity(item.code)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            fontFamily: PX,
                            fontSize: 4.8,
                            padding: '8px 10px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            color: newCourseFamiliarity === item.code ? 'rgba(200,220,180,0.84)' : 'rgba(40,180,120,0.48)',
                            background: newCourseFamiliarity === item.code ? 'rgba(40,180,120,0.1)' : 'rgba(40,180,120,0.04)',
                            border: `1px solid ${newCourseFamiliarity === item.code ? 'rgba(40,180,120,0.22)' : 'rgba(40,180,120,0.1)'}`,
                            textAlign: 'left',
                            lineHeight: 2,
                          }}
                        >
                          <span>{item.label}</span>
                          <span style={{ color: newCourseFamiliarity === item.code ? 'rgba(200,220,180,0.62)' : 'rgba(40,180,120,0.24)' }}>{item.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleStartCourseIntake} disabled={isPreparingIntake || !newCourseTopic.trim()} style={{
                    width: '100%', fontFamily: PX, fontSize: 7, padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                    color: isPreparingIntake ? 'rgba(40,180,120,0.3)' : 'rgba(200,220,180,0.8)',
                    background: 'rgba(40,180,120,0.08)', border: '1px solid rgba(40,180,120,0.18)',
                  }}>{isPreparingIntake ? genStatus : '✦ Continue'}</button>
                </>
              ) : (
                <>
                  <h2 style={{ fontFamily: PX, fontSize: 9, color: 'rgba(200,220,180,0.8)', lineHeight: 2, marginBottom: 12 }}>Tune the course before planting</h2>
                  <div style={{ fontFamily: PX, fontSize: 5, color: 'rgba(40,180,120,0.28)', lineHeight: 2, marginBottom: 12 }}>
                    Answer a few quick questions so the roadmap fits your goal.
                  </div>
                  {!!intakeSession.summary && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(12,22,12,0.76)',
                      border: '1px solid rgba(200,180,40,0.12)',
                      marginBottom: 12,
                    }}>
                      <div style={{ fontFamily: PX, fontSize: 4.4, color: 'rgba(200,180,40,0.42)', lineHeight: 2, marginBottom: 8 }}>
                        {teacherIntakeReady ? 'COURSE DIRECTION' : 'CURRENT SIGNAL'}
                      </div>
                      <div style={{ fontFamily: UI, fontSize: 15, color: 'rgba(220,235,215,0.84)', lineHeight: 1.55 }}>
                        {intakeSession.summary}
                      </div>
                    </div>
                  )}
                  {!teacherIntakeReady && (
                    <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                      {intakeSession.questions.map((question) => (
                        <div key={question.id} style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'rgba(2,8,4,0.75)',
                          border: '1px solid rgba(40,180,120,0.12)',
                        }}>
                          <div style={{ fontFamily: PX, fontSize: 4.8, color: 'rgba(200,220,180,0.75)', lineHeight: 2, marginBottom: 8 }}>
                            {question.question}
                          </div>
                          <textarea
                            value={intakeAnswers[question.id] || ''}
                            onChange={(event) => setIntakeAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                            placeholder={question.placeholder || 'Short answer...'}
                            rows={3}
                            style={{
                              width: '100%',
                              resize: 'vertical',
                              fontFamily: UI,
                              fontSize: 15,
                              padding: '8px 10px',
                              borderRadius: 8,
                              color: 'rgba(220,235,215,0.86)',
                              background: 'rgba(4,14,8,0.72)',
                              border: '1px solid rgba(40,180,120,0.12)',
                              outline: 'none',
                              lineHeight: 1.45,
                            }}
                          />
                          {extractIntakeExamples(question.placeholder).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              {extractIntakeExamples(question.placeholder).map((example) => (
                                <button
                                  key={`${question.id}-${example}`}
                                  type="button"
                                  onClick={() => applyIntakeExample(question.id, example)}
                                  style={{
                                    fontFamily: PX,
                                    fontSize: 4.4,
                                    padding: '6px 8px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    color: (intakeAnswers[question.id] || '').toLowerCase().includes(example.toLowerCase()) ? 'rgba(200,220,180,0.86)' : 'rgba(40,180,120,0.54)',
                                    background: (intakeAnswers[question.id] || '').toLowerCase().includes(example.toLowerCase()) ? 'rgba(40,180,120,0.1)' : 'rgba(40,180,120,0.04)',
                                    border: `1px solid ${(intakeAnswers[question.id] || '').toLowerCase().includes(example.toLowerCase()) ? 'rgba(40,180,120,0.22)' : 'rgba(40,180,120,0.1)'}`,
                                    lineHeight: 1.8,
                                    textAlign: 'left',
                                  }}
                                >
                                  {example}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={teacherIntakeReady ? handleGenerateCourse : handleContinueCourseIntake} disabled={teacherIntakeReady ? isGenerating : isPreparingIntake || !currentTeacherIntakeComplete} style={{
                    width: '100%', fontFamily: PX, fontSize: 7, padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                    color: (teacherIntakeReady ? isGenerating : isPreparingIntake) ? 'rgba(40,180,120,0.3)' : 'rgba(200,220,180,0.8)',
                    background: 'rgba(40,180,120,0.08)', border: '1px solid rgba(40,180,120,0.18)',
                  }}>{teacherIntakeReady ? (isGenerating ? genStatus : '✦ Start background course') : (isPreparingIntake ? genStatus : '✦ Continue')}</button>
                </>
              )}

              {genStatus && !isGenerating && !isPreparingIntake && (
                <div style={{ fontFamily: PX, fontSize: 4.6, color: 'rgba(200,180,40,0.34)', lineHeight: 2, marginTop: 10 }}>
                  {genStatus}
                </div>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: 400, width: '100%' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: PX, fontSize: 9, color: 'rgba(200,220,180,0.8)', lineHeight: 2 }}>Choose a course</h2>
                <button onClick={() => { setPhase('create-course'); playClick() }} style={{
                  fontFamily: PX, fontSize: 5, color: 'rgba(200,180,40,0.6)',
                  background: 'rgba(200,180,40,0.05)', border: '1px solid rgba(200,180,40,0.12)',
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                }}>+ New course</button>
              </div>
              {courses.length === 0 ? (
                <div className="text-center py-10" style={{ animation: 'fadeIn .4s ease' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📚</div>
                  <p style={{ fontFamily: PX, fontSize: 7, color: 'rgba(40,180,120,0.2)', marginBottom: 12, lineHeight: 2 }}>No courses yet</p>
                  <button onClick={() => { setPhase('create-course'); playClick() }} style={{
                    fontFamily: PX, fontSize: 6, color: 'rgba(200,180,40,0.7)',
                    background: 'rgba(200,180,40,0.06)', border: '1px solid rgba(200,180,40,0.15)',
                    borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
                  }}>✦ Create your first course</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {courses.map((c, i) => {
                    const isGeneratingCourse = c.status === 'generating'
                    const isFailedCourse = c.status === 'failed'
                    const isPendingCourse = isGeneratingCourse || isFailedCourse
                    const pct = isGeneratingCourse
                      ? Math.max(6, Number(c.generation_progress || 0))
                      : isFailedCourse
                        ? 0
                        : c.total_modules > 0 ? Math.round((c.completed_modules / c.total_modules) * 100) : 0
                    return (
                      <div key={c.id}
                        onClick={() => { if (!isPendingCourse) { setSelectedCourse(c); loadCourseModules(c); playClick() } }}
                        onKeyDown={(event) => {
                          if (isPendingCourse) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedCourse(c)
                            loadCourseModules(c)
                            playClick()
                          }
                        }}
                        role={!isPendingCourse ? 'button' : undefined}
                        tabIndex={!isPendingCourse ? 0 : -1}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:scale-[1.01]"
                        style={{
                          background: 'rgba(40,180,120,0.03)', border: '1px solid rgba(40,180,120,0.08)',
                          textAlign: 'left', cursor: isPendingCourse ? 'default' : 'pointer', animation: `fadeSlideIn .4s ease ${i * .08}s both`, opacity: isPendingCourse ? 0.78 : 1,
                        }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: isFailedCourse ? 'rgba(220,120,120,0.08)' : pct === 100 ? 'rgba(40,180,120,0.12)' : 'rgba(180,160,40,0.08)',
                          border: `1px solid ${isFailedCourse ? 'rgba(220,120,120,0.16)' : pct === 100 ? 'rgba(40,180,120,0.2)' : 'rgba(180,160,40,0.12)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        }}>{isFailedCourse ? '⚠' : isGeneratingCourse ? '⏳' : pct === 100 ? '✓' : '📖'}</div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: PX, fontSize: 7, color: 'rgba(200,220,180,0.8)', lineHeight: 2 }}>{c.title}</div>
                          {isPendingCourse && (
                            <div style={{
                              fontFamily: UI,
                              fontSize: 12,
                              color: isFailedCourse ? 'rgba(220,120,120,0.68)' : 'rgba(200,180,40,0.42)',
                              lineHeight: 1.5,
                              marginTop: 2,
                            }}>
                              {isFailedCourse ? (c.generation_error || 'Generation stopped.') : (c.generation_summary || 'Generating in background...')}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(40,180,120,0.06)', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: isFailedCourse ? 'rgba(220,120,120,0.34)' : 'rgba(40,180,120,0.3)', transition: 'width .5s' }} />
                            </div>
                            <span style={{ fontFamily: PX, fontSize: 5, color: isFailedCourse ? 'rgba(220,120,120,0.34)' : 'rgba(40,180,120,0.2)' }}>{isFailedCourse ? 'ERR' : `${pct}%`}</span>
                          </div>
                          {isFailedCourse && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleRetryCourseGeneration(c.id)
                              }}
                              disabled={retryingCourseId === c.id}
                              style={{
                                marginTop: 8,
                                fontFamily: PX,
                                fontSize: 5,
                                color: 'rgba(244,190,190,0.78)',
                                background: 'rgba(220,120,120,0.08)',
                                border: '1px solid rgba(220,120,120,0.16)',
                                borderRadius: 6,
                                padding: '7px 10px',
                                cursor: retryingCourseId === c.id ? 'wait' : 'pointer',
                                opacity: retryingCourseId === c.id ? 0.7 : 1,
                              }}
                            >
                              {retryingCourseId === c.id ? 'RETRYING...' : 'RETRY'}
                            </button>
                          )}
                        </div>
                        <span style={{ color: 'rgba(40,180,120,0.12)', fontSize: 10 }}>{isPendingCourse ? '…' : '→'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <XPToast amount={xpToast?.amount || 0} visible={!!xpToast} />
      <style>{KEYFRAMES}</style>
    </div>
  )

  // ═════════════════════════════════════════════════════════════════════════
  // LEARNING VIEW — The Board
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="absolute inset-0 z-50 flex flex-col">
      <AuroraBackground />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2 shrink-0" style={{
        borderBottom: '1px solid rgba(40,180,120,0.06)', background: 'rgba(2,6,4,0.6)', backdropFilter: 'blur(12px)',
      }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setPhase('pick-course'); setSelectedCourse(null); setSelectedModule(null); setBoardText(''); setKeyMoments([]); resetCheckpoint() }}
            style={{ fontFamily: PX, fontSize: tSize(5), color: 'rgba(40,180,120,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          <div style={{ width: 1, height: 12, background: 'rgba(40,180,120,0.06)' }} />
          <span style={{ fontFamily: PX, fontSize: tSize(6), color: 'rgba(40,180,120,0.35)' }}>{selectedModule?.title || ''}</span>
        </div>
        {/* Centered timer */}
        <div className="absolute left-1/2 -translate-x-1/2">
          {sessionStart && <SessionTimer startTime={sessionStart} onExpired={handleSessionExpired} />}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(40,180,120,0.06)', overflow: 'hidden' }}>
              <div style={{
                width: `${activeLessonProgressPct}%`,
                height: '100%', borderRadius: 2, background: 'rgba(40,180,120,0.35)', transition: 'width .5s',
              }} />
            </div>
            <span style={{ fontFamily: PX, fontSize: tSize(4), color: 'rgba(40,180,120,0.2)' }}>{activeLessonDisplay}/{lessonProgress.total}</span>
          </div>
          {lessonReward && (
            <span style={{ fontFamily: PX, fontSize: tSize(4.4), color: lessonReward.milestoneReached ? 'rgba(46,184,122,0.56)' : 'rgba(200,180,40,0.5)', lineHeight: 2 }}>
              {lessonReward.milestoneReached ? 'MILESTONE!' : `${lessonReward.lessonsUntilNextMilestone} UNTIL NEXT`}
            </span>
          )}
          {totalXP > 0 && <span style={{ fontFamily: PX, fontSize: tSize(5), color: 'rgba(200,180,40,0.5)' }}>✦ {totalXP} XP</span>}
          <button onClick={onClose} style={{
            fontFamily: PX, fontSize: tSize(5), color: 'rgba(40,180,120,0.3)',
            background: 'rgba(40,180,120,0.04)', border: '1px solid rgba(40,180,120,0.08)',
            borderRadius: 5, padding: '4px 10px', cursor: 'pointer',
          }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* Left: Orb + status */}
        <div className="flex flex-col items-center justify-center shrink-0" style={{
          width: recallStage === 'hidden' ? 0 : 200,
          borderRight: recallStage === 'hidden' ? 'none' : '1px solid rgba(40,180,120,0.04)',
          overflow: 'hidden',
          transition: 'width .24s ease',
        }}>
          {recallStage !== 'hidden' && (
            <>
              <TeacherOrb mood={orbMood} speaking={orbSpeaking} size={160} />
              <span style={{
                fontFamily: PX, fontSize: tSize(5), letterSpacing: '0.12em', marginTop: -4,
                color: isTyping ? 'rgba(180,160,40,0.5)' : 'rgba(40,180,120,0.25)',
              }}>
                {orbStatusLabel}
              </span>
            </>
          )}
        </div>

        {/* Right: The Board */}
        <div className="flex-1 flex flex-col min-h-0">
          {recallStage === 'hidden' ? (
            <div className="flex-1 overflow-y-auto px-6 py-4" style={{
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(40,180,120,0.05) transparent',
            }}>
              <div style={{ width: 'min(92%, 920px)', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {memoryStrip}
                <div style={{
                  width: 'min(100%, 760px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  margin: '4px auto 18px',
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: 'rgba(196,154,60,0.06)',
                    border: '1px solid rgba(196,154,60,0.14)',
                    fontFamily: PX,
                    fontSize: tSize(4.8),
                    color: 'rgba(196,154,60,0.34)',
                    lineHeight: 2,
                    letterSpacing: '0.08em',
                    marginBottom: 12,
                  }}>
                    📖 LESSON {activeLessonDisplay} / {lessonProgress.total}
                  </div>
                  <TeacherOrb mood={hiddenLessonMood} speaking={orbSpeaking} size={156} />
                  <span style={{
                    fontFamily: PX,
                    fontSize: tSize(4.6),
                    letterSpacing: '0.12em',
                    marginTop: 6,
                    color: isTyping ? 'rgba(180,160,40,0.5)' : 'rgba(40,180,120,0.25)',
                    lineHeight: 1.9,
                  }}>
                    {orbStatusLabel}
                  </span>
                </div>

                <div style={{
                  width: 'min(100%, 760px)',
                  margin: '0 auto',
                  padding: '28px 30px 24px',
                  borderRadius: 22,
                  background: 'rgba(4,14,8,0.64)',
                  border: '1px solid rgba(196,154,60,0.12)',
                  boxShadow: '0 0 34px rgba(0,0,0,0.16)',
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'center',
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    transform: 'translateX(-50%)',
                    width: 240,
                    height: 2,
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, transparent, rgba(200,180,40,0.42), transparent)',
                  }} />

                  {activeSupportLesson && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 12px',
                      borderRadius: 999,
                      background: 'rgba(40,180,120,0.08)',
                      border: '1px solid rgba(40,180,120,0.16)',
                      fontFamily: PX,
                      fontSize: tSize(4.4),
                      color: 'rgba(40,180,120,0.48)',
                      lineHeight: 2,
                      letterSpacing: '0.08em',
                      marginBottom: 14,
                    }}>
                      {activeSupportLesson.title}
                    </div>
                  )}

                  {!lessonDisplayText && (
                    <div className="flex items-center justify-center h-full" style={{ minHeight: 260 }}>
                      <span style={{ fontFamily: PX, fontSize: tSize(6.2), color: 'rgba(40,180,120,0.12)', lineHeight: 2 }}>
                        The lesson will start soon...
                      </span>
                    </div>
                  )}
                  {lessonDisplayText && <LessonRichText content={lessonDisplayText} variant="teacher" />}
                  {streamText && (
                    <div style={{
                      fontFamily: PX, fontSize: tSize(4.2), color: 'rgba(200,180,40,0.44)',
                      lineHeight: 1.8, paddingTop: '8px', textAlign: 'center', maxWidth: 620, margin: '0 auto', letterSpacing: '0.08em',
                    }}>
                      GENERATING...
                    </div>
                  )}
                </div>

                {canShowReadGate && (
                  <button
                    onClick={() => setReadingConfirmed(true)}
                    style={{
                      width: 'min(100%, 420px)',
                      marginTop: 12,
                      padding: '13px 16px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                      border: '1px solid rgba(46,184,122,0.22)',
                      color: 'rgba(245,228,168,0.92)',
                      fontFamily: PX,
                      fontSize: tSize(5),
                      lineHeight: 1.9,
                      letterSpacing: '0.06em',
                      boxShadow: '0 0 20px rgba(46,184,122,0.1)',
                    }}
                  >
                    AM CITIT
                  </button>
                )}

                {canShowSupportPanel && (
                  <LessonSupportPanel
                    lesson={activeSupportLesson}
                    understandingScore={understandingScore}
                    onUnderstandingScoreChange={setUnderstandingScore}
                    initialFlashcards={checkpoint?.flashcards || []}
                    continueLabel={checkpointButtonLabel}
                    continueEnabled={canStartTeacherCheckpoint}
                    continueDisabledLabel="PREPARING TEST..."
                    onContinue={() => {
                      if (practiceUnlocked) {
                        playClick()
                        setRecallStage('practice')
                        setTeacherMood('pleased')
                        return
                      }
                      startCheckpoint()
                    }}
                    onCheckpointUpdate={(nextCheckpoint) => {
                      setCheckpoint(nextCheckpoint)
                      setKeyMoments(nextCheckpoint.anchors)
                    }}
                  />
                )}
                <div ref={boardEndRef} />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4" style={{
              scrollbarWidth: 'thin', scrollbarColor: 'rgba(40,180,120,0.05) transparent',
            }}>
              <div style={{
                width: 'min(84%, 760px)',
                margin: '0 auto',
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '20px 0',
              }}>
                {memoryStrip}

                {recallStage === 'loading' && (
                  <div style={{
                    padding: '34px 30px',
                    borderRadius: 18,
                    background: 'rgba(4,14,8,0.72)',
                    border: '1px solid rgba(196,154,60,0.16)',
                    textAlign: 'center',
                    animation: 'stageRise .45s ease forwards',
                  }}>
                    <div style={{
                      width: 72,
                      height: 72,
                      margin: '0 auto 18px',
                      borderRadius: 18,
                      background: 'radial-gradient(circle at 40% 35%, rgba(232,197,106,0.32), rgba(40,180,120,0.12))',
                      border: '1px solid rgba(196,154,60,0.2)',
                      boxShadow: '0 0 28px rgba(196,154,60,0.12)',
                      animation: 'auraPulse 1.8s ease-in-out infinite',
                    }} />
                    <div style={{ fontFamily: PX, fontSize: tSize(8), color: 'rgba(245,228,168,0.88)', lineHeight: 1.9, marginBottom: 10 }}>
                      LOCKING IDEAS
                    </div>
                    <div style={{ fontFamily: PX, fontSize: tSize(5.4), color: 'rgba(40,180,120,0.46)', lineHeight: 2.2 }}>
                      Clearing the screen and preparing the short checkpoint.
                    </div>
                  </div>
                )}

                {recallStage === 'quiz' && activeQuestion && (
                  <div style={{ display: 'grid', gap: 16, animation: 'stageRise .45s ease forwards' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 999,
                        background: 'rgba(196,154,60,0.08)',
                        border: '1px solid rgba(196,154,60,0.18)',
                        fontFamily: PX,
                        fontSize: tSize(4.8),
                        color: 'rgba(200,180,40,0.62)',
                        letterSpacing: '0.08em',
                        lineHeight: 2,
                      }}>
                        CHECKPOINT · {questionIndex + 1}/3
                      </div>
                      <div style={{ fontFamily: PX, fontSize: tSize(5), color: 'rgba(40,180,120,0.42)', lineHeight: 2 }}>
                        PASS WITH 2 OF 3
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 999,
                          background: index < questionIndex
                            ? 'rgba(46,184,122,0.55)'
                            : index === questionIndex
                              ? 'rgba(232,197,106,0.58)'
                              : 'rgba(196,154,60,0.12)',
                          boxShadow: index < questionIndex ? '0 0 10px rgba(46,184,122,0.18)' : 'none',
                        }} />
                      ))}
                    </div>

                    <div style={{
                      padding: '22px 22px 20px',
                      borderRadius: 18,
                      background: 'rgba(4,14,8,0.72)',
                      border: '1px solid rgba(196,154,60,0.16)',
                      boxShadow: '0 0 34px rgba(0,0,0,0.16)',
                    }}>
                      <div style={{
                        fontFamily: PX,
                        fontSize: tSize(4.8),
                        color: 'rgba(200,180,40,0.54)',
                        letterSpacing: '0.1em',
                        lineHeight: 2,
                        marginBottom: 12,
                      }}>
                        SHORT QUIZ
                      </div>
                      <div style={{
                        fontFamily: PX,
                        fontSize: tSize(7.6),
                        color: 'rgba(245,228,168,0.92)',
                        lineHeight: 2.1,
                      }}>
                        {activeQuestion.question}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      {activeQuestion.options.map((option, index) => {
                        const selected = selectedOption === option
                        return (
                          <button
                            key={index}
                            onClick={() => !quizFeedback && setSelectedOption(option)}
                            disabled={!!quizFeedback}
                            style={{
                              padding: '16px 16px 18px',
                              borderRadius: 16,
                              textAlign: 'left',
                              cursor: quizFeedback ? 'default' : 'pointer',
                              background: selected ? 'rgba(232,197,106,0.11)' : 'rgba(4,14,8,0.55)',
                              border: `1px solid ${selected ? 'rgba(232,197,106,0.32)' : 'rgba(196,154,60,0.12)'}`,
                              color: selected ? 'rgba(245,228,168,0.92)' : 'rgba(220,200,160,0.66)',
                              transition: 'all .22s ease',
                              boxShadow: selected ? '0 0 20px rgba(232,197,106,0.08)' : 'none',
                              minHeight: 104,
                            }}
                            onMouseEnter={(event) => {
                              if (!selected && !quizFeedback) {
                                event.currentTarget.style.borderColor = 'rgba(196,154,60,0.24)'
                                event.currentTarget.style.transform = 'translateY(-1px)'
                              }
                            }}
                            onMouseLeave={(event) => {
                              if (!selected && !quizFeedback) {
                                event.currentTarget.style.borderColor = 'rgba(196,154,60,0.12)'
                                event.currentTarget.style.transform = 'translateY(0)'
                              }
                            }}
                          >
                            <div style={{ fontFamily: PX, fontSize: tSize(4.8), color: 'rgba(40,180,120,0.42)', lineHeight: 2, marginBottom: 6 }}>
                              {String.fromCharCode(65 + index)}
                            </div>
                            <div style={{ fontFamily: PX, fontSize: tSize(5.8), lineHeight: 2.1 }}>
                              {option}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {quizFeedback && (
                      <div style={{
                        padding: '16px 18px',
                        borderRadius: 16,
                        background: quizFeedback.correct ? 'rgba(46,184,122,0.12)' : 'rgba(220,80,80,0.1)',
                        border: `1px solid ${quizFeedback.correct ? 'rgba(46,184,122,0.24)' : 'rgba(220,80,80,0.22)'}`,
                        boxShadow: `0 0 22px ${quizFeedback.correct ? 'rgba(46,184,122,0.08)' : 'rgba(220,80,80,0.06)'}`,
                      }}>
                        <div style={{
                          fontFamily: PX,
                          fontSize: tSize(5.4),
                          color: quizFeedback.correct ? 'rgba(46,184,122,0.92)' : 'rgba(255,170,170,0.84)',
                          lineHeight: 2,
                          marginBottom: 6,
                        }}>
                          {quizFeedback.correct ? 'YOU GOT IT' : 'MISSED THE CORE'}
                        </div>
                        {!quizFeedback.correct && (
                          <div style={{ fontFamily: PX, fontSize: tSize(5), color: 'rgba(245,228,168,0.74)', lineHeight: 2.1, marginBottom: 8 }}>
                            Correct answer: {quizFeedback.correctAnswer}
                          </div>
                        )}
                        <div style={{ fontFamily: PX, fontSize: tSize(5.1), color: 'rgba(245,228,168,0.72)', lineHeight: 2.2 }}>
                          {quizFeedback.explanation}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={quizFeedback ? continueQuiz : submitQuizOption}
                      disabled={quizFeedback ? false : !selectedOption}
                      style={{
                        width: '100%',
                        padding: '15px 18px',
                        borderRadius: 16,
                        cursor: quizFeedback || selectedOption ? 'pointer' : 'not-allowed',
                        background: quizFeedback || selectedOption
                          ? 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.16))'
                          : 'rgba(46,184,122,0.05)',
                        border: `1px solid ${quizFeedback || selectedOption ? 'rgba(46,184,122,0.26)' : 'rgba(46,184,122,0.08)'}`,
                        color: quizFeedback || selectedOption ? 'rgba(245,228,168,0.92)' : 'rgba(245,228,168,0.34)',
                        fontFamily: PX,
                        fontSize: tSize(5.6),
                        letterSpacing: '0.06em',
                        lineHeight: 2,
                        transition: 'all .22s ease',
                      }}
                    >
                      {quizFeedback
                        ? (questionIndex + 1 >= 3
                            ? (quizFeedback.score >= QUIZ_PASS_TARGET ? 'OPEN FLASHCARDS →' : 'SEE RESULTS →')
                            : 'NEXT →')
                        : 'CHECK →'}
                    </button>
                  </div>
                )}

                {recallStage === 'flashcards' && activeCard && (
                  <div style={{ display: 'grid', gap: 18, animation: 'stageRise .45s ease forwards' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 999,
                        background: 'rgba(40,180,120,0.08)',
                        border: '1px solid rgba(40,180,120,0.18)',
                        fontFamily: PX,
                        fontSize: tSize(4.8),
                        color: 'rgba(40,180,120,0.56)',
                        letterSpacing: '0.08em',
                        lineHeight: 2,
                      }}>
                        FLASHCARDS · {flashcardIndex + 1}/3
                      </div>
                      <div style={{ fontFamily: PX, fontSize: tSize(5), color: 'rgba(200,180,40,0.46)', lineHeight: 2 }}>
                        COMPLETE ALL TO MOVE ON
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 999,
                          background: index < flashcardIndex
                            ? 'rgba(46,184,122,0.55)'
                            : index === flashcardIndex
                              ? 'rgba(120,210,170,0.54)'
                              : 'rgba(196,154,60,0.12)',
                        }} />
                      ))}
                    </div>

                    <div style={{
                      position: 'relative',
                      minHeight: 410,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {[18, 9].map((offset, index) => (
                        <div key={index} style={{
                          position: 'absolute',
                          width: '78%',
                          maxWidth: 560,
                          aspectRatio: '1.46 / 1',
                          borderRadius: 26,
                          background: 'linear-gradient(135deg, rgba(196,154,60,0.06), rgba(40,180,120,0.04))',
                          border: '1px solid rgba(196,154,60,0.08)',
                          transform: `translateY(${offset}px) scale(${1 - index * 0.03})`,
                          opacity: 0.6 - index * 0.12,
                        }} />
                      ))}

                      <button
                        onClick={() => setFlashcardFlipped(prev => !prev)}
                        onMouseEnter={() => setFlashcardHovered(true)}
                        onMouseLeave={() => setFlashcardHovered(false)}
                        style={{
                          position: 'relative',
                          width: '78%',
                          maxWidth: 560,
                          aspectRatio: '1.46 / 1',
                          borderRadius: 28,
                          padding: '28px 30px',
                          cursor: 'pointer',
                          background: flashcardFlipped
                            ? 'linear-gradient(145deg, rgba(40,180,120,0.14), rgba(196,154,60,0.1))'
                            : 'linear-gradient(145deg, rgba(196,154,60,0.14), rgba(40,180,120,0.08))',
                          border: `1px solid ${flashcardHovered ? 'rgba(120,210,170,0.28)' : 'rgba(196,154,60,0.18)'}`,
                          boxShadow: flashcardHovered
                            ? '0 24px 48px rgba(4,14,8,0.36), 0 0 34px rgba(120,210,170,0.12)'
                            : '0 18px 38px rgba(4,14,8,0.28), 0 0 24px rgba(196,154,60,0.08)',
                          transform: flashcardHovered ? 'translateY(-4px)' : 'translateY(0)',
                          transition: 'all .28s cubic-bezier(.16,1,.3,1)',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: flashcardHovered
                            ? 'radial-gradient(circle at 20% 20%, rgba(120,210,170,0.12), transparent 45%)'
                            : 'radial-gradient(circle at 20% 20%, rgba(232,197,106,0.08), transparent 42%)',
                          pointerEvents: 'none',
                        }} />
                        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}>
                            <div style={{ fontFamily: PX, fontSize: tSize(5), color: 'rgba(40,180,120,0.48)', lineHeight: 2 }}>
                              {flashcardFlipped ? 'ANSWER' : 'CARD'}
                            </div>
                            <div style={{ fontFamily: PX, fontSize: tSize(4.5), color: 'rgba(200,180,40,0.44)', lineHeight: 2 }}>
                              HOVER CALM · CLICK TO FLIP
                            </div>
                          </div>

                          <div style={{
                            fontFamily: PX,
                            fontSize: flashcardFlipped ? tSize(6.4) : tSize(7.8),
                            color: 'rgba(245,228,168,0.94)',
                            lineHeight: 2.05,
                            textAlign: 'center',
                            padding: '10px 4px',
                          }}>
                            {flashcardFlipped ? activeCard.back : activeCard.front}
                          </div>

                          <div style={{ fontFamily: PX, fontSize: tSize(4.8), color: 'rgba(220,200,160,0.46)', lineHeight: 2, textAlign: 'center' }}>
                            {flashcardFlipped ? 'press again to review' : 'tap the card to reveal the answer'}
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => setFlashcardFlipped(prev => !prev)}
                        style={{
                          flex: 1,
                          minWidth: 220,
                          padding: '14px 16px',
                          borderRadius: 16,
                          cursor: 'pointer',
                          background: 'rgba(196,154,60,0.08)',
                          border: '1px solid rgba(196,154,60,0.16)',
                          color: 'rgba(245,228,168,0.82)',
                          fontFamily: PX,
                          fontSize: tSize(5.2),
                          lineHeight: 2,
                        }}
                      >
                        {flashcardFlipped ? 'SEE FRONT AGAIN' : 'FLIP CARD'}
                      </button>
                      <button
                        onClick={() => flashcardFlipped && advanceFlashcard()}
                        disabled={!flashcardFlipped}
                        style={{
                          flex: 1,
                          minWidth: 220,
                          padding: '14px 16px',
                          borderRadius: 16,
                          cursor: flashcardFlipped ? 'pointer' : 'not-allowed',
                          background: flashcardFlipped
                            ? 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(120,210,170,0.14))'
                            : 'rgba(46,184,122,0.05)',
                          border: `1px solid ${flashcardFlipped ? 'rgba(46,184,122,0.22)' : 'rgba(46,184,122,0.08)'}`,
                          color: flashcardFlipped ? 'rgba(245,228,168,0.92)' : 'rgba(245,228,168,0.34)',
                          fontFamily: PX,
                          fontSize: tSize(5.2),
                          lineHeight: 2,
                        }}
                      >
                        {flashcardIndex + 1 >= 3 ? 'CLOSE SET →' : 'NEXT →'}
                      </button>
                    </div>
                  </div>
                )}

                {recallStage === 'practice' && selectedLessonRef.current && (
                  <div style={{ animation: 'stageRise .45s ease forwards' }}>
                    <LessonPractice
                      courseId={Number(selectedCourse?.id || 0)}
                      lesson={selectedLessonRef.current}
                      nextTeaser={nextTeacherTeaser}
                      onReview={() => {
                        void window.aura.educator.resetLessonRecall(selectedLessonRef.current?.id || 0)
                        setRecallStage('hidden')
                        setTeacherMood('idle')
                      }}
                      onReward={(reward) => {
                        setLessonReward(reward)
                        showXP(reward.totalXp)
                      }}
                      onComplete={continueAfterCheckpoint}
                      onOpenGameMix={onOpenGames}
                      gameReinforcement={gameReinforcement?.lessonId === selectedLessonRef.current.id ? gameReinforcement : null}
                      onAcknowledgeGameReinforcement={onAcknowledgeGameReinforcement}
                    />
                  </div>
                )}

                {recallStage === 'failed' && (
                  <div style={{
                    padding: '30px 28px',
                    borderRadius: 18,
                    background: 'rgba(4,14,8,0.72)',
                    border: '1px solid rgba(220,80,80,0.18)',
                    textAlign: 'center',
                    animation: 'stageRise .45s ease forwards',
                  }}>
                    <div style={{ fontSize: 30, marginBottom: 14 }}>↺</div>
                    <div style={{ fontFamily: PX, fontSize: tSize(7.6), color: 'rgba(255,180,180,0.86)', lineHeight: 2, marginBottom: 10 }}>
                      NOT ENOUGH YET
                    </div>
                    <div style={{ fontFamily: PX, fontSize: tSize(5.4), color: 'rgba(245,228,168,0.68)', lineHeight: 2.25, marginBottom: 18 }}>
                      You need 2 correct answers out of 3. We'll redo the lesson from scratch, without moving on.
                    </div>
                    <button onClick={retryLesson} style={{
                      width: '100%',
                      padding: '15px 18px',
                      borderRadius: 16,
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(220,80,80,0.16), rgba(196,154,60,0.12))',
                      border: '1px solid rgba(220,80,80,0.22)',
                      color: 'rgba(245,228,168,0.9)',
                      fontFamily: PX,
                      fontSize: tSize(5.6),
                      lineHeight: 2,
                    }}>
                      REDO LESSON →
                    </button>
                  </div>
                )}

                {recallStage === 'passed' && (
                  <div style={{
                    padding: '30px 28px',
                    borderRadius: 18,
                    background: 'rgba(4,14,8,0.74)',
                    border: '1px solid rgba(46,184,122,0.2)',
                    textAlign: 'center',
                    animation: 'stageRise .45s ease forwards',
                    boxShadow: '0 0 34px rgba(46,184,122,0.08)',
                  }}>
                    <div style={{ fontSize: 34, marginBottom: 14 }}>✦</div>
                    <div style={{ fontFamily: PX, fontSize: tSize(7.8), color: 'rgba(46,184,122,0.92)', lineHeight: 2, marginBottom: 10 }}>
                      CHECKPOINT PASSED
                    </div>
                    <div style={{ fontFamily: PX, fontSize: tSize(5.4), color: 'rgba(245,228,168,0.72)', lineHeight: 2.25, marginBottom: 8 }}>
                      You got the minimum 2 out of 3 and completed all 3 flashcards.
                    </div>
                    <div style={{ fontFamily: PX, fontSize: tSize(5.2), color: 'rgba(200,180,40,0.62)', lineHeight: 2.1, marginBottom: 10 }}>
                      +{lessonReward?.normalXp || 0} NORMAL XP · +{lessonReward?.bonusXp || 0} BONUS XP
                    </div>
                    <div style={{ fontFamily: PX, fontSize: tSize(4.9), color: lessonReward?.milestoneReached ? 'rgba(46,184,122,0.72)' : 'rgba(245,228,168,0.6)', lineHeight: 2.2, marginBottom: 8 }}>
                      {lessonReward?.milestoneLabel || 'The next milestone is close.'}
                    </div>
                    <div style={{ fontFamily: PX, fontSize: tSize(4.8), color: 'rgba(200,180,40,0.54)', lineHeight: 2.1, marginBottom: 18 }}>
                      {lessonReward?.celebrationText || 'You locked in another concept.'}
                    </div>
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'rgba(196,154,60,0.06)',
                      border: '1px solid rgba(196,154,60,0.14)',
                      marginBottom: 18,
                    }}>
                      <div style={{ fontFamily: PX, fontSize: tSize(4.1), color: 'rgba(200,180,40,0.46)', lineHeight: 1.9, letterSpacing: '0.08em', marginBottom: 6 }}>
                        NEXT UP
                      </div>
                      <div style={{ fontFamily: UI, fontSize: 17, color: 'rgba(235,225,205,0.76)', lineHeight: 1.55 }}>
                        {nextTeacherTeaser}
                      </div>
                    </div>
                    <button onClick={continueAfterCheckpoint} style={{
                      width: '100%',
                      padding: '15px 18px',
                      borderRadius: 16,
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.16))',
                      border: '1px solid rgba(46,184,122,0.24)',
                      color: 'rgba(245,228,168,0.94)',
                      fontFamily: PX,
                      fontSize: tSize(5.6),
                      lineHeight: 2,
                    }}>
                      CONTINUE →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <XPToast amount={xpToast?.amount || 0} visible={!!xpToast} />
      <style>{KEYFRAMES}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// KEYFRAMES
// ═════════════════════════════════════════════════════════════════════════════
const KEYFRAMES = `
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes stageRise { from{opacity:0;transform:translateY(12px) scale(.985)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes xpFloat { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-30px)} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes auraPulse { 0%,100%{transform:scale(1);opacity:.72} 50%{transform:scale(1.06);opacity:1} }
  @keyframes orbBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
  @keyframes orbSpeak { 0%,100%{transform:scale(1)} 25%{transform:scale(1.04)} 75%{transform:scale(.97)} }
  @keyframes orbSpin { 0%{transform:rotate(0) scale(1)} 50%{transform:rotate(3deg) scale(1.01)} 100%{transform:rotate(0) scale(1)} }
  @keyframes orbBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes orbPulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.6;transform:scale(1.1)} }
  @keyframes faceSpeak { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1px)} }
  @keyframes eyeLook { 0%,100%{transform:translateX(0)} 30%{transform:translateX(2px)} 60%{transform:translateX(-2px)} }
  @keyframes mouthTalk { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(.6)} }
  @keyframes thinkDot { 0%,100%{opacity:.15;transform:translateY(0)} 50%{opacity:.5;transform:translateY(-2px)} }
`
