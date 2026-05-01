import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameType, Lesson, LessonPracticeExercise, LessonPracticeGameLaunch, LessonPracticeReinforcement, LessonPracticeSet, LessonReward } from '../../../../shared/types'
import { playBlip, playClick, playDing } from '../lib/sounds'
import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  courseId: number
  lesson: Lesson
  nextTeaser?: string | null
  onComplete: () => void
  onReview: () => void
  onReward?: (reward: LessonReward) => void
  onOpenGameMix?: (launch: LessonPracticeGameLaunch) => void
  gameReinforcement?: LessonPracticeReinforcement | null
  onAcknowledgeGameReinforcement?: (reinforcement: LessonPracticeReinforcement) => void
}

type Phase = 'loading' | 'intro' | 'question' | 'feedback' | 'summary' | 'blocked'
type FeedbackKind = 'correct' | 'retry' | 'final-wrong'

interface ExerciseResult {
  correct: boolean
  attempts: number
  response: string
}

const PX = "'Press Start 2P', monospace"

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function evaluatePracticeAnswer(exercise: LessonPracticeExercise, response: string): boolean {
  const answer = normalizeText(response)
  if (!answer) return false

  if (exercise.kind === 'mcq') {
    return answer === normalizeText(exercise.correctAnswer)
  }

  const phrases = Array.from(new Set([exercise.correctAnswer, ...(exercise.acceptableAnswers || [])]))
    .map(normalizeText)
    .filter(Boolean)

  if (phrases.some((phrase) => phrase && answer.includes(phrase))) {
    return true
  }

  const keywords = Array.from(new Set(
    phrases
      .flatMap((phrase) => phrase.split(' '))
      .map((word) => word.trim())
      .filter((word) => word.length >= 4),
  ))

  const matched = keywords.filter((word) => answer.includes(word))
  return matched.length >= Math.max(1, Math.min(2, Math.ceil(keywords.length * 0.4)))
}

function PracticeCodeBlock({ code }: { code: string }) {
  return (
    <pre style={{
      margin: '0 0 14px 0',
      padding: '16px 18px',
      borderRadius: '12px',
      background: 'rgba(2,9,4,0.88)',
      border: '1px solid rgba(196,154,60,0.14)',
      color: 'rgba(245,228,168,0.84)',
      fontFamily: "'Cascadia Mono', 'Consolas', monospace",
      fontSize: '13px',
      lineHeight: 1.55,
      whiteSpace: 'pre-wrap',
      boxShadow: '0 0 18px rgba(196,154,60,0.06)',
    }}>
      {code}
    </pre>
  )
}

export default function LessonPractice({ courseId, lesson, nextTeaser, onComplete, onReview, onReward, onOpenGameMix, gameReinforcement, onAcknowledgeGameReinforcement }: Props) {
  const { t } = useLanguage()
  const [practiceSet, setPracticeSet] = useState<LessonPracticeSet | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [response, setResponse] = useState('')
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [results, setResults] = useState<Record<string, ExerciseResult>>({})
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null)
  const [tasksCreated, setTasksCreated] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [lessonReward, setLessonReward] = useState<LessonReward | null>(null)
  const [rewardLoading, setRewardLoading] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState('')
  const rewardRequestedRef = useRef(false)
  const loadRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const onRewardRef = useRef(onReward)
  const seenReinforcementRef = useRef<number | null>(null)
  const [reinforcement, setReinforcement] = useState<LessonPracticeReinforcement | null>(null)

  useEffect(() => {
    onCompleteRef.current = onComplete
    onRewardRef.current = onReward
  }, [onComplete, onReward])

  useEffect(() => {
    setReinforcement(null)
    seenReinforcementRef.current = null
  }, [lesson.id])

  useEffect(() => {
    if (!gameReinforcement || gameReinforcement.lessonId !== lesson.id) return
    if (seenReinforcementRef.current === gameReinforcement.completedAt) return
    seenReinforcementRef.current = gameReinforcement.completedAt
    setReinforcement(gameReinforcement)
    onAcknowledgeGameReinforcement?.(gameReinforcement)
  }, [gameReinforcement, lesson.id, onAcknowledgeGameReinforcement])

  useEffect(() => {
    if (loadRef.current) return
    loadRef.current = true
    rewardRequestedRef.current = false

    window.aura.educator.generateLessonPractice(lesson.id)
      .then((nextSet) => {
        setPracticeSet(nextSet)
        setPhase('intro')
      })
      .catch((error: any) => {
        setBlockedMessage(String(error?.message || 'Cannot start practice for this lesson right now.'))
        setPhase('blocked')
      })
      .finally(() => {
        loadRef.current = false
      })
  }, [lesson.id])

  const exercises = practiceSet?.exercises || []
  const activeExercise = exercises[currentIndex] || null
  const coreExercises = useMemo(
    () => exercises.filter((exercise) => exercise.difficulty === 'core'),
    [exercises],
  )
  const correctCount = useMemo(
    () => Object.values(results).filter((item) => item.correct).length,
    [results],
  )
  const coreCorrectCount = useMemo(
    () => coreExercises.filter((exercise) => results[exercise.id]?.correct).length,
    [coreExercises, results],
  )
  const requiredToPass = practiceSet?.requiredToPass || 2
  const coreRequired = Math.min(requiredToPass, coreExercises.length || requiredToPass)
  const passed = correctCount >= requiredToPass && coreCorrectCount >= coreRequired
  const recommendedGames = practiceSet?.recommendedGames || []
  const missedExercises = useMemo(
    () => exercises.filter((exercise) => !results[exercise.id]?.correct),
    [exercises, results],
  )
  const rewardReady = !passed || !!lessonReward

  const getGameName = (gameType: GameType) => {
    switch (gameType) {
      case 'math_speed':
        return t('games.mathSpeed')
      case 'memory_tiles':
        return t('games.memoryTiles')
      case 'pattern_match':
        return t('games.patternMatch')
      case 'reaction_time':
        return t('games.reactionTime')
      case 'word_scramble':
        return t('games.wordScramble')
      case 'color_stroop':
        return t('games.colorStroop')
      default:
        return gameType
    }
  }

  const renderReinforcementCard = (context: 'intro' | 'summary') => {
    if (!reinforcement) return null

    const verified = reinforcement.verified
    const accent = verified ? 'rgba(46,184,122,0.18)' : 'rgba(220,170,50,0.18)'
    const accentText = verified ? 'rgba(126,232,177,0.86)' : 'rgba(245,211,120,0.84)'
    const gameName = getGameName(reinforcement.gameType).toUpperCase()

    return (
      <div style={{
        padding: '14px 16px',
        borderRadius: '12px',
        marginBottom: context === 'intro' ? '18px' : '16px',
        background: 'rgba(4,14,8,0.58)',
        border: `1px solid ${accent}`,
      }}>
        <div style={{ fontFamily: PX, fontSize: '4px', color: accentText, lineHeight: 2, letterSpacing: '0.1em', marginBottom: '8px' }}>
          {verified ? 'BONUS REINFORCEMENT LOGGED' : 'GAME LOOP RECORDED'}
        </div>
        <div style={{ fontFamily: PX, fontSize: '4.8px', color: 'rgba(235,225,205,0.74)', lineHeight: 2.2 }}>
          {verified
            ? `${gameName} verified at score ${reinforcement.score} for +${reinforcement.points} points. This counts as an extra recall loop, even though the lesson pass gate still stays here.`
            : `${gameName} was recorded, but the score was not verified. Keep the lesson threshold here and use the game as an extra repetition pass.`}
        </div>
      </div>
    )
  }

  const renderRecommendedGamesCard = (context: 'intro' | 'summary') => {
    if (!practiceSet || recommendedGames.length === 0) return null

    const isLanguageMode = practiceSet.mode === 'language-learning'
    const accent = isLanguageMode ? 'rgba(96,180,255,0.18)' : 'rgba(196,154,60,0.16)'
    const accentText = isLanguageMode ? 'rgba(156,212,255,0.82)' : 'rgba(245,228,168,0.82)'

    return (
      <div style={{
        padding: '14px 16px',
        borderRadius: '12px',
        marginBottom: context === 'intro' ? '18px' : '16px',
        background: 'rgba(4,14,8,0.58)',
        border: `1px solid ${accent}`,
      }}>
        <div style={{ fontFamily: PX, fontSize: '4px', color: accentText, lineHeight: 2, letterSpacing: '0.1em', marginBottom: '8px' }}>
          {practiceSet.modeLabel || (isLanguageMode ? 'LANGUAGE PRACTICE MODE' : 'RECOMMENDED BRAIN GAMES')}
        </div>
        <div style={{ fontFamily: PX, fontSize: '4.8px', color: 'rgba(235,225,205,0.7)', lineHeight: 2.1, marginBottom: '10px' }}>
          {isLanguageMode
            ? 'After the lesson, reinforce recognition and fast recall with a short game mix.'
            : 'If you want one more repetition loop, use a short game mix after practice.'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {recommendedGames.map((gameType) => (
            <button
              key={gameType}
              onClick={() => onOpenGameMix?.({ courseId, lessonId: lesson.id, gameType, gameSeed: practiceSet.gameSeed || null })}
              disabled={!onOpenGameMix}
              style={{
                fontFamily: PX,
                fontSize: '4.6px',
                lineHeight: 2,
                padding: '9px 12px',
                borderRadius: '999px',
                cursor: onOpenGameMix ? 'pointer' : 'default',
                background: isLanguageMode ? 'rgba(96,180,255,0.08)' : 'rgba(196,154,60,0.08)',
                border: `1px solid ${isLanguageMode ? 'rgba(96,180,255,0.18)' : 'rgba(196,154,60,0.18)'}`,
                color: accentText,
                opacity: onOpenGameMix ? 1 : 0.72,
              }}
            >
              {getGameName(gameType).toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (phase !== 'summary' || !passed || rewardRequestedRef.current) return
    rewardRequestedRef.current = true
    setRewardLoading(true)

    window.aura.motivation.awardLessonCompletion(lesson.id)
      .then((reward) => {
        setLessonReward(reward)
        onRewardRef.current?.(reward)
      })
      .catch(() => null)
      .finally(() => setRewardLoading(false))
  }, [lesson.id, passed, phase])

  const resetForNextExercise = () => {
    setFeedbackKind(null)
    setResponse('')
  }

  const goNext = () => {
    playClick()
    if (currentIndex + 1 >= exercises.length) {
      setPhase('summary')
      resetForNextExercise()
      return
    }
    setCurrentIndex((prev) => prev + 1)
    setPhase('question')
    resetForNextExercise()
  }

  const submitExercise = () => {
    if (!activeExercise) return
    const trimmed = response.trim()
    if (!trimmed) return

    const nextAttempts = (attempts[activeExercise.id] || 0) + 1
    setAttempts((prev) => ({ ...prev, [activeExercise.id]: nextAttempts }))

    const correct = evaluatePracticeAnswer(activeExercise, trimmed)
    if (correct) {
      playDing()
      setResults((prev) => ({
        ...prev,
        [activeExercise.id]: { correct: true, attempts: nextAttempts, response: trimmed },
      }))
      setFeedbackKind('correct')
      setPhase('feedback')
      return
    }

    playBlip()
    if (nextAttempts === 1) {
      setFeedbackKind('retry')
      setPhase('feedback')
      return
    }

    setResults((prev) => ({
      ...prev,
      [activeExercise.id]: { correct: false, attempts: nextAttempts, response: trimmed },
    }))
    setFeedbackKind('final-wrong')
    setPhase('feedback')
  }

  const createTaskPack = async () => {
    if (missedExercises.length === 0 || tasksCreated) return

    setTaskError(null)
    try {
      const parent = await window.aura.tasks.add(`Remaining practice: ${lesson.title}`, 'mid')
      for (const exercise of missedExercises) {
        await window.aura.tasks.add(exercise.taskPrompt || exercise.prompt, 'mid', parent.id)
      }
      setTasksCreated(true)
      playDing()
    } catch {
      setTaskError('Could not add the exercises to tasks right now.')
    }
  }

  if (phase === 'blocked') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.45s cubic-bezier(.16,1,.3,1) forwards', maxWidth: '420px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '12px', margin: '0 auto 18px',
            background: 'radial-gradient(circle at 38% 36%, rgba(220,170,50,0.48), rgba(220,170,50,0.12))',
            border: '1px solid rgba(220,170,50,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 0 32px rgba(220,170,50,0.2)',
          }}>
            ⏳
          </div>
          <div style={{
            fontFamily: PX,
            fontSize: '9px',
            color: 'rgba(220,170,50,0.88)',
            letterSpacing: '0.04em',
            lineHeight: 1.8,
            marginBottom: '10px',
          }}>
            PRACTICE WAS STOPPED
          </div>
          <div style={{
            fontFamily: PX,
            fontSize: '5px',
            color: 'rgba(245,228,168,0.62)',
            lineHeight: 2.4,
            whiteSpace: 'pre-wrap',
            maxWidth: '360px',
            margin: '0 auto 22px',
          }}>
            {blockedMessage}
          </div>
          <button
            onClick={onReview}
            style={{
              fontFamily: PX,
              fontSize: '6px',
              lineHeight: 2,
              letterSpacing: '0.08em',
              padding: '12px 18px',
              borderRadius: '10px',
              cursor: 'pointer',
              background: 'rgba(232,197,106,0.12)',
              border: '1px solid rgba(232,197,106,0.28)',
              color: 'rgba(232,197,106,0.88)',
            }}
          >
            ← BACK TO LESSON
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'loading' || !practiceSet) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.4s ease forwards' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '10px', margin: '0 auto 16px',
            background: 'radial-gradient(circle at 38% 36%, rgba(46,184,122,0.5), rgba(46,184,122,0.12))',
            border: '1px solid rgba(46,184,122,0.28)',
            boxShadow: '0 0 28px rgba(46,184,122,0.18)',
            animation: 'auraPulse 1.4s ease-in-out infinite',
          }} />
          <div style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(46,184,122,0.44)', lineHeight: 2, letterSpacing: '0.1em' }}>
            PREPARING PRACTICE...
          </div>
          {rewardLoading && (
            <div style={{ fontFamily: PX, fontSize: '4px', color: 'rgba(196,154,60,0.32)', lineHeight: 2, marginTop: 6 }}>
              PREPARING REWARD...
            </div>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '520px', width: '100%', textAlign: 'center', animation: 'fadeUp 0.45s ease forwards' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '12px', margin: '0 auto 18px',
            background: practiceSet.isCoding
              ? 'radial-gradient(circle at 38% 36%, rgba(96,180,255,0.45), rgba(59,130,246,0.12))'
              : 'radial-gradient(circle at 38% 36%, rgba(232,197,106,0.45), rgba(196,154,60,0.12))',
            border: `1px solid ${practiceSet.isCoding ? 'rgba(96,180,255,0.28)' : 'rgba(232,197,106,0.28)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
            boxShadow: practiceSet.isCoding ? '0 0 32px rgba(96,180,255,0.18)' : '0 0 32px rgba(196,154,60,0.18)',
          }}>
            {practiceSet.isCoding ? '⌘' : '✦'}
          </div>

          <div style={{ fontFamily: PX, fontSize: '10px', color: 'rgba(245,228,168,0.92)', lineHeight: 1.9, marginBottom: '10px' }}>
            SHORT PRACTICE
          </div>
          <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(196,154,60,0.5)', lineHeight: 2.2, marginBottom: '12px' }}>
            2 CORE EXERCISES + 1 BONUS
          </div>
          <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(245,228,168,0.72)', lineHeight: 2.3, marginBottom: '10px' }}>
            {practiceSet.intro}
          </div>
          <div style={{
            padding: '14px 16px', borderRadius: '12px', marginBottom: '18px',
            background: 'rgba(4,14,8,0.6)', border: '1px solid rgba(196,154,60,0.14)',
          }}>
            <div style={{ fontFamily: PX, fontSize: '4px', color: 'rgba(200,180,40,0.46)', lineHeight: 2, letterSpacing: '0.1em', marginBottom: '8px' }}>
              WHAT YOU'RE DEMONSTRATING NOW
            </div>
            <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(235,225,205,0.74)', lineHeight: 2.2 }}>
              {practiceSet.objective}
            </div>
          </div>
          {renderReinforcementCard('intro')}
          {renderRecommendedGamesCard('intro')}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button onClick={onReview} style={{
              fontFamily: PX, fontSize: '5px', lineHeight: 2,
              padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
              background: 'rgba(196,154,60,0.06)', border: '1px solid rgba(196,154,60,0.16)',
              color: 'rgba(232,197,106,0.68)',
            }}>
              ← BACK TO LESSON
            </button>
            <button onClick={() => { playClick(); setPhase('question') }} style={{
              fontFamily: PX, fontSize: '5px', lineHeight: 2,
              padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
              border: '1px solid rgba(46,184,122,0.22)', color: 'rgba(245,228,168,0.92)',
            }}>
              START PRACTICE →
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'feedback' && activeExercise && feedbackKind) {
    const accent = feedbackKind === 'correct' ? '46,184,122' : feedbackKind === 'retry' ? '232,197,106' : '220,170,50'
    const title = feedbackKind === 'correct' ? 'CONCEPT LOCKED' : feedbackKind === 'retry' ? 'NOT YET' : 'WE\'LL FIX IT'
    const body = feedbackKind === 'correct'
      ? activeExercise.whyItMatters
      : activeExercise.hint
    const answerPreview = feedbackKind === 'final-wrong' ? activeExercise.correctAnswer : null

    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '480px', width: '100%', animation: 'fadeUp 0.4s ease forwards' }}>
          <div style={{
            padding: '20px 20px 18px', borderRadius: '14px',
            background: 'rgba(4,14,8,0.64)', border: `1px solid rgba(${accent},0.22)`,
            boxShadow: `0 0 28px rgba(${accent},0.12)`, textAlign: 'center',
          }}>
            <div style={{ fontSize: '26px', marginBottom: '10px' }}>
              {feedbackKind === 'correct' ? '✓' : feedbackKind === 'retry' ? '↺' : '!'}
            </div>
            <div style={{ fontFamily: PX, fontSize: '8px', color: `rgba(${accent},0.88)`, lineHeight: 2, marginBottom: '10px' }}>
              {title}
            </div>
            <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(245,228,168,0.74)', lineHeight: 2.3 }}>
              {body}
            </div>
            {answerPreview && (
              <div style={{ marginTop: '12px', fontFamily: PX, fontSize: '5px', color: 'rgba(46,184,122,0.74)', lineHeight: 2.1 }}>
                GOOD ANSWER: {answerPreview}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '18px' }}>
            {feedbackKind === 'retry' ? (
              <button
                onClick={() => { playClick(); setPhase('question'); setResponse('') }}
                style={{
                  fontFamily: PX, fontSize: '5px', lineHeight: 2,
                  padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(232,197,106,0.16), rgba(196,154,60,0.12))',
                  border: '1px solid rgba(232,197,106,0.2)', color: 'rgba(245,228,168,0.9)',
                }}
              >
                TRY ONCE MORE
              </button>
            ) : (
              <button
                onClick={goNext}
                style={{
                  fontFamily: PX, fontSize: '5px', lineHeight: 2,
                  padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                  border: '1px solid rgba(46,184,122,0.22)', color: 'rgba(245,228,168,0.92)',
                }}
              >
                {currentIndex + 1 >= exercises.length ? 'SEE RESULTS →' : 'NEXT EXERCISE →'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'summary') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '560px', width: '100%', textAlign: 'center', animation: 'fadeUp 0.45s ease forwards' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '12px', margin: '0 auto 18px',
            background: passed
              ? 'radial-gradient(circle at 38% 36%, rgba(46,184,122,0.48), rgba(46,184,122,0.12))'
              : 'radial-gradient(circle at 38% 36%, rgba(220,170,50,0.48), rgba(220,170,50,0.12))',
            border: `1px solid ${passed ? 'rgba(46,184,122,0.28)' : 'rgba(220,170,50,0.28)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
            boxShadow: passed ? '0 0 32px rgba(46,184,122,0.18)' : '0 0 32px rgba(220,170,50,0.16)',
          }}>
            {passed ? '🏁' : '📌'}
          </div>

          <div style={{ fontFamily: PX, fontSize: '9px', color: passed ? 'rgba(46,184,122,0.9)' : 'rgba(220,170,50,0.88)', lineHeight: 1.9, marginBottom: '10px' }}>
            {passed ? 'PRACTICE CLOSED' : 'MORE TO FIX'}
          </div>
          <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(245,228,168,0.72)', lineHeight: 2.2, marginBottom: '12px' }}>
            SCORE: {correctCount}/{exercises.length} · CORE: {coreCorrectCount}/{coreExercises.length || coreRequired} · THRESHOLD: {requiredToPass}
          </div>

          {passed ? (
            <>
              <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(196,154,60,0.5)', lineHeight: 2.1, marginBottom: '10px' }}>
                {rewardLoading ? 'PREPARING REWARD...' : `+${lessonReward?.normalXp || 0} NORMAL XP · +${lessonReward?.bonusXp || 0} BONUS XP`}
              </div>
              <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(245,228,168,0.62)', lineHeight: 2.2, maxWidth: '420px', margin: '0 auto 10px' }}>
                {lessonReward?.celebrationText || 'You proved you can use it, not just recognize it.'}
              </div>
              {nextTeaser && (
                <div style={{
                  maxWidth: '380px', margin: '0 auto 18px', padding: '12px 14px', borderRadius: '12px',
                  background: 'rgba(196,154,60,0.06)', border: '1px solid rgba(196,154,60,0.14)',
                }}>
                  <div style={{ fontFamily: PX, fontSize: '4px', color: 'rgba(200,180,40,0.46)', lineHeight: 2, letterSpacing: '0.1em', marginBottom: '6px' }}>
                    NEXT UP
                  </div>
                  <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(245,228,168,0.74)', lineHeight: 2.2 }}>
                    {nextTeaser}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(245,228,168,0.62)', lineHeight: 2.3, maxWidth: '420px', margin: '0 auto 14px' }}>
              We don't close the lesson until there's minimum proof of competence. Return to the lesson or add gaps to tasks.
            </div>
          )}

          {!passed && (
            <div style={{ fontFamily: PX, fontSize: '4.6px', color: 'rgba(196,154,60,0.42)', lineHeight: 2.2, maxWidth: '420px', margin: '0 auto 14px' }}>
              If you return to the lesson and retry, we'll prepare a new practice set for the next round.
            </div>
          )}

          {renderReinforcementCard('summary')}
          {renderRecommendedGamesCard('summary')}

          {missedExercises.length > 0 && (
            <div style={{
              maxWidth: '440px', margin: '0 auto 16px', padding: '14px 16px', borderRadius: '12px',
              background: 'rgba(4,14,8,0.58)', border: '1px solid rgba(196,154,60,0.14)',
              textAlign: 'left',
            }}>
              <div style={{ fontFamily: PX, fontSize: '4px', color: 'rgba(200,180,40,0.46)', lineHeight: 2, letterSpacing: '0.1em', marginBottom: '8px' }}>
                EXERCISES TO FIX
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {missedExercises.map((exercise) => (
                  <div key={exercise.id} style={{ fontFamily: PX, fontSize: '4.5px', color: 'rgba(245,228,168,0.68)', lineHeight: 2.2 }}>
                    • {exercise.taskPrompt}
                  </div>
                ))}
              </div>
            </div>
          )}

          {taskError && (
            <div style={{ fontFamily: PX, fontSize: '4px', color: 'rgba(220,100,100,0.7)', lineHeight: 2, marginBottom: '10px' }}>
              {taskError}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
            {missedExercises.length > 0 && (
              <button onClick={createTaskPack} disabled={tasksCreated} style={{
                fontFamily: PX, fontSize: '5px', lineHeight: 2,
                padding: '11px 16px', borderRadius: '10px', cursor: tasksCreated ? 'default' : 'pointer',
                background: tasksCreated ? 'rgba(46,184,122,0.08)' : 'rgba(196,154,60,0.08)',
                border: `1px solid ${tasksCreated ? 'rgba(46,184,122,0.18)' : 'rgba(196,154,60,0.18)'}`,
                color: tasksCreated ? 'rgba(46,184,122,0.78)' : 'rgba(245,228,168,0.82)',
              }}>
                {tasksCreated ? 'ADDED TO TASKS ✓' : 'ADD TO TASKS'}
              </button>
            )}

            {passed ? (
              <button onClick={onComplete} disabled={rewardLoading || !rewardReady} style={{
                fontFamily: PX, fontSize: '5px', lineHeight: 2,
                padding: '11px 16px', borderRadius: '10px', cursor: rewardLoading || !rewardReady ? 'not-allowed' : 'pointer',
                background: rewardLoading || !rewardReady ? 'rgba(46,184,122,0.05)' : 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                border: `1px solid ${rewardLoading || !rewardReady ? 'rgba(46,184,122,0.08)' : 'rgba(46,184,122,0.22)'}`,
                color: rewardLoading || !rewardReady ? 'rgba(245,228,168,0.36)' : 'rgba(245,228,168,0.92)',
              }}>
                {rewardLoading || !rewardReady ? 'PREPARING REWARD...' : 'CONTINUE →'}
              </button>
            ) : (
              <button onClick={onReview} style={{
                fontFamily: PX, fontSize: '5px', lineHeight: 2,
                padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(232,197,106,0.16), rgba(196,154,60,0.12))',
                border: '1px solid rgba(232,197,106,0.2)', color: 'rgba(245,228,168,0.9)',
              }}>
                ← BACK TO LESSON
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!activeExercise) return null

  const answered = activeExercise.kind === 'mcq' ? response.length > 0 : response.trim().length > 0
  const progressCount = currentIndex + 1

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '30px 42px 40px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,60,0.1) transparent' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', animation: 'fadeUp 0.4s ease forwards' }}>
        <button onClick={onReview} style={{
          fontFamily: PX, fontSize: '6px', color: 'rgba(196,154,60,0.30)', cursor: 'pointer',
          marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'none', border: 'none', padding: 0, lineHeight: 2,
        }}>
          ← Back to lesson
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '5px',
            background: activeExercise.difficulty === 'core' ? 'rgba(46,184,122,0.08)' : 'rgba(196,154,60,0.08)',
            border: `1px solid ${activeExercise.difficulty === 'core' ? 'rgba(46,184,122,0.16)' : 'rgba(196,154,60,0.16)'}`,
            fontFamily: PX, fontSize: '5px', color: activeExercise.difficulty === 'core' ? 'rgba(46,184,122,0.72)' : 'rgba(196,154,60,0.62)',
            lineHeight: 2, letterSpacing: '0.08em',
          }}>
            {activeExercise.difficulty === 'core' ? 'CORE' : 'BONUS'} · EXERCISE {progressCount}
          </div>
          <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(196,154,60,0.38)', lineHeight: 2 }}>
            THRESHOLD {requiredToPass}/{exercises.length}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          {exercises.map((exercise, index) => {
            const result = results[exercise.id]
            return (
              <div key={exercise.id} style={{
                flex: 1, height: '5px', borderRadius: '999px',
                background: result?.correct
                  ? 'rgba(46,184,122,0.52)'
                  : result && !result.correct
                    ? 'rgba(220,170,50,0.42)'
                    : index === currentIndex
                      ? 'rgba(232,197,106,0.54)'
                      : 'rgba(196,154,60,0.12)',
                boxShadow: result?.correct ? '0 0 10px rgba(46,184,122,0.18)' : 'none',
              }} />
            )
          })}
        </div>

        <div style={{
          padding: '20px 20px 18px', borderRadius: '14px', marginBottom: '16px',
          background: 'rgba(4,14,8,0.62)', border: '1px solid rgba(196,154,60,0.14)',
        }}>
          <div style={{ fontFamily: PX, fontSize: '7px', color: 'rgba(245,228,168,0.86)', lineHeight: 2.2, marginBottom: activeExercise.contextCode ? '14px' : 0 }}>
            {activeExercise.prompt}
          </div>
          {activeExercise.contextCode && <PracticeCodeBlock code={activeExercise.contextCode} />}

          {activeExercise.kind === 'mcq' && activeExercise.options && (
            <div style={{ display: 'grid', gap: '8px' }}>
              {activeExercise.options.map((option) => {
                const selected = response === option
                return (
                  <button
                    key={option}
                    onClick={() => setResponse(option)}
                    style={{
                      fontFamily: PX, fontSize: '5px', lineHeight: 2.1, textAlign: 'left',
                      padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                      background: selected ? 'rgba(232,197,106,0.08)' : 'rgba(2,9,4,0.52)',
                      border: `1px solid ${selected ? 'rgba(232,197,106,0.28)' : 'rgba(196,154,60,0.1)'}`,
                      color: selected ? 'rgba(245,228,168,0.92)' : 'rgba(220,200,160,0.64)',
                      boxShadow: selected ? '0 0 14px rgba(232,197,106,0.08)' : 'none',
                    }}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          )}

          {activeExercise.kind === 'short_text' && (
            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submitExercise()
                }
              }}
              placeholder={activeExercise.placeholder || 'Write your short answer...'}
              style={{
                width: '100%', minHeight: '82px', resize: 'vertical', borderRadius: '10px',
                border: '1px solid rgba(196,154,60,0.14)', background: 'rgba(3,9,5,0.82)',
                color: 'rgba(245,228,168,0.9)', padding: '12px 14px', outline: 'none',
                fontFamily: PX, fontSize: '5px', lineHeight: 2.1,
              }}
            />
          )}
        </div>

        <div style={{
          padding: '14px 16px', borderRadius: '12px', marginBottom: '18px',
          background: 'rgba(196,154,60,0.05)', border: '1px solid rgba(196,154,60,0.12)',
        }}>
          <div style={{ fontFamily: PX, fontSize: '4px', color: 'rgba(200,180,40,0.44)', lineHeight: 2, letterSpacing: '0.1em', marginBottom: '8px' }}>
            WHY IT MATTERS
          </div>
          <div style={{ fontFamily: PX, fontSize: '4.8px', color: 'rgba(235,225,205,0.68)', lineHeight: 2.2 }}>
            {activeExercise.whyItMatters}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={submitExercise}
            disabled={!answered}
            style={{
              fontFamily: PX, fontSize: '5px', lineHeight: 2,
              padding: '11px 18px', borderRadius: '10px', cursor: answered ? 'pointer' : 'not-allowed',
              background: answered
                ? 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))'
                : 'rgba(46,184,122,0.05)',
              border: `1px solid ${answered ? 'rgba(46,184,122,0.22)' : 'rgba(46,184,122,0.08)'}`,
              color: answered ? 'rgba(245,228,168,0.92)' : 'rgba(245,228,168,0.36)',
            }}
          >
            CHECK ANSWER
          </button>
        </div>
      </div>
    </div>
  )
}