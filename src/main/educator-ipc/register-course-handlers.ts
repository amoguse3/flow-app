import { ipcMain, type WebContents } from 'electron'
import {
  addCourseIntakeAnswer,
  clearCourseIntakeAnswers,
  createCourse,
  createCourseGenerationJob,
  createCourseIntakeSession,
  deleteCourse,
  ensureEducatorSchema,
  getAllDueFlashcards,
  getCourse,
  getCourseFeedback as dbGetCourseFeedback,
  getCourseIntakeAnswers,
  getCourses,
  getLatestCourseGenerationJobForCourse,
  listCourseFeedback,
  resetCourseForGenerationRetry,
  updateCourseFeedbackRecommendation,
  updateCourseIntakeSession,
  upsertCourseFeedback,
} from '../db'
import { evaluateCourseCreation, recordCourseCreation } from '../tier-limits'
import type { AppLanguage } from '../../../shared/i18n'
import type {
  CourseFeedbackAnalytics,
  CourseFeedbackContext,
  CourseFeedbackRecord,
  CourseFeedbackSubmission,
  CourseGenerationEvent,
  CourseGenerationRequest,
  CourseGenerationStartResult,
  CourseIntakeQuestion,
  CourseIntakeSession,
  CourseRecommendation,
  CourseFamiliarity,
  UserProfile,
} from '../../../shared/types'

type GenerationProfileLike = any
type CourseGenerationContextLike = any
type CourseRecommendationContextLike = any

interface CourseHandlerDeps {
  getNormalizedProfile: () => UserProfile | null
  getProfileLanguage: (profile: UserProfile | null) => AppLanguage
  getGenerationProfile: (profile: UserProfile | null) => GenerationProfileLike
  normalizeCourseGenerationRequest: (input: string | CourseGenerationRequest | null | undefined) => CourseGenerationRequest
  buildCourseGenerationContext: (request: CourseGenerationRequest, profile: UserProfile | null) => CourseGenerationContextLike
  buildCourseIntakeQuestions: (
    request: CourseGenerationRequest,
    profile: UserProfile | null,
    generation: GenerationProfileLike,
    courseContext: CourseGenerationContextLike,
    language: AppLanguage,
  ) => Promise<CourseIntakeQuestion[]>
  buildCourseIntakeContinuation: (
    request: CourseGenerationRequest,
    profile: UserProfile | null,
    generation: GenerationProfileLike,
    courseContext: CourseGenerationContextLike,
    language: AppLanguage,
  ) => Promise<{ readyToGenerate: boolean; summary: string; questions: CourseIntakeQuestion[] }>
  buildCourseIntakePreviewSummary: (
    request: CourseGenerationRequest,
    courseContext: CourseGenerationContextLike,
    language: AppLanguage,
  ) => string
  buildQueuedCourseSummary: (language: AppLanguage, courseContext: CourseGenerationContextLike) => string
  localizeText: (language: AppLanguage, variants: { en: string; ru: string; ro: string }) => string
  emitCourseGenerationEvent: (sender: WebContents, payload: CourseGenerationEvent) => void
  runCourseGenerationJob: (params: {
    sender: WebContents
    request: CourseGenerationRequest
    profile: UserProfile | null
    language: AppLanguage
    generation: GenerationProfileLike
    courseContext: CourseGenerationContextLike
    courseId: number
    jobId: number
    queuedSummary: string
  }) => Promise<void>
  toCourseFeedbackRecord: (row: any | null, course: any | null, language: AppLanguage) => CourseFeedbackRecord | null
  buildCourseFeedbackAnalytics: (rows: any[], language: AppLanguage) => CourseFeedbackAnalytics
  normalizeCourseFeedbackInput: (input: CourseFeedbackSubmission | null | undefined) => CourseFeedbackSubmission
  mergeCourseRecommendationContext: (
    base: CourseRecommendationContextLike,
    extra: CourseFeedbackContext | null | undefined,
  ) => CourseRecommendationContextLike
  buildCourseRecommendationContext: (courseId: number) => CourseRecommendationContextLike
  buildCourseRecommendation: (
    course: any,
    feedback: CourseFeedbackSubmission,
    language: AppLanguage,
    context: CourseRecommendationContextLike,
  ) => CourseRecommendation
  normalizeCourseFeedbackContext: (input: CourseFeedbackContext | null | undefined) => CourseFeedbackContext
  refineCourseRecommendationWithAI: (
    course: any,
    feedback: CourseFeedbackRecord,
    profile: UserProfile | null,
    language: AppLanguage,
    context: CourseRecommendationContextLike,
  ) => Promise<CourseRecommendation>
}

export function registerEducatorCourseHandlers(deps: CourseHandlerDeps): void {
  const {
    getNormalizedProfile,
    getProfileLanguage,
    getGenerationProfile,
    normalizeCourseGenerationRequest,
    buildCourseGenerationContext,
    buildCourseIntakeQuestions,
    buildCourseIntakeContinuation,
    buildCourseIntakePreviewSummary,
    buildQueuedCourseSummary,
    localizeText,
    emitCourseGenerationEvent,
    runCourseGenerationJob,
    toCourseFeedbackRecord,
    buildCourseFeedbackAnalytics,
    normalizeCourseFeedbackInput,
    mergeCourseRecommendationContext,
    buildCourseRecommendationContext,
    buildCourseRecommendation,
    normalizeCourseFeedbackContext,
    refineCourseRecommendationWithAI,
  } = deps

  ipcMain.handle('educator:getCourses', async () => getCourses())

  ipcMain.handle('educator:getCourse', async (_event, id: number) => getCourse(id))

  ipcMain.handle('educator:getDueFlashcards', async () => getAllDueFlashcards())

  ipcMain.handle('educator:startCourseIntake', async (_event, requestInput: string | CourseGenerationRequest): Promise<CourseIntakeSession> => {
    const request = normalizeCourseGenerationRequest(requestInput)
    if (!request.topic) {
      throw new Error('Topic is required to start course intake.')
    }

    ensureEducatorSchema()

    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    const generation = getGenerationProfile(profile)
    const courseContext = buildCourseGenerationContext(request, profile)
    const questions = await buildCourseIntakeQuestions(request, profile, generation, courseContext, language)
    const session = createCourseIntakeSession(
      request.topic,
      request.familiarity || 'unsure',
      { request, questions, summary: null },
      'collecting',
    )

    return {
      id: Number(session.id),
      topic: String(session.topic || request.topic),
      requested_familiarity: (session.requested_familiarity as CourseFamiliarity | null) || request.familiarity || 'unsure',
      status: session.status,
      questions,
      summary: null,
      created_at: String(session.created_at),
      updated_at: String(session.updated_at),
    }
  })

  ipcMain.handle('educator:continueCourseIntake', async (_event, sessionId: number, requestInput: string | CourseGenerationRequest): Promise<CourseIntakeSession> => {
    const request = normalizeCourseGenerationRequest(requestInput)
    if (!request.topic) {
      throw new Error('Topic is required to continue course intake.')
    }

    if (!sessionId) {
      throw new Error('Course intake session is required.')
    }

    ensureEducatorSchema()

    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    const generation = getGenerationProfile(profile)
    const courseContext = buildCourseGenerationContext(request, profile)

    clearCourseIntakeAnswers(sessionId)
    for (const answer of request.intakeAnswers || []) {
      if (!answer.question && !answer.answer) continue
      addCourseIntakeAnswer(sessionId, answer.questionId, answer.question, answer.answer)
    }

    const intakePlan = await buildCourseIntakeContinuation(request, profile, generation, courseContext, language)
    const updatedSession = updateCourseIntakeSession(sessionId, {
      status: intakePlan.readyToGenerate ? 'ready' : 'collecting',
      seed_request: JSON.stringify({ request, questions: intakePlan.questions, summary: intakePlan.summary }),
    })

    return {
      id: Number(updatedSession?.id || sessionId),
      topic: String(updatedSession?.topic || request.topic),
      requested_familiarity: (updatedSession?.requested_familiarity as CourseFamiliarity | null) || request.familiarity || 'unsure',
      status: intakePlan.readyToGenerate ? 'ready' : 'collecting',
      questions: intakePlan.questions,
      summary: intakePlan.summary,
      created_at: String(updatedSession?.created_at || ''),
      updated_at: String(updatedSession?.updated_at || ''),
    }
  })

  ipcMain.handle('educator:generateCourse', async (event, requestInput: string | CourseGenerationRequest): Promise<CourseGenerationStartResult> => {
    try {
      const request = normalizeCourseGenerationRequest(requestInput)
      ensureEducatorSchema()
      const topic = request.topic
      const profile = getNormalizedProfile()
      const language = getProfileLanguage(profile)
      const generation = getGenerationProfile(profile)
      const courseContext = buildCourseGenerationContext(request, profile)
      const decision = evaluateCourseCreation(profile)
      if (!decision.allowed) {
        const message = String(decision.message || localizeText(language, {
          en: 'Course generation is temporarily paused.',
          ru: 'Генерация курса временно приостановлена.',
          ro: 'Generarea cursului este temporar întreruptă.',
        }))

        emitCourseGenerationEvent(event.sender, {
          token: message,
          done: true,
          phase: 'failed',
          status: 'failed',
          error: message,
          message,
        })
        return { accepted: false, message }
      }

      const queuedSummary = request.intakeAnswers?.some((item) => item.answer.trim())
        ? buildCourseIntakePreviewSummary(request, courseContext, language)
        : buildQueuedCourseSummary(language, courseContext)

      if (request.intakeSessionId) {
        clearCourseIntakeAnswers(request.intakeSessionId)
        for (const answer of request.intakeAnswers || []) {
          if (!answer.question && !answer.answer) continue
          addCourseIntakeAnswer(request.intakeSessionId, answer.questionId, answer.question, answer.answer)
        }
        updateCourseIntakeSession(request.intakeSessionId, { status: 'submitted' })
      }

      const course = createCourse(
        topic,
        queuedSummary,
        topic,
        0,
        {
          status: 'generating',
          generation_summary: queuedSummary,
          generation_progress: 4,
          generation_phase: 'queued',
          generation_error: null,
        },
      )
      const job = createCourseGenerationJob(course.id, topic, request.familiarity || null, {
        intakeSessionId: request.intakeSessionId || null,
        status: 'queued',
        phase: 'queued',
        progress: 4,
        summary: queuedSummary,
        error: null,
      })

      recordCourseCreation()

      emitCourseGenerationEvent(event.sender, {
        token: localizeText(language, {
          en: '🌱 Seed planted. You can keep browsing while I build the course in the background.\n\n',
          ru: '🌱 Семя посажено. Можно продолжать пользоваться приложением, пока я собираю курс в фоне.\n\n',
          ro: '🌱 Sămânța a fost plantată. Poți continua să folosești aplicația cât timp construiesc cursul în fundal.\n\n',
        }),
        done: false,
        courseId: course.id,
        jobId: job.id,
        progress: 4,
        phase: 'queued',
        status: 'queued',
        message: queuedSummary,
      })
      void runCourseGenerationJob({
        sender: event.sender,
        request,
        profile,
        language,
        generation,
        courseContext,
        courseId: course.id,
        jobId: job.id,
        queuedSummary,
      })

      return {
        accepted: true,
        courseId: course.id,
        jobId: job.id,
        message: queuedSummary,
      }
    } catch (err: any) {
      const message = String(err?.message || 'Course generation failed.')
      emitCourseGenerationEvent(event.sender, {
        token: `\n\n❌ Error: ${message}`,
        done: true,
        phase: 'failed',
        status: 'failed',
        error: message,
        message,
      })
      return { accepted: false, message }
    }
  })

  ipcMain.handle('educator:retryCourseGeneration', async (event, courseId: number): Promise<CourseGenerationStartResult> => {
    ensureEducatorSchema()

    const course = getCourse(courseId)
    if (!course) {
      throw new Error('Course not found.')
    }

    if (course.status !== 'failed') {
      throw new Error('Only failed courses can be retried.')
    }

    const latestJob = getLatestCourseGenerationJobForCourse(courseId)
    const topic = String(latestJob?.topic || course.topic || course.title || '').trim()
    if (!topic) {
      throw new Error('Could not recover the course topic for retry.')
    }

    const intakeSessionId = Number(latestJob?.intake_session_id || 0) || undefined
    const intakeAnswers = intakeSessionId
      ? getCourseIntakeAnswers(intakeSessionId).map((answer) => ({
          questionId: String(answer.question_key || ''),
          question: String(answer.question || ''),
          answer: String(answer.answer || ''),
        }))
      : []

    const request: CourseGenerationRequest = {
      topic,
      familiarity: (latestJob?.familiarity as CourseFamiliarity | null) || undefined,
      intakeSessionId,
      intakeAnswers,
    }

    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    const generation = getGenerationProfile(profile)
    const courseContext = buildCourseGenerationContext(request, profile)
    const queuedSummary = intakeAnswers.some((item) => item.answer.trim())
      ? buildCourseIntakePreviewSummary(request, courseContext, language)
      : buildQueuedCourseSummary(language, courseContext)

    if (request.intakeSessionId) {
      clearCourseIntakeAnswers(request.intakeSessionId)
      for (const answer of request.intakeAnswers || []) {
        if (!answer.question && !answer.answer) continue
        addCourseIntakeAnswer(request.intakeSessionId, answer.questionId, answer.question, answer.answer)
      }
      updateCourseIntakeSession(request.intakeSessionId, { status: 'submitted' })
    }

    resetCourseForGenerationRetry(courseId, {
      status: 'generating',
      generation_summary: queuedSummary,
      generation_progress: 4,
      generation_phase: 'queued',
      generation_error: null,
      description: queuedSummary,
    })

    const job = createCourseGenerationJob(courseId, topic, request.familiarity || null, {
      intakeSessionId: request.intakeSessionId || null,
      status: 'queued',
      phase: 'queued',
      progress: 4,
      summary: queuedSummary,
      error: null,
    })

    emitCourseGenerationEvent(event.sender, {
      token: localizeText(language, {
        en: '🌱 Retry started. I am rebuilding this course in the background.\n\n',
        ru: '🌱 Повторный запуск начался. Я заново собираю этот курс в фоне.\n\n',
        ro: '🌱 Reîncercarea a început. Refac acest curs în fundal.\n\n',
      }),
      done: false,
      courseId,
      jobId: job.id,
      progress: 4,
      phase: 'queued',
      status: 'queued',
      message: queuedSummary,
    })

    void runCourseGenerationJob({
      sender: event.sender,
      request,
      profile,
      language,
      generation,
      courseContext,
      courseId,
      jobId: job.id,
      queuedSummary,
    })

    return {
      accepted: true,
      courseId,
      jobId: job.id,
      message: queuedSummary,
    }
  })

  ipcMain.handle('educator:getCourseFeedback', async (_event, courseId: number): Promise<CourseFeedbackRecord | null> => {
    ensureEducatorSchema()
    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    const course = getCourse(courseId)
    const feedback = dbGetCourseFeedback(courseId)
    return toCourseFeedbackRecord(feedback, course, language)
  })

  ipcMain.handle('educator:getCourseFeedbackAnalytics', async (): Promise<CourseFeedbackAnalytics> => {
    ensureEducatorSchema()
    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    return buildCourseFeedbackAnalytics(listCourseFeedback(), language)
  })

  ipcMain.handle('educator:submitCourseFeedback', async (_event, courseId: number, input: CourseFeedbackSubmission, context?: CourseFeedbackContext | null): Promise<CourseFeedbackRecord> => {
    ensureEducatorSchema()

    const course = getCourse(courseId)
    if (!course) {
      throw new Error('Course not found.')
    }

    if (course.status !== 'completed') {
      throw new Error('Course feedback can only be saved after the course is completed.')
    }

    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    const feedback = normalizeCourseFeedbackInput(input)
    const recommendationContext = mergeCourseRecommendationContext(buildCourseRecommendationContext(courseId), context)
    const recommendation = buildCourseRecommendation(course, feedback, language, recommendationContext)
    const saved = upsertCourseFeedback(courseId, {
      ...feedback,
      recommendation: {
        ...recommendation,
        contextSnapshot: normalizeCourseFeedbackContext(recommendationContext),
      },
    })
    const record = toCourseFeedbackRecord(saved, course, language)
    if (!record) {
      throw new Error('Could not save course feedback.')
    }
    return record
  })

  ipcMain.handle('educator:refineCourseRecommendation', async (_event, courseId: number, context?: CourseFeedbackContext | null): Promise<CourseRecommendation> => {
    ensureEducatorSchema()

    const course = getCourse(courseId)
    if (!course) {
      throw new Error('Course not found.')
    }

    const feedbackRow = dbGetCourseFeedback(courseId)
    if (!feedbackRow) {
      throw new Error('Save course feedback before refining the next recommendation.')
    }

    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    const recommendationContext = mergeCourseRecommendationContext(buildCourseRecommendationContext(courseId), context)
    const feedback = toCourseFeedbackRecord(feedbackRow, course, language)
    if (!feedback) {
      throw new Error('Could not prepare course feedback.')
    }

    const recommendation = await refineCourseRecommendationWithAI(course, feedback, profile, language, recommendationContext)
    updateCourseFeedbackRecommendation(courseId, {
      ...recommendation,
      contextSnapshot: normalizeCourseFeedbackContext(recommendationContext),
    })
    return recommendation
  })

  ipcMain.handle('educator:deleteCourse', async (_event, courseId: number) => {
    deleteCourse(courseId)
  })
}