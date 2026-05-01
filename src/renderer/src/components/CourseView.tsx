import { useState, useEffect, useRef, useCallback } from 'react'
import type { Course, CourseFeedbackRecord, CourseFeedbackSubmission, CourseReinforcementSummary, Flashcard, FlashcardSaveResult, LessonPracticeGameLaunch, LessonPracticeReinforcement, Module, Lesson, TeacherCheckpoint } from '../../../../shared/types'
import FlashcardDeck from './FlashcardDeck'
import LessonViewer from './LessonViewer'
import LessonQuiz from './LessonQuiz'
import LessonPractice from './LessonPractice'

interface Props {
  courseId: number
  onBack: () => void
  entryMode?: 'tree' | 'currentLesson'
  onStartSuggestedCourse?: (topic: string) => void
  onOpenGames?: (launch: LessonPracticeGameLaunch) => void
  gameReinforcement?: LessonPracticeReinforcement | null
  courseReinforcementMap?: Record<number, CourseReinforcementSummary>
  onAcknowledgeGameReinforcement?: (reinforcement: LessonPracticeReinforcement) => void
}

type SubView = 'tree' | 'lesson' | 'lessonQuiz' | 'lessonPractice' | 'moduleCheckpoint' | 'moduleFlashcards'

type RatingField = 'overall_rating' | 'clarity_rating' | 'retention_rating' | 'difficulty_rating' | 'continue_interest_rating'

const DEFAULT_FEEDBACK_DRAFT: CourseFeedbackSubmission = {
  overall_rating: 8,
  clarity_rating: 8,
  retention_rating: 7,
  difficulty_rating: 6,
  continue_interest_rating: 8,
  notes: '',
}

const FEEDBACK_FIELDS: Array<{
  key: RatingField
  label: string
  hint: string
  lowLabel: string
  highLabel: string
}> = [
  {
    key: 'overall_rating',
    label: 'OVERALL VALUE',
    hint: 'Was the course worth the time it took?',
    lowLabel: 'thin',
    highLabel: 'strong',
  },
  {
    key: 'clarity_rating',
    label: 'CLARITY',
    hint: 'Did the lessons explain the ideas cleanly enough?',
    lowLabel: 'foggy',
    highLabel: 'clear',
  },
  {
    key: 'retention_rating',
    label: 'RETENTION',
    hint: 'How much of it feels like it will stay with you?',
    lowLabel: 'slipping',
    highLabel: 'sticky',
  },
  {
    key: 'difficulty_rating',
    label: 'DIFFICULTY',
    hint: 'How intense did the course feel for your current level?',
    lowLabel: 'light',
    highLabel: 'heavy',
  },
  {
    key: 'continue_interest_rating',
    label: 'CONTINUE',
    hint: 'How much do you want another course in this area?',
    lowLabel: 'not now',
    highLabel: 'more please',
  },
]

export default function CourseView({ courseId, onBack, entryMode = 'tree', onStartSuggestedCourse, onOpenGames, gameReinforcement, courseReinforcementMap, onAcknowledgeGameReinforcement }: Props) {
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [expandedMod, setExpandedMod] = useState<number | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [subView, setSubView] = useState<SubView>('tree')
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [devFullAccess, setDevFullAccess] = useState(false)
  const autoOpenKeyRef = useRef('')
  const [loadingLessonId, setLoadingLessonId] = useState<number | null>(null)
  const [lessonLoadError, setLessonLoadError] = useState<string | null>(null)
  const [retryingCourse, setRetryingCourse] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [feedbackRecord, setFeedbackRecord] = useState<CourseFeedbackRecord | null>(null)
  const [feedbackDraft, setFeedbackDraft] = useState<CourseFeedbackSubmission>(DEFAULT_FEEDBACK_DRAFT)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [editingFeedback, setEditingFeedback] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [refiningRecommendation, setRefiningRecommendation] = useState(false)
  const [recommendationError, setRecommendationError] = useState<string | null>(null)
  const [moduleCheckpoint, setModuleCheckpoint] = useState<TeacherCheckpoint | null>(null)
  const [moduleCheckpointIndex, setModuleCheckpointIndex] = useState(0)
  const [moduleCheckpointScore, setModuleCheckpointScore] = useState(0)
  const [moduleCheckpointSelection, setModuleCheckpointSelection] = useState('')
  const [moduleCheckpointFeedback, setModuleCheckpointFeedback] = useState<string | null>(null)
  const [moduleCheckpointError, setModuleCheckpointError] = useState<string | null>(null)
  const [moduleCheckpointLoading, setModuleCheckpointLoading] = useState(false)
  const [moduleCheckpointPassed, setModuleCheckpointPassed] = useState(false)
  const [moduleCheckpointCards, setModuleCheckpointCards] = useState<Flashcard[]>([])
  const [moduleCheckpointSaveResult, setModuleCheckpointSaveResult] = useState<FlashcardSaveResult | null>(null)
  const courseReinforcement = courseReinforcementMap?.[courseId] || feedbackRecord?.context?.reinforcementSummary || null
  const moduleCheckpointPassCount = moduleCheckpoint?.questions?.length
    ? Math.max(
        1,
        Math.min(
          moduleCheckpoint.questions.length,
          Math.ceil(moduleCheckpoint.questions.length * Math.min(1, Math.max(0.34, selectedModule?.pass_threshold || 0.8))),
        ),
      )
    : 0

  const isModuleReadyForCheckpoint = (module: Module | null, moduleLessons: Lesson[]) => (
    Boolean(module) && !module?.completed && moduleLessons.length > 0 && moduleLessons.every((lesson) => lesson.completed)
  )

  const resetModuleCheckpointState = () => {
    setModuleCheckpoint(null)
    setModuleCheckpointIndex(0)
    setModuleCheckpointScore(0)
    setModuleCheckpointSelection('')
    setModuleCheckpointFeedback(null)
    setModuleCheckpointError(null)
    setModuleCheckpointLoading(false)
    setModuleCheckpointPassed(false)
    setModuleCheckpointCards([])
    setModuleCheckpointSaveResult(null)
  }

  const startModuleCheckpoint = async (moduleOverride?: Module, moduleLessonsOverride?: Lesson[]) => {
    const targetModule = moduleOverride || selectedModule
    if (!targetModule) return

    const targetLessons = moduleLessonsOverride && moduleLessonsOverride.length > 0
      ? moduleLessonsOverride
      : targetModule.id === selectedModule?.id && lessons.length > 0
        ? lessons
        : await window.aura.educator.getLessons(targetModule.id)

    if (!isModuleReadyForCheckpoint(targetModule, targetLessons)) return

    const orderedLessons = [...targetLessons].sort((left, right) => left.order_num - right.order_num)
    const sourceLesson = orderedLessons[orderedLessons.length - 1]
    if (!sourceLesson) return

    resetModuleCheckpointState()
    setSelectedModule(targetModule)
    setExpandedMod(targetModule.id)
    setLessons(targetLessons)
    setSelectedLesson(null)
    setSubView('moduleCheckpoint')
    setLessonLoadError(null)
    setModuleCheckpointLoading(true)

    try {
      const checkpoint = await window.aura.educator.generateModuleCheckpoint(targetModule.id)
      setModuleCheckpoint(checkpoint)

      try {
        const saveResult = await window.aura.educator.saveTeacherCheckpointFlashcards(sourceLesson.id, checkpoint.flashcards)
        setModuleCheckpointSaveResult(saveResult)
        const dueCards = await window.aura.educator.getDueFlashcards()
        setModuleCheckpointCards(dueCards.filter((card) => card.module_id === targetModule.id))
      } catch {
        setModuleCheckpointSaveResult(null)
        setModuleCheckpointCards([])
      }
    } catch (err: any) {
      setModuleCheckpointError(err?.message || 'Could not prepare the module checkpoint right now.')
      setModuleCheckpoint(null)
    } finally {
      setModuleCheckpointLoading(false)
    }
  }

  const loadCourseState = useCallback(async () => {
    setLoadError(false)
    const [c, m, snapshot, feedback] = await Promise.all([
      window.aura.educator.getCourse(courseId),
      window.aura.educator.getModules(courseId),
      window.aura.limits.getState(),
      window.aura.educator.getCourseFeedback(courseId),
    ])
    if (!c) {
      setLoadError(true)
      return
    }

    setCourse(c)
    setModules(m || [])
    setDevFullAccess(snapshot.tierMode === 'dev-unlimited')
    setFeedbackRecord(feedback)
    setFeedbackDraft(feedback ? {
      overall_rating: feedback.overall_rating,
      clarity_rating: feedback.clarity_rating,
      retention_rating: feedback.retention_rating,
      difficulty_rating: feedback.difficulty_rating,
      continue_interest_rating: feedback.continue_interest_rating,
      notes: feedback.notes || '',
    } : DEFAULT_FEEDBACK_DRAFT)
    setFeedbackError(null)
    setRecommendationError(null)
    setEditingFeedback(!feedback && c.status === 'completed')
  }, [courseId])

  const retryCourseGeneration = async () => {
    if (!course || course.status !== 'failed' || retryingCourse) return

    setRetryingCourse(true)
    setRetryError(null)
    try {
      await window.aura.educator.retryCourseGeneration(course.id)
      await loadCourseState()
    } catch (error: any) {
      setRetryError(String(error?.message || 'Could not restart course generation.'))
    } finally {
      setRetryingCourse(false)
    }
  }

  const updateFeedbackRating = (field: RatingField, value: number) => {
    setFeedbackDraft((prev) => ({ ...prev, [field]: value }))
  }

  const submitCourseFeedback = async () => {
    if (!course || course.status !== 'completed' || submittingFeedback) return

    setSubmittingFeedback(true)
    setFeedbackError(null)
    setRecommendationError(null)
    try {
      const saved = await window.aura.educator.submitCourseFeedback(
        course.id,
        feedbackDraft,
        courseReinforcement ? { reinforcementSummary: courseReinforcement } : null,
      )
      setFeedbackRecord(saved)
      setFeedbackDraft({
        overall_rating: saved.overall_rating,
        clarity_rating: saved.clarity_rating,
        retention_rating: saved.retention_rating,
        difficulty_rating: saved.difficulty_rating,
        continue_interest_rating: saved.continue_interest_rating,
        notes: saved.notes || '',
      })
      setEditingFeedback(false)
    } catch (error: any) {
      setFeedbackError(String(error?.message || 'Could not save your course reflection.'))
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const startSuggestedCourse = () => {
    const topic = feedbackRecord?.recommendation?.topic?.trim()
    if (!topic || !onStartSuggestedCourse) return
    setShowFeedbackModal(false)
    onStartSuggestedCourse(topic)
  }

  const refineCourseRecommendation = async () => {
    if (!course || !feedbackRecord || refiningRecommendation) return

    setRefiningRecommendation(true)
    setRecommendationError(null)
    try {
      const recommendation = await window.aura.educator.refineCourseRecommendation(
        course.id,
        courseReinforcement ? { reinforcementSummary: courseReinforcement } : null,
      )
      setFeedbackRecord((prev) => prev ? {
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

  const hydrateLesson = async (lesson: Lesson): Promise<Lesson> => {
    const readyLesson = await window.aura.educator.prepareLesson(lesson.id)
    if (!readyLesson) throw new Error('Could not prepare the lesson.')
    setLessons(prev => prev.map(item => item.id === readyLesson.id ? readyLesson : item))
    return readyLesson
  }

  const resetLessonRecall = async (lessonId?: number | null) => {
    if (!lessonId) return
    try {
      await window.aura.educator.resetLessonRecall(lessonId)
    } catch {
      // Recall reset is best-effort; lesson flow should still continue.
    }
  }

  const buildNextTeaser = (lesson: Lesson | null): string | null => {
    if (!lesson) return null

    const currentIndex = lessons.findIndex(item => item.id === lesson.id)
    const nextLesson = currentIndex >= 0 ? lessons[currentIndex + 1] : null
    if (nextLesson) return `Next: ${nextLesson.title}`

    const nextModule = selectedModule
      ? modules
          .filter(module => module.unlocked && module.order_num > selectedModule.order_num)
          .sort((left, right) => left.order_num - right.order_num)[0]
      : null

    if (nextModule) return `Next module ${nextModule.order_num}: ${nextModule.title}`
    return 'Almost there — you\'re about to finish the entire course.'
  }

  useEffect(() => {
    loadCourseState().catch(() => setLoadError(true))
  }, [loadCourseState])

  useEffect(() => {
    const unsubscribe = window.aura.educator.onCourseGenToken((event) => {
      if (event.courseId !== courseId) return
      loadCourseState().catch(() => null)
    })
    return unsubscribe
  }, [courseId, loadCourseState])

  useEffect(() => {
    if (entryMode !== 'currentLesson') {
      autoOpenKeyRef.current = ''
      return
    }
    if (modules.length === 0) return

    const autoOpenKey = `${courseId}:${entryMode}`
    if (autoOpenKeyRef.current === autoOpenKey) return
    autoOpenKeyRef.current = autoOpenKey

    let cancelled = false

    const focusCurrentLesson = async () => {
      const unlockedModules = [...modules]
        .filter(module => module.unlocked)
        .sort((left, right) => left.order_num - right.order_num)

      let fallbackModule: Module | null = null
      let fallbackLessons: Lesson[] = []

      for (const module of unlockedModules) {
        const moduleLessons = await window.aura.educator.getLessons(module.id)
        if (cancelled) return
        if (!fallbackModule && moduleLessons.length > 0) {
          fallbackModule = module
          fallbackLessons = moduleLessons
        }

        if (isModuleReadyForCheckpoint(module, moduleLessons)) {
          setSelectedModule(module)
          setExpandedMod(module.id)
          setLessons(moduleLessons)
          setSelectedLesson(null)
          setSubView('tree')
          setLessonLoadError(null)
          return
        }

        const nextLesson = moduleLessons.find(lesson => !lesson.completed)
        if (nextLesson) {
          setSelectedModule(module)
          setExpandedMod(module.id)
          setLessons(moduleLessons)
          setSelectedLesson(null)
          setSubView('tree')
          setLessonLoadError(null)
          return
        }
      }

      if (fallbackModule && fallbackLessons[0]) {
        setSelectedModule(fallbackModule)
        setExpandedMod(fallbackModule.id)
        setLessons(fallbackLessons)
        setSelectedLesson(null)
        setSubView('tree')
        setLessonLoadError(null)
      }
    }

    focusCurrentLesson().catch(() => {
      autoOpenKeyRef.current = ''
      setLessonLoadError('Could not load the course path right now.')
    })

    return () => {
      cancelled = true
    }
  }, [courseId, entryMode, modules])

  useEffect(() => {
    if (course?.status !== 'completed') {
      setShowFeedbackModal(false)
      return
    }

    if (!feedbackRecord || editingFeedback) {
      setShowFeedbackModal(true)
    }
  }, [course?.status, feedbackRecord, editingFeedback])

  const expandModule = async (mod: Module) => {
    if (expandedMod === mod.id) { setExpandedMod(null); return }
    setExpandedMod(mod.id)
    setSelectedModule(mod)
    const l = await window.aura.educator.getLessons(mod.id)
    setLessons(l)
  }

  const openLesson = async (lesson: Lesson) => {
    setLessonLoadError(null)
    setLoadingLessonId(lesson.id)
    try {
      const readyLesson = await hydrateLesson(lesson)
      setSelectedLesson(readyLesson)
      setSubView('lesson')
    } catch (err: any) {
      setLessonLoadError(err?.message || 'Could not prepare the lesson right now.')
    } finally {
      setLoadingLessonId(null)
    }
  }

  const startQuiz = () => {
    setSubView('lessonQuiz')
  }

  const reviewLesson = async () => {
    await resetLessonRecall(selectedLesson?.id)
    setSubView('lesson')
  }

  const exitLessonRecallToTree = async () => {
    await resetLessonRecall(selectedLesson?.id)
    setSubView('tree')
    setSelectedLesson(null)
  }

  const retryModuleCheckpoint = () => {
    setModuleCheckpointIndex(0)
    setModuleCheckpointScore(0)
    setModuleCheckpointSelection('')
    setModuleCheckpointFeedback(null)
    setModuleCheckpointPassed(false)
    setSubView('moduleCheckpoint')
  }

  const finishModuleCompletion = async () => {
    if (!selectedModule) return

    const completedModuleId = selectedModule.id
    resetModuleCheckpointState()
    await window.aura.educator.completeModule(completedModuleId)
    await window.aura.motivation.addXP(50)

    const updatedModules = await window.aura.educator.getModules(courseId)
    setModules(updatedModules)

    const updatedCourse = await window.aura.educator.getCourse(courseId)
    if (updatedCourse) setCourse(updatedCourse)

    const nextMod = updatedModules.find(m => !m.completed && m.unlocked)
    if (nextMod) {
      setSelectedModule(nextMod)
      setExpandedMod(nextMod.id)
      const nextLessons = await window.aura.educator.getLessons(nextMod.id)
      setLessons(nextLessons)
      const firstLesson = nextLessons.find(l => !l.completed) || nextLessons[0]
      if (firstLesson) {
        setLoadingLessonId(firstLesson.id)
        try {
          const readyLesson = await hydrateLesson(firstLesson)
          setSelectedLesson(readyLesson)
          setSubView('lesson')
          setLessonLoadError(null)
        } catch (err: any) {
          setLessonLoadError(err?.message || 'Could not prepare the lesson right now.')
          setSelectedLesson(null)
          setSubView('tree')
        } finally {
          setLoadingLessonId(null)
        }
        return
      }
    }

    setSelectedLesson(null)
    setSubView('tree')
  }

  const submitModuleCheckpointAnswer = async () => {
    if (!moduleCheckpoint || !selectedModule) return

    const currentQuestion = moduleCheckpoint.questions[moduleCheckpointIndex]
    if (!currentQuestion || !moduleCheckpointSelection) return

    const isCorrect = moduleCheckpointSelection.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()
    const nextScore = moduleCheckpointScore + (isCorrect ? 1 : 0)
    const isLastQuestion = moduleCheckpointIndex + 1 >= moduleCheckpoint.questions.length

    setModuleCheckpointScore(nextScore)
    setModuleCheckpointSelection('')

    if (!isLastQuestion) {
      setModuleCheckpointFeedback(
        isCorrect
          ? currentQuestion.explanation
          : `Correct answer: ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`,
      )
      setModuleCheckpointIndex((prev) => prev + 1)
      return
    }

    if (nextScore >= moduleCheckpointPassCount) {
      setModuleCheckpointPassed(true)
      setModuleCheckpointFeedback(
        moduleCheckpointCards.length > 0
          ? 'Checkpoint passed. Review the mastery cards to lock it in before moving on.'
          : 'Checkpoint passed. The next module is now ready.',
      )
      if (moduleCheckpointCards.length > 0) {
        setSubView('moduleFlashcards')
        return
      }
      await finishModuleCompletion()
      return
    }

    setModuleCheckpointPassed(false)
    setModuleCheckpointFeedback(
      `Checkpoint not passed yet. You need ${moduleCheckpointPassCount}/${moduleCheckpoint.questions.length}. Correct answer: ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`,
    )
  }

  const completeLesson = async () => {
    if (!selectedLesson) return
    await window.aura.educator.completeLesson(selectedLesson.id)
    const updated = lessons.map(l => l.id === selectedLesson.id ? { ...l, completed: true } : l)
    setLessons(updated)
    setSelectedLesson((prev) => prev ? { ...prev, completed: true } : prev)
    await advanceToNext(updated)
  }

  const skipLessonForDeveloper = async () => {
    if (!selectedLesson || !devFullAccess) return
    await window.aura.educator.completeLesson(selectedLesson.id)
    const updated = lessons.map((lesson) => lesson.id === selectedLesson.id ? { ...lesson, completed: true } : lesson)
    setLessons(updated)
    setSelectedLesson((prev) => prev ? { ...prev, completed: true } : prev)
    await advanceToNext(updated)
  }

  const advanceToNext = async (updatedLessons: Lesson[]) => {
    const nextLesson = updatedLessons.find(l => !l.completed)
    if (nextLesson) {
      setLoadingLessonId(nextLesson.id)
      try {
        const readyLesson = await hydrateLesson(nextLesson)
        setSelectedLesson(readyLesson)
        setSubView('lesson')
        setLessonLoadError(null)
      } catch (err: any) {
        setLessonLoadError(err?.message || 'Could not prepare the next lesson right now.')
        setSelectedLesson(null)
        setSubView('tree')
      } finally {
        setLoadingLessonId(null)
      }
    } else if (selectedModule) {
      await startModuleCheckpoint(selectedModule, updatedLessons)
    }
  }

  if (loadError) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 40 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'rgba(220,170,50,0.85)', textAlign: 'center', lineHeight: 2 }}>
          COULD NOT LOAD THE COURSE
        </div>
        <button onClick={onBack} style={{
          fontFamily: "'Press Start 2P', monospace", fontSize: 6, lineHeight: 2,
          padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(196,154,60,0.06)', border: '1px solid rgba(196,154,60,0.2)',
          color: 'rgba(232,197,106,0.7)',
        }}>← BACK TO COURSES</button>
      </div>
    )
  }

  if (!course) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10,
          background: 'radial-gradient(circle at 38% 36%, rgba(196,154,60,0.5), rgba(196,154,60,0.12))',
          border: '1px solid rgba(196,154,60,0.28)',
          boxShadow: '0 0 28px rgba(196,154,60,0.18)',
          animation: 'auraPulse 1.4s ease-in-out infinite',
        }} />
      </div>
    )
  }

  if (course.status === 'generating' || course.status === 'failed') {
    const isGenerating = course.status === 'generating'
    const previewModules = modules.slice(0, 4)
    const progress = isGenerating ? Math.max(4, Number(course.generation_progress || 0)) : 0

    return (
      <div data-tutorial="course-view-root" className="flex-1 overflow-y-auto aura-cv-scroll">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
          .aura-cv-scroll { scrollbar-width: thin; scrollbar-color: rgba(196,154,60,0.1) transparent; }
          .aura-cv-scroll::-webkit-scrollbar { width: 4px; }
          .aura-cv-scroll::-webkit-scrollbar-thumb { background: rgba(196,154,60,0.1); border-radius: 4px; }
          @keyframes auraPulse { 0%,100% { transform: scale(1); opacity: .86; } 50% { transform: scale(1.04); opacity: 1; } }
        `}</style>

        <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 22px 40px', fontFamily: "'Press Start 2P', monospace" }}>
          <button onClick={onBack} style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 6,
            color: 'rgba(196,154,60,0.34)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            lineHeight: 2,
            marginBottom: 16,
          }}>
            ← BACK TO COURSES
          </button>

          <div style={{
            padding: '22px 22px 20px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(8,16,11,0.94), rgba(10,14,11,0.9))',
            border: `1px solid ${isGenerating ? 'rgba(196,154,60,0.18)' : 'rgba(220,120,120,0.2)'}`,
            boxShadow: isGenerating ? '0 0 34px rgba(196,154,60,0.09)' : '0 0 28px rgba(220,120,120,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 5.2, color: isGenerating ? 'rgba(196,154,60,0.44)' : 'rgba(220,120,120,0.58)', lineHeight: 2, letterSpacing: '0.14em' }}>
                  {isGenerating ? 'COURSE IS GROWING' : 'COURSE NEEDS ATTENTION'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(245,228,168,0.88)', lineHeight: 1.9, marginTop: 6 }}>
                  {course.title}
                </div>
              </div>
              <div style={{
                width: 68,
                height: 68,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isGenerating
                  ? 'radial-gradient(circle at 38% 36%, rgba(196,154,60,0.46), rgba(196,154,60,0.12))'
                  : 'radial-gradient(circle at 38% 36%, rgba(220,120,120,0.4), rgba(220,120,120,0.1))',
                border: `1px solid ${isGenerating ? 'rgba(196,154,60,0.24)' : 'rgba(220,120,120,0.24)'}`,
                boxShadow: isGenerating ? '0 0 24px rgba(196,154,60,0.16)' : '0 0 24px rgba(220,120,120,0.12)',
                animation: isGenerating ? 'auraPulse 1.6s ease-in-out infinite' : undefined,
                fontSize: 28,
              }}>
                {isGenerating ? '🌱' : '⚠️'}
              </div>
            </div>

            <div style={{ fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: 18, color: 'rgba(230,220,210,0.84)', lineHeight: 1.6, marginBottom: 16 }}>
              {isGenerating
                ? (course.generation_summary || 'Wispucci AI is still shaping the roadmap and planting the first modules.')
                : (course.generation_error || 'This course stopped before it became ready. You can keep it as a placeholder or create it again later.')}
            </div>

            {isGenerating && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(196,154,60,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, rgba(196,154,60,0.56), rgba(46,184,122,0.42))', transition: 'width .4s ease' }} />
                  </div>
                  <div style={{ fontSize: 6, color: 'rgba(196,154,60,0.46)', lineHeight: 2 }}>{progress}%</div>
                </div>
                <div style={{ fontSize: 5.2, color: 'rgba(196,154,60,0.28)', lineHeight: 2, marginBottom: 16 }}>
                  {course.total_modules > 0
                    ? `${course.total_modules} module${course.total_modules === 1 ? '' : 's'} planned so far`
                    : 'The roadmap is still being drafted'}
                </div>
              </>
            )}

            {previewModules.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 5.1, color: 'rgba(196,154,60,0.34)', letterSpacing: '0.12em', lineHeight: 2, marginBottom: 8 }}>
                  ROADMAP PREVIEW
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {previewModules.map((module, index) => (
                    <div key={module.id} style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(196,154,60,0.035)',
                      border: '1px solid rgba(196,154,60,0.08)',
                    }}>
                      <div style={{ fontSize: 5.4, color: 'rgba(196,154,60,0.38)', lineHeight: 2, marginBottom: 4 }}>
                        MODULE {index + 1}
                      </div>
                      <div style={{ fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: 17, color: 'rgba(240,230,220,0.82)', lineHeight: 1.5 }}>
                        {module.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => { void loadCourseState() }} style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 5.4,
                lineHeight: 2,
                padding: '10px 14px',
                borderRadius: 9,
                cursor: 'pointer',
                background: 'rgba(196,154,60,0.08)',
                border: '1px solid rgba(196,154,60,0.16)',
                color: 'rgba(232,197,106,0.72)',
              }}>
                ↻ REFRESH STATUS
              </button>
              {!isGenerating && (
                <button onClick={() => { void retryCourseGeneration() }} disabled={retryingCourse} style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 5.4,
                  lineHeight: 2,
                  padding: '10px 14px',
                  borderRadius: 9,
                  cursor: retryingCourse ? 'wait' : 'pointer',
                  background: retryingCourse ? 'rgba(220,120,120,0.08)' : 'rgba(220,120,120,0.12)',
                  border: '1px solid rgba(220,120,120,0.2)',
                  color: 'rgba(244,180,180,0.78)',
                  opacity: retryingCourse ? 0.7 : 1,
                }}>
                  {retryingCourse ? '… RETRYING' : '↻ RETRY COURSE'}
                </button>
              )}
              <div style={{ fontSize: 5, color: 'rgba(196,154,60,0.24)', lineHeight: 2 }}>
                {isGenerating ? 'Lessons stay locked until the course becomes active.' : 'The placeholder is preserved so the failure is visible instead of silent.'}
              </div>
            </div>

            {retryError && (
              <div style={{
                marginTop: 12,
                fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
                fontSize: 14,
                color: 'rgba(244,170,170,0.84)',
                lineHeight: 1.5,
              }}>
                {retryError}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loadingLessonId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 10,
            background: 'radial-gradient(circle at 38% 36%, rgba(196,154,60,0.5), rgba(196,154,60,0.12))',
            border: '1px solid rgba(196,154,60,0.28)',
            boxShadow: '0 0 28px rgba(196,154,60,0.18)',
            animation: 'auraPulse 1.4s ease-in-out infinite',
          }} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'rgba(232,197,106,0.7)', lineHeight: 2 }}>
            PREPARING LESSON
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: 'rgba(196,154,60,0.36)', lineHeight: 2 }}>
            content is generated on-open to reduce cost
          </div>
        </div>
      </div>
    )
  }

  if (subView === 'lesson' && selectedLesson) {
    return (
      <LessonViewer
        lesson={selectedLesson}
        lessonTotal={lessons.length}
        onBack={() => { setSubView('tree'); setSelectedLesson(null) }}
        onComplete={startQuiz}
        devSkipEnabled={devFullAccess && !selectedLesson.completed}
        onDevSkip={() => { void skipLessonForDeveloper() }}
      />
    )
  }

  if (subView === 'lessonQuiz' && selectedLesson && selectedModule) {
    return (
      <LessonQuiz
        lesson={selectedLesson}
        nextTeaser={buildNextTeaser(selectedLesson)}
        onPass={() => setSubView('lessonPractice')}
        onReview={() => { void reviewLesson() }}
        onBack={() => { void exitLessonRecallToTree() }}
      />
    )
  }

  if (subView === 'lessonPractice' && selectedLesson) {
    return (
      <LessonPractice
        courseId={courseId}
        lesson={selectedLesson}
        nextTeaser={buildNextTeaser(selectedLesson)}
        onComplete={completeLesson}
        onReview={() => { void reviewLesson() }}
        onOpenGameMix={onOpenGames}
        gameReinforcement={gameReinforcement?.lessonId === selectedLesson.id ? gameReinforcement : null}
        onAcknowledgeGameReinforcement={onAcknowledgeGameReinforcement}
      />
    )
  }

  if (subView === 'moduleCheckpoint' && selectedModule) {
    const currentQuestion = moduleCheckpoint?.questions[moduleCheckpointIndex] || null
    const questionCount = moduleCheckpoint?.questions.length || 0
    const saveSummaryText = moduleCheckpointSaveResult
      ? `${moduleCheckpointSaveResult.saved} new card${moduleCheckpointSaveResult.saved === 1 ? '' : 's'} saved${moduleCheckpointSaveResult.duplicates > 0 ? ` · ${moduleCheckpointSaveResult.duplicates} already existed` : ''}`
      : null

    return (
      <div style={{
        minHeight: '100%',
        padding: '28px 22px 40px',
        background: 'radial-gradient(circle at top, rgba(196,154,60,0.14), rgba(9,13,11,0.98) 62%)',
        color: '#f4eac8',
      }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <button
            onClick={() => { setSubView('tree'); setSelectedLesson(null) }}
            style={{
              alignSelf: 'flex-start',
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid rgba(196,154,60,0.18)',
              background: 'rgba(17,24,20,0.88)',
              color: 'rgba(245,228,168,0.82)',
              fontSize: '5px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Back To Module Map
          </button>

          <div style={{
            padding: '20px 22px',
            borderRadius: 22,
            border: '1px solid rgba(196,154,60,0.18)',
            background: 'linear-gradient(180deg, rgba(20,28,24,0.96), rgba(11,16,13,0.96))',
            boxShadow: '0 22px 48px rgba(0,0,0,0.28)',
          }}>
            <div style={{ fontSize: '5px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(196,154,60,0.58)', lineHeight: 2.1 }}>
              Module-End Checkpoint
            </div>
            <h2 style={{ margin: '10px 0 8px', fontSize: '16px', color: '#f9f1d6', lineHeight: 1.35 }}>
              {selectedModule.title}
            </h2>
            <p style={{ margin: 0, fontSize: '6px', lineHeight: 2.05, color: 'rgba(236,226,198,0.78)' }}>
              Pass {Math.max(1, moduleCheckpointPassCount)}/{Math.max(1, questionCount)} to unlock the next module. As soon as this checkpoint loads, its flashcards are saved into your mastery deck so you can review before retrying if needed.
            </p>
            {saveSummaryText && (
              <div style={{ marginTop: 12, fontSize: '5px', lineHeight: 2, color: 'rgba(130,210,170,0.82)' }}>
                {saveSummaryText}
              </div>
            )}
            {moduleCheckpointCards.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '5px', lineHeight: 2, color: 'rgba(210,220,255,0.78)' }}>
                {moduleCheckpointCards.length} due mastery card{moduleCheckpointCards.length === 1 ? '' : 's'} ready for review.
              </div>
            )}
          </div>

          {moduleCheckpointLoading ? (
            <div style={{
              padding: '24px 22px',
              borderRadius: 22,
              border: '1px solid rgba(196,154,60,0.16)',
              background: 'rgba(12,18,15,0.96)',
              fontSize: '6px',
              color: 'rgba(245,228,168,0.74)',
              lineHeight: 2,
            }}>
              Preparing a module checkpoint from the lessons you just finished.
            </div>
          ) : moduleCheckpointError ? (
            <div style={{
              padding: '24px 22px',
              borderRadius: 22,
              border: '1px solid rgba(255,148,148,0.16)',
              background: 'rgba(24,12,12,0.94)',
              color: 'rgba(255,204,204,0.82)',
            }}>
              <div style={{ fontSize: '6px', lineHeight: 2 }}>{moduleCheckpointError}</div>
              <button
                onClick={() => { void startModuleCheckpoint(selectedModule, lessons) }}
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,173,173,0.22)',
                  background: 'rgba(55,22,22,0.92)',
                  color: 'rgba(255,224,224,0.88)',
                  fontSize: '5px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                Retry Checkpoint Load
              </button>
            </div>
          ) : moduleCheckpoint ? (
            <>
              <div style={{
                padding: '20px 22px',
                borderRadius: 22,
                border: '1px solid rgba(196,154,60,0.16)',
                background: 'rgba(12,18,15,0.96)',
              }}>
                <div style={{ fontSize: '5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(196,154,60,0.58)', lineHeight: 2.1 }}>
                  Anchor Highlights
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  {moduleCheckpoint.anchors.map((anchor, index) => (
                    <div key={`${anchor}-${index}`} style={{
                      padding: '12px 14px',
                      borderRadius: 16,
                      border: '1px solid rgba(196,154,60,0.14)',
                      background: 'rgba(196,154,60,0.07)',
                      fontSize: '6px',
                      lineHeight: 1.9,
                      color: 'rgba(248,241,216,0.9)',
                    }}>
                      {anchor}
                    </div>
                  ))}
                </div>
              </div>

              {currentQuestion && (
                <div style={{
                  padding: '20px 22px',
                  borderRadius: 22,
                  border: '1px solid rgba(196,154,60,0.16)',
                  background: 'rgba(12,18,15,0.96)',
                }}>
                  <div style={{ fontSize: '5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(196,154,60,0.58)', lineHeight: 2.1 }}>
                    Question {moduleCheckpointIndex + 1} / {questionCount}
                  </div>
                  <div style={{ marginTop: 10, fontSize: '8px', lineHeight: 1.8, color: '#f9f1d6' }}>
                    {currentQuestion.question}
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {currentQuestion.options.map((option) => {
                      const selected = moduleCheckpointSelection === option
                      return (
                        <button
                          key={option}
                          onClick={() => setModuleCheckpointSelection(option)}
                          style={{
                            textAlign: 'left',
                            padding: '12px 14px',
                            borderRadius: 16,
                            border: selected ? '1px solid rgba(232,197,106,0.42)' : '1px solid rgba(196,154,60,0.14)',
                            background: selected ? 'rgba(196,154,60,0.14)' : 'rgba(16,22,19,0.92)',
                            color: selected ? '#fff4cb' : 'rgba(236,226,198,0.86)',
                            fontSize: '6px',
                            lineHeight: 1.9,
                          }}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>

                  {moduleCheckpointFeedback && (
                    <div style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      borderRadius: 16,
                      border: '1px solid rgba(130,210,170,0.18)',
                      background: 'rgba(18,36,28,0.84)',
                      fontSize: '5px',
                      lineHeight: 2,
                      color: 'rgba(210,245,224,0.84)',
                    }}>
                      {moduleCheckpointFeedback}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                    <button
                      disabled={!moduleCheckpointSelection}
                      onClick={() => { void submitModuleCheckpointAnswer() }}
                      style={{
                        padding: '11px 16px',
                        borderRadius: 999,
                        border: '1px solid rgba(232,197,106,0.24)',
                        background: 'linear-gradient(135deg, rgba(232,197,106,0.16), rgba(196,154,60,0.08))',
                        color: '#fff1be',
                        fontSize: '5px',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        opacity: moduleCheckpointSelection ? 1 : 0.55,
                      }}
                    >
                      {moduleCheckpointIndex + 1 >= questionCount ? 'Finish Checkpoint' : 'Lock Answer'}
                    </button>

                    {moduleCheckpointCards.length > 0 && (
                      <button
                        onClick={() => setSubView('moduleFlashcards')}
                        style={{
                          padding: '11px 16px',
                          borderRadius: 999,
                          border: '1px solid rgba(132,176,255,0.2)',
                          background: 'rgba(30,45,70,0.72)',
                          color: 'rgba(220,234,255,0.88)',
                          fontSize: '5px',
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Open Mastery Cards
                      </button>
                    )}

                    {moduleCheckpointFeedback && !moduleCheckpointPassed && moduleCheckpointIndex + 1 >= questionCount && (
                      <button
                        onClick={retryModuleCheckpoint}
                        style={{
                          padding: '11px 16px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,204,153,0.2)',
                          background: 'rgba(63,38,18,0.8)',
                          color: 'rgba(255,227,190,0.88)',
                          fontSize: '5px',
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Retry Checkpoint
                      </button>
                    )}
                  </div>

                  <div style={{ marginTop: 12, fontSize: '5px', lineHeight: 2, color: 'rgba(196,154,60,0.48)' }}>
                    Score locked: {moduleCheckpointScore}/{questionCount}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    )
  }

  if (subView === 'moduleFlashcards' && selectedModule) {
    return (
      <div style={{
        minHeight: '100%',
        padding: '28px 22px 40px',
        background: 'radial-gradient(circle at top, rgba(96,180,255,0.1), rgba(9,13,11,0.98) 65%)',
        color: '#f4eac8',
      }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 'calc(100vh - 90px)' }}>
          <div style={{
            padding: '18px 20px',
            borderRadius: 22,
            border: '1px solid rgba(96,180,255,0.16)',
            background: 'rgba(12,18,22,0.96)',
          }}>
            <div style={{ fontSize: '5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(140,198,255,0.62)', lineHeight: 2.1 }}>
              Module Mastery Deck
            </div>
            <div style={{ marginTop: 10, fontSize: '8px', lineHeight: 1.6, color: '#eef4ff' }}>
              {selectedModule.title}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '6px', lineHeight: 2, color: 'rgba(216,230,255,0.8)' }}>
              {moduleCheckpointPassed
                ? 'Checkpoint passed. Review the saved cards, then continue into the next module when you close the deck.'
                : 'Review the saved cards, then return to the checkpoint and try again.'}
            </p>
          </div>

          <div style={{
            flex: 1,
            minHeight: 420,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(96,180,255,0.16)',
            background: 'rgba(7,11,15,0.94)',
          }}>
            <FlashcardDeck
              moduleId={selectedModule.id}
              cards={moduleCheckpointCards}
              onBack={() => {
                if (moduleCheckpointPassed) {
                  void finishModuleCompletion()
                  return
                }
                setSubView('moduleCheckpoint')
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const progress = course.total_modules > 0
    ? Math.round((course.completed_modules / course.total_modules) * 100)
    : 0

  const completionSummary = feedbackRecord ? [
    { label: 'VALUE', value: feedbackRecord.overall_rating, accent: 'rgba(232,197,106,0.82)' },
    { label: 'CLARITY', value: feedbackRecord.clarity_rating, accent: 'rgba(210,220,255,0.82)' },
    { label: 'RETENTION', value: feedbackRecord.retention_rating, accent: 'rgba(130,210,170,0.82)' },
    { label: 'DIFFICULTY', value: feedbackRecord.difficulty_rating, accent: 'rgba(244,180,130,0.82)' },
    { label: 'CONTINUE', value: feedbackRecord.continue_interest_rating, accent: 'rgba(200,180,255,0.82)' },
  ] : []
  const reinforcementSummaryText = courseReinforcement
    ? `${courseReinforcement.verifiedGames}/${courseReinforcement.totalGames} verified game loops · +${courseReinforcement.totalPoints} points${courseReinforcement.seededGames > 0 ? ` · ${courseReinforcement.seededGames} lesson-seeded` : ''}`
    : null

  const closeFeedbackModal = () => {
    if (!feedbackRecord || editingFeedback) return
    setShowFeedbackModal(false)
    setFeedbackError(null)
    setRecommendationError(null)
  }

  const feedbackPanelStyle = showFeedbackModal
    ? {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 81,
        width: 'min(860px, calc(100vw - 36px))',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto' as const,
        marginBottom: 0,
        padding: '18px 18px 20px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(8,18,12,0.98), rgba(10,14,11,0.99))',
        border: '1px solid rgba(46,184,122,0.16)',
        boxShadow: '0 24px 90px rgba(0,0,0,0.45)',
      }
    : {
        marginBottom: 24,
        padding: '18px 18px 20px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(8,18,12,0.92), rgba(10,14,11,0.94))',
        border: '1px solid rgba(46,184,122,0.16)',
        boxShadow: '0 0 34px rgba(46,184,122,0.08)',
      }

  return (
    <div data-tutorial="course-view-root" className="flex-1 overflow-y-auto aura-cv-scroll">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .aura-cv-px * { font-family: 'Press Start 2P', monospace !important; }
        .aura-cv-scroll { scrollbar-width: thin; scrollbar-color: rgba(196,154,60,0.1) transparent; }
        .aura-cv-scroll::-webkit-scrollbar { width: 4px; }
        .aura-cv-scroll::-webkit-scrollbar-thumb { background: rgba(196,154,60,0.1); border-radius: 4px; }

        .px-tree { position: relative; padding-left: 50px; margin-top: 8px; }
        .px-tree::before {
          content: ''; position: absolute;
          left: 19px; top: 14px; bottom: 20px; width: 2px;
          background: linear-gradient(180deg,
            rgba(196,154,60,0.52) 0%, rgba(196,154,60,0.28) 35%,
            rgba(196,154,60,0.12) 65%, rgba(196,154,60,0.04) 100%);
          border-radius: 2px;
        }
        .px-tree::after {
          content: ''; position: absolute;
          left: 19px; top: 14px; width: 2px; height: 44px;
          background: linear-gradient(180deg, rgba(232,197,106,0.76), transparent);
          border-radius: 2px;
          animation: pxEnergyFlow 3s ease-in-out infinite;
        }
        @keyframes pxEnergyFlow {
          0%   { top: 14px; opacity: 0.9; }
          100% { top: 80%; opacity: 0; }
        }

        .px-module-node { position: relative; margin-bottom: 6px; animation: pxTreeIn 0.5s cubic-bezier(.16,1,.3,1) both; }
        @keyframes pxTreeIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }

        .px-node-dot {
          position: absolute; left: -38px; top: 18px;
          width: 12px; height: 12px; border-radius: 3px;
          border: 2px solid rgba(196,154,60,0.22);
          background: rgba(196,154,60,0.08);
          transition: all 0.3s; z-index: 2;
        }
        .px-node-dot.unlocked {
          border-color: rgba(232,197,106,0.52);
          background: rgba(196,154,60,0.22);
          box-shadow: 0 0 14px rgba(196,154,60,0.32);
        }
        .px-node-dot.done {
          border-color: rgba(46,184,122,0.56);
          background: rgba(46,184,122,0.22);
          box-shadow: 0 0 14px rgba(46,184,122,0.25);
        }
        .px-node-dot.done::after {
          content: ''; position: absolute; inset: -5px; border-radius: 4px;
          border: 1px solid rgba(46,184,122,0.18);
          animation: pxNodeRing 2.5s ease-in-out infinite;
        }
        @keyframes pxNodeRing {
          0%,100% { transform: scale(1); opacity: 0.5; }
          50%      { transform: scale(1.8); opacity: 0; }
        }

        .px-module-btn {
          width: 100%; text-align: left;
          padding: 14px 16px; border-radius: 10px;
          background: rgba(4,14,8,0.6);
          border: 1px solid rgba(196,154,60,0.1);
          cursor: pointer; transition: all 0.25s cubic-bezier(.16,1,.3,1);
          display: flex; align-items: center; gap: 14px;
          position: relative; overflow: hidden;
        }
        .px-module-btn::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 0% 50%, rgba(196,154,60,0.045), transparent 60%);
          opacity: 0; transition: opacity 0.3s;
        }
        .px-module-btn.open::after { opacity: 1; }
        .px-module-btn.open {
          background: rgba(196,154,60,0.045);
          border-color: rgba(196,154,60,0.2);
          box-shadow: 0 0 30px rgba(196,154,60,0.08);
        }
        .px-module-btn.locked { opacity: 0.4; cursor: not-allowed; }
        .px-module-btn:not(.locked):hover {
          background: rgba(196,154,60,0.055);
          border-color: rgba(196,154,60,0.18);
          transform: translateX(2px);
        }

        .px-module-num {
          width: 42px; height: 42px; border-radius: 7px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px !important;
          background: rgba(196,154,60,0.09);
          border: 1px solid rgba(196,154,60,0.14);
          color: rgba(196,154,60,0.5);
          transition: all 0.3s; line-height: 1;
        }
        .px-module-btn.open .px-module-num {
          background: rgba(196,154,60,0.14);
          border-color: rgba(232,197,106,0.28);
          color: rgba(232,197,106,0.84);
          box-shadow: 0 0 18px rgba(196,154,60,0.16);
        }
        .px-module-num.done-num {
          background: rgba(46,184,122,0.12);
          border-color: rgba(46,184,122,0.26);
          color: rgba(46,184,122,0.76);
        }
        .px-chevron {
          font-size: 8px !important; color: rgba(196,154,60,0.3);
          transition: transform 0.3s cubic-bezier(.16,1,.3,1); flex-shrink: 0;
        }
        .px-module-btn.open .px-chevron { transform: rotate(90deg); color: rgba(196,154,60,0.45); }

        .px-branches {
          margin-left: 44px; padding-top: 6px; padding-bottom: 10px;
          position: relative; overflow: hidden;
          animation: pxBranchOpen 0.38s cubic-bezier(.16,1,.3,1) forwards;
        }
        @keyframes pxBranchOpen {
          from { opacity: 0; max-height: 0; transform: translateY(-4px); }
          to   { opacity: 1; max-height: 700px; transform: translateY(0); }
        }
        .px-branches::before {
          content: ''; position: absolute; left: 8px; top: 6px; bottom: 10px; width: 1px;
          background: linear-gradient(180deg, rgba(196,154,60,0.22), transparent);
        }
        .px-leaf {
          position: relative; padding-left: 28px; margin-bottom: 2px;
          animation: pxLeafIn 0.35s cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes pxLeafIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
        .px-leaf::before {
          content: ''; position: absolute; left: 8px; top: 14px; width: 16px; height: 1px;
          background: rgba(196,154,60,0.16);
        }
        .px-leaf-dot {
          position: absolute; left: 23px; top: 10px; width: 6px; height: 6px;
          border-radius: 2px;
          background: rgba(196,154,60,0.2);
          border: 1px solid rgba(196,154,60,0.16);
          transition: all 0.2s;
        }
        .px-leaf-dot.done-dot { background: rgba(46,184,122,0.29); border-color: rgba(46,184,122,0.26); box-shadow: 0 0 6px rgba(46,184,122,0.18); }
        .px-leaf-btn {
          display: block; width: 100%; text-align: left;
          padding: 8px 13px; border-radius: 7px;
          background: transparent; border: 1px solid transparent;
          cursor: pointer; transition: all 0.2s;
          font-size: 6px !important; color: rgba(220,190,140,0.5); line-height: 2;
          font-family: 'Press Start 2P', monospace !important;
        }
        .px-leaf-btn:hover { background: rgba(196,154,60,0.045); border-color: rgba(196,154,60,0.1); color: rgba(245,228,168,0.84); }
        .px-leaf-btn.done-leaf { color: rgba(196,154,60,0.28); text-decoration: line-through; text-decoration-color: rgba(196,154,60,0.14); }
        .px-leaf-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .px-tree-end { position: relative; padding-left: 50px; padding-top: 6px; padding-bottom: 22px; }
        .px-tree-end::before {
          content: ''; position: absolute; left: 20px; top: 0; width: 2px; height: 12px;
          background: linear-gradient(180deg, rgba(196,154,60,0.18), transparent);
        }
        .px-tree-end-diamond {
          position: absolute; left: 13px; top: 12px; width: 11px; height: 11px;
          background: rgba(196,154,60,0.1); border: 1px solid rgba(196,154,60,0.16);
          transform: rotate(45deg); border-radius: 2px;
        }
        .px-pixel-divider-h {
          height: 8px;
          background: repeating-linear-gradient(90deg,rgba(196,154,60,0.15) 0,rgba(196,154,60,0.15) 4px,transparent 4px,transparent 8px);
          border-radius: 1px; margin-bottom: 20px;
          opacity: 0.5;
        }
        .px-back-btn { font-size: 6px !important; color: rgba(196,154,60,0.3); cursor: pointer; transition: color 0.2s; letter-spacing: 0.08em; line-height: 2; display: inline-flex; align-items: center; gap: 8px; }
        .px-back-btn:hover { color: rgba(232,197,106,0.58); }
        .px-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 5px;
          background: rgba(196,154,60,0.06); border: 1px solid rgba(196,154,60,0.14);
          font-size: 5px !important; color: rgba(196,154,60,0.3); margin-bottom: 14px; line-height: 2; letter-spacing: 0.08em;
        }
        .px-cooldown-badge {
          display: inline-flex; align-items: center;
          padding: 2px 6px; border-radius: 3px;
          font-size: 5px !important; letter-spacing: 0.06em; margin-left: 7px; vertical-align: middle; line-height: 2;
          background: rgba(140,100,20,0.14); border: 1px solid rgba(200,150,30,0.14);
          color: rgba(220,170,50,0.5);
          font-family: 'Press Start 2P', monospace !important;
        }
        .px-course-header-glow {
          position: relative; margin-bottom: 28px;
          animation: pxFadeUp 0.55s cubic-bezier(.16,1,.3,1) forwards;
        }
        .px-course-header-glow::before {
          content: ''; position: absolute; left: -70px; top: -30px;
          width: 340px; height: 240px;
          background: radial-gradient(ellipse at center, rgba(196,154,60,0.07), transparent 70%);
          pointer-events: none;
        }
        @keyframes pxFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .px-main-track {
          flex: 1; height: 8px; border-radius: 3px;
          background: rgba(196,154,60,0.1); overflow: hidden;
        }
        .px-main-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, rgba(196,154,60,0.54), rgba(232,197,106,0.38));
          box-shadow: 0 0 14px rgba(196,154,60,0.36);
          transition: width 1.2s cubic-bezier(.16,1,.3,1);
        }
        .px-main-fill.done {
          background: linear-gradient(90deg, rgba(26,107,80,0.6), rgba(46,184,122,0.45));
          box-shadow: 0 0 14px rgba(46,184,122,0.3);
        }
      `}</style>

      <div className="aura-cv-px" style={{ padding: '30px 42px 40px' }}>
        <div className="px-back-btn" style={{ marginBottom: 28 }} onClick={onBack}>
          ← All courses
        </div>

        {/* Course header */}
        <div className="px-course-header-glow">
          <div className="px-badge">📚 {course.topic || 'Course'} · {course.total_modules} modules</div>
          <h1 style={{ fontSize: '16px', color: 'rgba(245,228,168,0.97)', letterSpacing: '0.02em', marginBottom: 14, lineHeight: 1.8, textShadow: '0 0 40px rgba(196,154,60,0.18)' }}>
            {course.title}
          </h1>
          {course.description && (
            <p style={{ fontSize: '6px', color: 'rgba(196,154,60,0.42)', lineHeight: 2.2, maxWidth: 520, marginBottom: 22 }}>
              {course.description}
            </p>
          )}

          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 440 }}>
            <div className="px-main-track">
              <div className={`px-main-fill${progress === 100 ? ' done' : ''}`} style={{ width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: '9px', color: 'rgba(196,154,60,0.55)' }}>{progress}%</span>
            <span style={{ fontSize: '5px', color: 'rgba(196,154,60,0.3)', lineHeight: 2 }}>
              {course.completed_modules} / {course.total_modules}
            </span>
          </div>
        </div>

        {/* Pixel divider */}
        <div className="px-pixel-divider-h" />

        {course.status === 'completed' && (
          <div style={feedbackPanelStyle}>
            {showFeedbackModal && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}>
                <div>
                  <div style={{ fontSize: '5px', color: 'rgba(46,184,122,0.52)', lineHeight: 2, letterSpacing: '0.12em' }}>COMPLETION REVIEW</div>
                  <div style={{ fontSize: '8px', color: 'rgba(245,228,168,0.88)', lineHeight: 2 }}>{course.title}</div>
                </div>
                {feedbackRecord && !editingFeedback ? (
                  <button onClick={closeFeedbackModal} style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 5,
                    lineHeight: 2,
                    padding: '10px 12px',
                    borderRadius: 9,
                    cursor: 'pointer',
                    background: 'rgba(196,154,60,0.06)',
                    border: '1px solid rgba(196,154,60,0.14)',
                    color: 'rgba(232,197,106,0.72)',
                  }}>
                    CLOSE
                  </button>
                ) : (
                  <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.34)', lineHeight: 2 }}>
                    Save the reflection to leave this review.
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: '5px', color: 'rgba(46,184,122,0.56)', lineHeight: 2, letterSpacing: '0.12em' }}>
              COURSE COMPLETE
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(245,228,168,0.9)', lineHeight: 1.9, marginTop: 6 }}>
              Lock the reflection before choosing the next path.
            </div>
            <div style={{ fontSize: '5.5px', color: 'rgba(210,220,200,0.58)', lineHeight: 2, marginTop: 6, marginBottom: 16 }}>
              {feedbackRecord && !editingFeedback
                ? 'Your completion reflection is saved. The next recommendation now follows actual outcomes instead of guesses.'
                : 'Rate how this course landed so the next recommendation reflects difficulty, retention, and your motivation to continue.'}
            </div>

            {feedbackRecord && !editingFeedback ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
                  {completionSummary.map((item) => (
                    <div key={item.label} style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.34)', lineHeight: 2, marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: '11px', color: item.accent, lineHeight: 1.6 }}>{item.value}/10</div>
                    </div>
                  ))}
                </div>

                {feedbackRecord.notes && (
                  <div style={{
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(196,154,60,0.035)',
                    border: '1px solid rgba(196,154,60,0.08)',
                  }}>
                    <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.34)', lineHeight: 2, marginBottom: 6 }}>NOTES</div>
                    <div style={{ fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: 15, color: 'rgba(240,230,220,0.78)', lineHeight: 1.55 }}>
                      {feedbackRecord.notes}
                    </div>
                  </div>
                )}

                {reinforcementSummaryText && (
                  <div style={{
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(96,180,255,0.04)',
                    border: '1px solid rgba(96,180,255,0.1)',
                  }}>
                    <div style={{ fontSize: '5px', color: 'rgba(96,180,255,0.46)', lineHeight: 2, marginBottom: 6 }}>REINFORCEMENT LOOP</div>
                    <div style={{ fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: 14, color: 'rgba(220,235,245,0.76)', lineHeight: 1.55 }}>
                      {reinforcementSummaryText}
                    </div>
                  </div>
                )}

                {feedbackRecord.recommendation && (
                  <div style={{
                    padding: '14px 14px 16px',
                    borderRadius: 12,
                    background: 'rgba(46,184,122,0.06)',
                    border: '1px solid rgba(46,184,122,0.14)',
                    boxShadow: '0 0 22px rgba(46,184,122,0.06)',
                  }}>
                    <div style={{ fontSize: '5px', color: 'rgba(46,184,122,0.46)', lineHeight: 2, letterSpacing: '0.12em', marginBottom: 6 }}>
                      RECOMMENDED NEXT COURSE
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(228,244,208,0.9)', lineHeight: 1.8, marginBottom: 8 }}>
                      {feedbackRecord.recommendation.title}
                    </div>
                    <div style={{ fontSize: '5px', color: 'rgba(140,220,180,0.56)', lineHeight: 2, marginBottom: 10 }}>
                      {feedbackRecord.recommendation.direction.toUpperCase()} PATH · {feedbackRecord.recommendation.confidence}% fit · {feedbackRecord.recommendation.source === 'ai' ? 'AI REFINED' : 'HEURISTIC BASE'}
                    </div>
                    <div style={{ fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: 15, color: 'rgba(230,240,228,0.78)', lineHeight: 1.55, marginBottom: 14 }}>
                      {feedbackRecord.recommendation.reason}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {onStartSuggestedCourse && (
                        <button onClick={startSuggestedCourse} style={{
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 5.2,
                          lineHeight: 2,
                          padding: '10px 14px',
                          borderRadius: 9,
                          cursor: 'pointer',
                          background: 'rgba(46,184,122,0.14)',
                          border: '1px solid rgba(46,184,122,0.24)',
                          color: 'rgba(210,245,220,0.84)',
                        }}>
                          USE AS NEXT COURSE
                        </button>
                      )}
                      <button onClick={() => { void refineCourseRecommendation() }} disabled={refiningRecommendation} style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 5,
                        lineHeight: 2,
                        padding: '10px 12px',
                        borderRadius: 9,
                        cursor: refiningRecommendation ? 'wait' : 'pointer',
                        background: 'rgba(96,180,255,0.08)',
                        border: '1px solid rgba(96,180,255,0.18)',
                        color: 'rgba(200,225,255,0.74)',
                        opacity: refiningRecommendation ? 0.72 : 1,
                      }}>
                        {refiningRecommendation ? 'REFINING...' : 'AI REFINE'}
                      </button>
                      <button onClick={() => setEditingFeedback(true)} style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 5,
                        lineHeight: 2,
                        padding: '10px 12px',
                        borderRadius: 9,
                        cursor: 'pointer',
                        background: 'rgba(196,154,60,0.06)',
                        border: '1px solid rgba(196,154,60,0.14)',
                        color: 'rgba(232,197,106,0.72)',
                      }}>
                        ADJUST REFLECTION
                      </button>
                    </div>
                    {recommendationError && (
                      <div style={{ marginTop: 10, fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: 14, color: 'rgba(255,186,186,0.82)', lineHeight: 1.45 }}>
                        {recommendationError}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
                  {FEEDBACK_FIELDS.map((field) => {
                    const value = Number(feedbackDraft[field.key] || 0)
                    return (
                      <label key={field.key} style={{
                        display: 'block',
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
                          <span style={{ fontSize: '5px', color: 'rgba(245,228,168,0.76)', lineHeight: 2 }}>{field.label}</span>
                          <span style={{ fontSize: '6px', color: 'rgba(46,184,122,0.82)', lineHeight: 2 }}>{value}/10</span>
                        </div>
                        <div style={{ fontSize: '4.8px', color: 'rgba(196,154,60,0.3)', lineHeight: 2, marginBottom: 8 }}>{field.hint}</div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={value}
                          onChange={(event) => updateFeedbackRating(field.key, Number(event.target.value))}
                          style={{ width: '100%', accentColor: 'rgba(46,184,122,0.9)' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, fontSize: '4.6px', color: 'rgba(196,154,60,0.26)', lineHeight: 2 }}>
                          <span>{field.lowLabel}</span>
                          <span>{field.highLabel}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.34)', lineHeight: 2, marginBottom: 8 }}>OPTIONAL NOTES</div>
                  <textarea
                    value={feedbackDraft.notes || ''}
                    onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, notes: event.target.value.slice(0, 800) }))}
                    placeholder="What should change in the next course?"
                    style={{
                      width: '100%',
                      minHeight: 96,
                      resize: 'vertical',
                      borderRadius: 10,
                      padding: '12px 14px',
                      background: 'rgba(5,12,8,0.84)',
                      border: '1px solid rgba(196,154,60,0.12)',
                      color: 'rgba(236,232,220,0.82)',
                      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
                      fontSize: 15,
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {feedbackError && (
                  <div style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(220,120,120,0.08)',
                    border: '1px solid rgba(220,120,120,0.16)',
                    color: 'rgba(244,180,180,0.82)',
                    fontSize: '5px',
                    lineHeight: 2,
                  }}>
                    {feedbackError}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => { void submitCourseFeedback() }} disabled={submittingFeedback} style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 5.2,
                    lineHeight: 2,
                    padding: '10px 14px',
                    borderRadius: 9,
                    cursor: submittingFeedback ? 'wait' : 'pointer',
                    background: 'rgba(46,184,122,0.14)',
                    border: '1px solid rgba(46,184,122,0.24)',
                    color: 'rgba(210,245,220,0.84)',
                    opacity: submittingFeedback ? 0.7 : 1,
                  }}>
                    {submittingFeedback ? 'SAVING...' : 'SAVE FEEDBACK'}
                  </button>
                  {feedbackRecord && (
                    <button onClick={() => {
                      setEditingFeedback(false)
                      setFeedbackError(null)
                      setFeedbackDraft({
                        overall_rating: feedbackRecord.overall_rating,
                        clarity_rating: feedbackRecord.clarity_rating,
                        retention_rating: feedbackRecord.retention_rating,
                        difficulty_rating: feedbackRecord.difficulty_rating,
                        continue_interest_rating: feedbackRecord.continue_interest_rating,
                        notes: feedbackRecord.notes || '',
                      })
                    }} style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 5,
                      lineHeight: 2,
                      padding: '10px 12px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      background: 'rgba(196,154,60,0.06)',
                      border: '1px solid rgba(196,154,60,0.14)',
                      color: 'rgba(232,197,106,0.72)',
                    }}>
                      CANCEL
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {lessonLoadError && (
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(140,70,20,0.08)',
            border: '1px solid rgba(196,154,60,0.14)',
            color: 'rgba(232,197,106,0.72)',
            fontSize: '6px',
            lineHeight: 2,
          }}>
            {lessonLoadError}
          </div>
        )}

        {entryMode === 'currentLesson' && !lessonLoadError && subView === 'tree' && expandedMod && (
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(46,184,122,0.08)',
            border: '1px solid rgba(46,184,122,0.14)',
            color: 'rgba(196,235,180,0.72)',
            fontSize: '6px',
            lineHeight: 2,
          }}>
            Opened current module. Lesson and quiz are prepared only when you enter them.
          </div>
        )}

        {devFullAccess && subView === 'tree' && (
          <div style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(96,180,255,0.08)',
            border: '1px solid rgba(96,180,255,0.14)',
            color: 'rgba(210,230,255,0.76)',
            fontSize: '6px',
            lineHeight: 2,
          }}>
            DEV FULL ACCESS is active. Locked modules can be opened and the current lesson can be skipped from inside the lesson viewer.
          </div>
        )}

        {/* TREE */}
        <div className="px-tree">
          {modules.map((mod, i) => {
            const isExpanded = expandedMod === mod.id
            const isLocked = !mod.unlocked && !devFullAccess
            const isDone = mod.completed
            const checkpointReady = isExpanded && isModuleReadyForCheckpoint(mod, lessons)

            return (
              <div key={mod.id} className="px-module-node" style={{ animationDelay: `${i * 80}ms` }}>
                {/* Node dot */}
                <div className={`px-node-dot${isDone ? ' done' : isLocked ? '' : ' unlocked'}`} />

                {/* Module button */}
                <button
                  onClick={() => !isLocked && expandModule(mod)}
                  disabled={isLocked}
                  className={`px-module-btn${isExpanded ? ' open' : ''}${isLocked ? ' locked' : ''}`}>
                  <div className={`px-module-num${isDone ? ' done-num' : ''}`}>
                    {isDone ? '✓' : isLocked ? '🔒' : String(mod.order_num).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '7px', color: 'rgba(245,228,168,0.7)', lineHeight: 2, transition: 'color 0.2s' }}>
                      {mod.title}
                    </div>
                    <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.3)', marginTop: 5, lineHeight: 2 }}>
                      {isLocked ? `Unlock after module ${mod.order_num - 1}` : `lessons`}
                    </div>
                  </div>
                  {!isLocked && <span className="px-chevron">▶</span>}
                </button>

                {/* Expanded branches */}
                {isExpanded && !isLocked && (
                  <div className="px-branches">
                    {/* Lessons */}
                    {lessons.map((lesson, li) => (
                      <div key={lesson.id} className="px-leaf" style={{ animationDelay: `${li * 40}ms` }}>
                        <div className={`px-leaf-dot${lesson.completed ? ' done-dot' : ''}`} />
                        <button
                          className={`px-leaf-btn${lesson.completed ? ' done-leaf' : ''}`}
                          onClick={() => { void openLesson(lesson) }}>
                          {lesson.title}
                        </button>
                      </div>
                    ))}

                    {checkpointReady && (
                      <div style={{ marginLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          onClick={() => { void startModuleCheckpoint(mod, lessons) }}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '10px 14px',
                            borderRadius: 999,
                            border: '1px solid rgba(232,197,106,0.22)',
                            background: 'linear-gradient(135deg, rgba(232,197,106,0.14), rgba(196,154,60,0.08))',
                            color: '#fff1be',
                            fontSize: '5px',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Take Module Checkpoint
                        </button>
                        <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.42)', lineHeight: 2 }}>
                          All lessons are done. Finish the module checkpoint to unlock the next step.
                        </div>
                      </div>
                    )}

                    {/* Completed badge */}
                    {mod.completed && (
                      <div style={{ marginLeft: 20, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(46,184,122,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '8px' }}>✓</span>
                        </div>
                        <span style={{ fontSize: '5px', color: 'rgba(46,184,122,0.4)', lineHeight: 2 }}>Module completed</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Tree end marker */}
          <div className="px-tree-end">
            <div className="px-tree-end-diamond" style={{
              background: progress === 100 ? 'rgba(46,184,122,0.18)' : 'rgba(196,154,60,0.1)',
              borderColor: progress === 100 ? 'rgba(46,184,122,0.28)' : 'rgba(196,154,60,0.16)',
            }} />
            <div style={{ fontSize: '5px', color: 'rgba(196,154,60,0.3)', paddingLeft: 12, paddingTop: 10, lineHeight: 2.2 }}>
              {progress === 100
                ? '🎓 The tree has bloomed! Course completed!'
                : `${modules.length} modules · ${progress}% completed · aura growing 🌿`}
            </div>
          </div>
        </div>
      </div>

      {showFeedbackModal && course.status === 'completed' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(3,7,5,0.82)',
          backdropFilter: 'blur(8px)',
        }} />
      )}
    </div>
  )
}