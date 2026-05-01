import { ipcMain } from 'electron'
import { generateWithClaudeWithUsage, CLAUDE_TEACHER_MODEL } from '../claude'
import {
  clearLessonAICache,
  completeLesson as dbCompleteLesson,
  completeModule,
  getLesson,
  getLessonAICache,
  getLessons,
  getModules,
  reviewFlashcard as dbReviewFlashcard,
  setLessonAICache,
} from '../db'
import { buildTeacherLimitToken, evaluateAIBudget } from '../tier-limits'
import type { AppLanguage } from '../../../shared/i18n'
import type { GameType, UserProfile } from '../../../shared/types'

interface GenerationProfileLike {
  quizEstimate: number
  quizDirective: string
  quizMaxTokens: number
  quizSingleExcerptChars: number
  quizRecapExcerptChars: number
  practiceEstimate: number
  practiceDirective: string
  practiceMaxTokens: number
  practiceExcerptChars: number
  checkpointEstimate: number
  checkpointDirective: string
  checkpointMaxTokens: number
  checkpointExcerptChars: number
  explainEstimate: number
  explainDirective: string
  explainMaxTokens: number
  explainExcerptChars: number
  clarifyEstimate: number
  clarifyDirective: string
  clarifyMaxTokens: number
  clarifyExcerptChars: number
}

interface TeacherCheckpointLike {
  anchors?: string[]
  questions?: any[]
  flashcards?: Array<{ front: string; back: string }>
}

interface LessonPracticeLike {
  exercises?: any[]
  recommendedGames?: GameType[]
  gameSeed?: any
}

interface LessonHandlerDeps {
  getNormalizedProfile: () => UserProfile | null
  getGenerationProfile: (profile: UserProfile | null) => GenerationProfileLike
  getProfileLanguage: (profile: UserProfile | null) => AppLanguage
  getCourseForModule: (moduleId: number) => string
  getQuizSourceLessons: (lesson: { id: number; module_id: number; order_num: number; title: string }) => { isRecap: boolean; sourceLessons: any[] }
  ensureLessonContentReady: (lessonId: number, profile: UserProfile | null) => Promise<any | null>
  getPreparedLessonSnapshot: (lessonId: number, profile: UserProfile | null) => any | null
  buildVariantCacheKey: (profile: UserProfile | null, suffix?: string) => string
  buildLessonSupportContext: (lessonId: number, lesson: any, maxChars: number, preferBrief?: boolean) => string
  buildModuleCheckpointDraft: (moduleId: number, profile: UserProfile | null) => Promise<any | null>
  buildModuleCheckpointSupportContext: (moduleDraft: any, maxChars?: number) => string
  normalizeFocusKey: (focus?: string) => string
  normalizeLessonQuiz: (input: any, lesson: { title: string; content: string }) => any[]
  normalizeLessonPractice: (input: any, lesson: { title: string; content: string }, courseTitle: string, language: AppLanguage) => LessonPracticeLike
  normalizeTeacherCheckpoint: (input: any, lesson: { title: string; content: string }) => TeacherCheckpointLike
  fallbackLessonQuiz: (lesson: { title: string; content: string }) => any[]
  fallbackLessonPractice: (lesson: { title: string; content: string }, courseTitle: string, language: AppLanguage) => LessonPracticeLike
  fallbackTeacherCheckpoint: (lesson: { title: string; content: string }, focus?: string) => TeacherCheckpointLike
  detectLanguageLearningSignal: (lesson: { title: string; content: string }, courseTitle: string, language: AppLanguage) => any | null
  buildLanguagePracticeDirective: (signal: any) => string
  saveTeacherCheckpointFlashcards: (lessonId: number, flashcards: Array<{ front: string; back: string }>, profile: UserProfile | null) => any
  stripLessonDraftMarker: (content: string) => string
  parseLooseJson: (raw: string) => any | null
  trackAIUsage: (inputTokens: number, outputTokens: number, source: string) => void
  clampMultilineText: (value: unknown, fallback?: string, max?: number) => string
  buildClarifyCacheKey: (profile: UserProfile | null, question: string) => string
  buildLocalExplainText: (lesson: { title: string; content: string }, language: AppLanguage) => string
  buildLocalClarifyText: (lesson: { title: string; content: string }, question: string, understandingScore?: number | null, language?: AppLanguage) => string
  localizeText: (language: AppLanguage, variants: { en: string; ru: string; ro: string }) => string
  isEducatorLimitError: (error: unknown) => boolean
  prompts: {
    lessonQuiz: string
    recapLessonQuiz: string
    lessonPractice: string
    teacherCheckpoint: string
    moduleCheckpoint: string
    lessonTeacher: string
    lessonClarify: string
  }
  cacheKinds: {
    lessonQuiz: string
    lessonPractice: string
    teacherCheckpoint: string
    moduleCheckpoint: string
    teacherExplain: string
    teacherClarify: string
  }
  requestOptions: {
    artifact: { timeoutMs: number; maxAttempts: number }
    lesson: { timeoutMs: number; maxAttempts: number }
  }
}

export function registerEducatorLessonHandlers(deps: LessonHandlerDeps): void {
  const {
    getNormalizedProfile,
    getGenerationProfile,
    getProfileLanguage,
    getCourseForModule,
    getQuizSourceLessons,
    ensureLessonContentReady,
    getPreparedLessonSnapshot,
    buildVariantCacheKey,
    buildLessonSupportContext,
    buildModuleCheckpointDraft,
    buildModuleCheckpointSupportContext,
    normalizeFocusKey,
    normalizeLessonQuiz,
    normalizeLessonPractice,
    normalizeTeacherCheckpoint,
    fallbackLessonQuiz,
    fallbackLessonPractice,
    fallbackTeacherCheckpoint,
    detectLanguageLearningSignal,
    buildLanguagePracticeDirective,
    saveTeacherCheckpointFlashcards,
    stripLessonDraftMarker,
    parseLooseJson,
    trackAIUsage,
    clampMultilineText,
    buildClarifyCacheKey,
    buildLocalExplainText,
    buildLocalClarifyText,
    localizeText,
    isEducatorLimitError,
    prompts,
    cacheKinds,
    requestOptions,
  } = deps

  ipcMain.handle('educator:prepareLesson', async (_event, lessonId: number) => {
    const profile = getNormalizedProfile()
    const lesson = await ensureLessonContentReady(lessonId, profile)
    return lesson ? { ...lesson, completed: Boolean(lesson.completed) } : null
  })

  ipcMain.handle('educator:resetLessonRecall', async (_event, lessonId: number) => {
    clearLessonAICache(lessonId, cacheKinds.lessonQuiz)
    clearLessonAICache(lessonId, cacheKinds.lessonPractice)
    clearLessonAICache(lessonId, cacheKinds.teacherCheckpoint)
    return { ok: true }
  })

  ipcMain.handle('educator:getModules', async (_event, courseId: number) => {
    return getModules(courseId).map((module) => ({ ...module, unlocked: Boolean(module.unlocked), completed: Boolean(module.completed) }))
  })

  ipcMain.handle('educator:getLessons', async (_event, moduleId: number) => {
    return getLessons(moduleId).map((lesson) => ({ ...lesson, completed: Boolean(lesson.completed) }))
  })

  ipcMain.handle('educator:completeLesson', async (_event, lessonId: number) => {
    dbCompleteLesson(lessonId)
  })

  ipcMain.handle('educator:completeModule', async (_event, moduleId: number) => {
    completeModule(moduleId)
  })

  ipcMain.handle('educator:generateLessonQuiz', async (_event, lessonId: number) => {
    const profile = getNormalizedProfile()
    const generation = getGenerationProfile(profile)
    const lesson = await ensureLessonContentReady(lessonId, profile)
    if (!lesson) return []

    const { isRecap, sourceLessons } = getQuizSourceLessons(lesson)
    const cacheKey = buildVariantCacheKey(profile, isRecap ? 'recap' : 'single')
    const cachedQuiz = getLessonAICache(lesson.id, cacheKinds.lessonQuiz, cacheKey)
    if (Array.isArray(cachedQuiz) && cachedQuiz.length > 0) {
      return cachedQuiz
    }

    const preparedSourceLessons = sourceLessons
      .map((item: any) => getPreparedLessonSnapshot(Number(item.id), profile) || item)

    const quizSource = isRecap
      ? {
          title: lesson.title,
          content: preparedSourceLessons
            .map((item: any) => `${item.title}. ${stripLessonDraftMarker(item.content || '')}`)
            .join('\n\n'),
        }
      : lesson

    let finalQuiz = null as any[] | null
    const aiDecision = evaluateAIBudget(profile, generation.quizEstimate)
    if (aiDecision.allowed) {
      try {
        const quizSupportContext = isRecap
          ? preparedSourceLessons
              .map((item: any) => `${item.title}\n${buildLessonSupportContext(Number(item.id) || lesson.id, item, generation.quizRecapExcerptChars, true)}`)
              .join('\n\n')
          : buildLessonSupportContext(lesson.id, lesson, generation.quizSingleExcerptChars, true)

        const result = await generateWithClaudeWithUsage(
          isRecap ? prompts.recapLessonQuiz : prompts.lessonQuiz,
          [
            generation.quizDirective,
            `Quiz target: ${isRecap ? 'recap over the last 2-3 lessons' : 'one lesson only'}`,
            quizSupportContext,
            'Keep the sequence coherent: recall first, then difference or discrimination, then first application.',
          ].join('\n\n'),
          generation.quizMaxTokens,
          CLAUDE_TEACHER_MODEL,
          requestOptions.artifact,
        )

        finalQuiz = normalizeLessonQuiz(parseLooseJson(result.text), quizSource)
        trackAIUsage(result.inputTokens, result.outputTokens, isRecap ? 'lesson-quiz-recap' : 'lesson-quiz')
      } catch (err) {
        console.error('[educator] AI lesson quiz generation failed; using local fallback.', err)
      }
    }

    const localQuiz = finalQuiz || fallbackLessonQuiz(quizSource)
    setLessonAICache(lesson.id, cacheKinds.lessonQuiz, localQuiz, cacheKey)
    return localQuiz
  })

  ipcMain.handle('educator:generateLessonPractice', async (_event, lessonId: number) => {
    const profile = getNormalizedProfile()
    const generation = getGenerationProfile(profile)
    const outputLanguage = getProfileLanguage(profile)
    const lesson = await ensureLessonContentReady(lessonId, profile)
    if (!lesson) {
      return fallbackLessonPractice({ title: 'lesson', content: '' }, '', outputLanguage)
    }

    const courseTitle = getCourseForModule(lesson.module_id)
    const languageSignal = detectLanguageLearningSignal(lesson, courseTitle, outputLanguage)
    const cacheKey = buildVariantCacheKey(profile)
    const cachedPractice = getLessonAICache(lesson.id, cacheKinds.lessonPractice, cacheKey)
    if (cachedPractice?.exercises?.length) {
      return cachedPractice
    }

    let finalPractice = null as LessonPracticeLike | null
    const aiDecision = evaluateAIBudget(profile, generation.practiceEstimate)
    if (aiDecision.allowed) {
      try {
        const result = await generateWithClaudeWithUsage(
          prompts.lessonPractice,
          [
            generation.practiceDirective,
            `Course title: "${courseTitle}"`,
            languageSignal
              ? `Language-learning mode: yes. Target: ${languageSignal.targetLanguage || 'current target language'}. Focus: ${languageSignal.focus}. Recommended game mix seed: ${languageSignal.recommendedGames.join(', ')}.`
              : 'Language-learning mode: no. Keep the practice in the normal mastery ladder.',
            languageSignal ? buildLanguagePracticeDirective(languageSignal) : '',
            buildLessonSupportContext(lesson.id, lesson, generation.practiceExcerptChars),
            'Design the exercises as a mastery ladder: retrieve, discriminate or apply, then explain or transfer.',
          ].join('\n\n'),
          generation.practiceMaxTokens,
          CLAUDE_TEACHER_MODEL,
          requestOptions.artifact,
        )

        finalPractice = normalizeLessonPractice(parseLooseJson(result.text), lesson, courseTitle, outputLanguage)
        trackAIUsage(result.inputTokens, result.outputTokens, 'lesson-practice')
      } catch (err) {
        console.error('[educator] AI lesson practice generation failed; using local fallback.', err)
      }
    }

    const localPractice = finalPractice || fallbackLessonPractice(lesson, courseTitle, outputLanguage)
    setLessonAICache(lesson.id, cacheKinds.lessonPractice, localPractice, cacheKey)
    return localPractice
  })

  ipcMain.handle('educator:generateTeacherCheckpoint', async (_event, lessonId: number, focus?: string) => {
    const profile = getNormalizedProfile()
    const generation = getGenerationProfile(profile)
    const lesson = await ensureLessonContentReady(lessonId, profile)
    if (!lesson) {
      return fallbackTeacherCheckpoint({ title: 'lesson', content: '' })
    }

    const focusKey = normalizeFocusKey(focus)
    const cacheKey = buildVariantCacheKey(profile, focusKey)
    const cachedCheckpoint = getLessonAICache(lesson.id, cacheKinds.teacherCheckpoint, cacheKey)
    if (cachedCheckpoint?.anchors?.length && cachedCheckpoint?.questions?.length) {
      return cachedCheckpoint
    }

    let finalCheckpoint = null as TeacherCheckpointLike | null
    const aiDecision = evaluateAIBudget(profile, generation.checkpointEstimate)
    if (aiDecision.allowed) {
      try {
        const result = await generateWithClaudeWithUsage(
          prompts.teacherCheckpoint,
          [
            generation.checkpointDirective,
            focus ? `Clarification focus: "${focus}"` : '',
            buildLessonSupportContext(lesson.id, lesson, generation.checkpointExcerptChars, true),
            'Keep the checkpoint aligned to the mastery ladder: central idea, use trigger, misconception repair.',
          ].filter(Boolean).join('\n\n'),
          generation.checkpointMaxTokens,
          CLAUDE_TEACHER_MODEL,
          requestOptions.artifact,
        )

        finalCheckpoint = normalizeTeacherCheckpoint(parseLooseJson(result.text), lesson)
        trackAIUsage(result.inputTokens, result.outputTokens, 'teacher-checkpoint')
      } catch (err) {
        console.error('[educator] AI teacher checkpoint generation failed; using local fallback.', err)
      }
    }

    const localCheckpoint = finalCheckpoint || fallbackTeacherCheckpoint(lesson, focus)
    setLessonAICache(lesson.id, cacheKinds.teacherCheckpoint, localCheckpoint, cacheKey)
    return localCheckpoint
  })

  ipcMain.handle('educator:generateModuleCheckpoint', async (_event, moduleId: number) => {
    const profile = getNormalizedProfile()
    const generation = getGenerationProfile(profile)
    const moduleDraft = await buildModuleCheckpointDraft(moduleId, profile)
    if (!moduleDraft) {
      return fallbackTeacherCheckpoint({ title: 'Module checkpoint', content: '' })
    }

    const cacheKey = buildVariantCacheKey(profile, `module-${moduleId}`)
    const cachedCheckpoint = getLessonAICache(moduleDraft.anchorLessonId, cacheKinds.moduleCheckpoint, cacheKey)
    if (cachedCheckpoint?.anchors?.length && cachedCheckpoint?.questions?.length) {
      return cachedCheckpoint
    }

    let finalCheckpoint = null as TeacherCheckpointLike | null
    const aiDecision = evaluateAIBudget(profile, generation.checkpointEstimate)
    if (aiDecision.allowed) {
      try {
        const result = await generateWithClaudeWithUsage(
          prompts.moduleCheckpoint,
          [
            generation.checkpointDirective,
            buildModuleCheckpointSupportContext(
              moduleDraft,
              Math.min(1_800, Math.max(960, Math.round(generation.checkpointExcerptChars * 1.6))),
            ),
            'Keep the checkpoint cumulative across the whole module: central idea, use trigger, misconception repair.',
          ].filter(Boolean).join('\n\n'),
          generation.checkpointMaxTokens,
          CLAUDE_TEACHER_MODEL,
          requestOptions.artifact,
        )

        finalCheckpoint = normalizeTeacherCheckpoint(parseLooseJson(result.text), moduleDraft.checkpointLesson)
        trackAIUsage(result.inputTokens, result.outputTokens, 'module-checkpoint')
      } catch (err) {
        console.error('[educator] AI module checkpoint generation failed; using local fallback.', err)
      }
    }

    const localCheckpoint = finalCheckpoint || fallbackTeacherCheckpoint(moduleDraft.checkpointLesson)
    setLessonAICache(moduleDraft.anchorLessonId, cacheKinds.moduleCheckpoint, localCheckpoint, cacheKey)
    return localCheckpoint
  })

  ipcMain.handle('educator:saveTeacherCheckpointFlashcards', async (_event, lessonId: number, flashcards: Array<{ front: string; back: string }>) => {
    return saveTeacherCheckpointFlashcards(lessonId, flashcards, getNormalizedProfile())
  })

  ipcMain.handle('educator:explainLesson', async (event, lessonId: number) => {
    let lesson = getLesson(lessonId)
    const language = getProfileLanguage(getNormalizedProfile())
    if (!lesson) {
      event.sender.send('educator:lessonToken', {
        token: localizeText(language, {
          en: 'I could not find the lesson. Pick another one and I will try again.',
          ru: 'Не удалось найти урок. Выбери другой, и я попробую снова.',
          ro: 'Nu am găsit lecția. Alege alta și încerc din nou.',
        }),
        done: true,
      })
      return
    }

    const profile = getNormalizedProfile()
    const generation = getGenerationProfile(profile)
    try {
      lesson = await ensureLessonContentReady(lessonId, profile)
    } catch (err: any) {
      event.sender.send('educator:lessonToken', {
        token: isEducatorLimitError(err)
          ? buildTeacherLimitToken(err?.message || 'You reached the cap for new lessons in this window.')
          : `${localizeText(language, {
              en: 'I could not prepare the lesson now',
              ru: 'Сейчас не удалось подготовить урок',
              ro: 'Nu am putut pregăti lecția acum',
            })}: ${err?.message || localizeText(language, {
              en: 'unknown error.',
              ru: 'неизвестная ошибка.',
              ro: 'eroare necunoscută.',
            })}`,
        done: true,
      })
      return
    }

    if (!lesson) {
      event.sender.send('educator:lessonToken', {
        token: localizeText(language, {
          en: 'I could not find the lesson. Pick another one and I will try again.',
          ru: 'Не удалось найти урок. Выбери другой, и я попробую снова.',
          ro: 'Nu am găsit lecția. Alege alta și încerc din nou.',
        }),
        done: true,
      })
      return
    }

    const explainCacheKey = buildVariantCacheKey(profile)
    const cachedExplain = getLessonAICache(lesson.id, cacheKinds.teacherExplain, explainCacheKey) as { text?: string } | null
    if (cachedExplain?.text) {
      event.sender.send('educator:lessonToken', {
        token: String(cachedExplain.text),
        done: true,
      })
      return
    }

    let explainText = ''
    const aiDecision = evaluateAIBudget(profile, generation.explainEstimate)
    if (aiDecision.allowed) {
      try {
        const result = await generateWithClaudeWithUsage(
          prompts.lessonTeacher,
          [
            generation.explainDirective,
            buildLessonSupportContext(lesson.id, lesson, generation.explainExcerptChars, true),
            'Teach the idea like a teacher who lowers overload first, then gives the learner one concrete handle.',
          ].join('\n\n'),
          generation.explainMaxTokens,
          CLAUDE_TEACHER_MODEL,
          requestOptions.lesson,
        )
        explainText = clampMultilineText(result.text, '', 900)
        if (explainText) {
          trackAIUsage(result.inputTokens, result.outputTokens, 'teacher-explain')
        }
      } catch (err) {
        console.error('[educator] AI lesson explain generation failed; using local fallback.', err)
      }
    }

    const localExplain = explainText || buildLocalExplainText(lesson, language)
    setLessonAICache(lesson.id, cacheKinds.teacherExplain, { text: localExplain }, explainCacheKey)
    event.sender.send('educator:lessonToken', {
      token: localExplain,
      done: true,
    })
  })

  ipcMain.handle('educator:clarifyLesson', async (event, lessonId: number, question: string, understandingScore?: number | null) => {
    const profile = getNormalizedProfile()
    const language = getProfileLanguage(profile)
    let lesson: any = null
    try {
      lesson = await ensureLessonContentReady(lessonId, profile)
    } catch (err: any) {
      event.sender.send('educator:clarifyToken', {
        token: isEducatorLimitError(err)
          ? err?.message || 'You reached the cap for new lessons in this window.'
          : `${localizeText(language, {
              en: 'I could not prepare the lesson for clarification',
              ru: 'Не удалось подготовить урок для уточнения',
              ro: 'Nu am putut pregăti lecția pentru clarificare',
            })}: ${err?.message || localizeText(language, {
              en: 'unknown error.',
              ru: 'неизвестная ошибка.',
              ro: 'eroare necunoscută.',
            })}`,
        done: true,
      })
      return
    }

    if (!lesson) {
      event.sender.send('educator:clarifyToken', {
        token: localizeText(language, {
          en: 'I could not find the lesson for clarification. Try again.',
          ru: 'Не удалось найти урок для уточнения. Попробуй снова.',
          ro: 'Nu am găsit lecția pentru clarificare. Încearcă din nou.',
        }),
        done: true,
      })
      return
    }

    const safeQuestion = String(question || '').trim().slice(0, 1200)
    if (!safeQuestion) {
      event.sender.send('educator:clarifyToken', {
        token: localizeText(language, {
          en: 'Tell me exactly which part was unclear and I will explain it more simply right away.',
          ru: 'Скажи точно, какая часть была непонятной, и я сразу объясню её проще.',
          ro: 'Spune-mi exact ce parte a fost neclară și o explic imediat mai simplu.',
        }),
        done: true,
      })
      return
    }

    const generation = getGenerationProfile(profile)
    const clarifyCacheKey = buildClarifyCacheKey(profile, safeQuestion)
    const cachedClarify = getLessonAICache(lesson.id, cacheKinds.teacherClarify, clarifyCacheKey) as { text?: string } | null
    if (cachedClarify?.text) {
      event.sender.send('educator:clarifyToken', {
        token: cachedClarify.text,
        done: true,
      })
      return
    }

    let clarifyText = ''
    const aiDecision = evaluateAIBudget(profile, generation.clarifyEstimate)
    if (aiDecision.allowed) {
      try {
        const result = await generateWithClaudeWithUsage(
          prompts.lessonClarify,
          [
            generation.clarifyDirective,
            buildLessonSupportContext(lesson.id, lesson, generation.clarifyExcerptChars, true),
            `Student question: ${safeQuestion}`,
            typeof understandingScore === 'number' ? `Student self-rating: ${understandingScore}/10` : '',
            'Diagnose the likeliest blocker and repair only that blocker. End with one tiny check only if it helps.',
          ].filter(Boolean).join('\n\n'),
          generation.clarifyMaxTokens,
          CLAUDE_TEACHER_MODEL,
          requestOptions.lesson,
        )
        clarifyText = clampMultilineText(result.text, '', 1_000)
        if (clarifyText) {
          trackAIUsage(result.inputTokens, result.outputTokens, 'teacher-clarify')
        }
      } catch (err) {
        console.error('[educator] AI lesson clarify generation failed; using local fallback.', err)
      }
    }

    const localClarify = clarifyText || buildLocalClarifyText(lesson, safeQuestion, understandingScore, language)
    setLessonAICache(lesson.id, cacheKinds.teacherClarify, { text: localClarify }, clarifyCacheKey)
    event.sender.send('educator:clarifyToken', {
      token: localClarify,
      done: true,
    })
  })

  ipcMain.handle('educator:reviewFlashcard', async (_event, id: number, quality: number) => {
    dbReviewFlashcard(id, quality)
    return { ok: true }
  })
}