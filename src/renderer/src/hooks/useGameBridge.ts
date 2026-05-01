import { useCallback, useState } from 'react'
import type {
  BrainGameCompletion,
  CourseReinforcementSummary,
  GameChallengeSeed,
  GameType,
  LessonPracticeGameLaunch,
  LessonPracticeReinforcement,
} from '../../../../shared/types'
import { mergeCourseReinforcementSummary } from '../lib/reinforcement'

export interface UseGameBridgeResult {
  brainGameSeed: GameType | null
  brainGameSeedContext: GameChallengeSeed | null
  brainGameLessonId: number | null
  brainGameCourseId: number | null
  lessonPracticeReinforcement: LessonPracticeReinforcement | null
  courseReinforcementMap: Record<number, CourseReinforcementSummary>
  openLessonGameMix: (launch: LessonPracticeGameLaunch, onOpenGames?: () => void) => void
  handleBrainGameComplete: (result: BrainGameCompletion) => void
  acknowledgeLessonGameReinforcement: (reinforcement: LessonPracticeReinforcement) => void
  resetGameBridge: () => void
}

export function useGameBridge(): UseGameBridgeResult {
  const [brainGameSeed, setBrainGameSeed] = useState<GameType | null>(null)
  const [brainGameSeedContext, setBrainGameSeedContext] = useState<GameChallengeSeed | null>(null)
  const [brainGameLessonId, setBrainGameLessonId] = useState<number | null>(null)
  const [brainGameCourseId, setBrainGameCourseId] = useState<number | null>(null)
  const [lessonPracticeReinforcement, setLessonPracticeReinforcement] = useState<LessonPracticeReinforcement | null>(null)
  const [courseReinforcementMap, setCourseReinforcementMap] = useState<Record<number, CourseReinforcementSummary>>({})

  const resetGameBridge = useCallback(() => {
    setBrainGameSeed(null)
    setBrainGameSeedContext(null)
    setBrainGameLessonId(null)
    setBrainGameCourseId(null)
  }, [])

  const openLessonGameMix = useCallback((launch: LessonPracticeGameLaunch, onOpenGames?: () => void) => {
    setBrainGameCourseId(launch.courseId)
    setBrainGameLessonId(launch.lessonId)
    setBrainGameSeed(launch.gameType || null)
    setBrainGameSeedContext(launch.gameSeed || null)
    onOpenGames?.()
  }, [])

  const handleBrainGameComplete = useCallback((result: BrainGameCompletion) => {
    if (brainGameLessonId != null) {
      setLessonPracticeReinforcement({ lessonId: brainGameLessonId, ...result })
    }

    if (brainGameCourseId != null) {
      const seeded = Boolean(brainGameSeedContext?.words?.length || brainGameSeedContext?.phrases?.length)
      setCourseReinforcementMap((current) => ({
        ...current,
        [brainGameCourseId]: mergeCourseReinforcementSummary(current[brainGameCourseId], brainGameCourseId, result, seeded),
      }))
    }
  }, [brainGameCourseId, brainGameLessonId, brainGameSeedContext])

  const acknowledgeLessonGameReinforcement = useCallback((reinforcement: LessonPracticeReinforcement) => {
    setLessonPracticeReinforcement((current) => {
      if (!current) return current
      if (current.lessonId !== reinforcement.lessonId) return current
      if (current.completedAt !== reinforcement.completedAt) return current
      return null
    })
  }, [])

  return {
    brainGameSeed,
    brainGameSeedContext,
    brainGameLessonId,
    brainGameCourseId,
    lessonPracticeReinforcement,
    courseReinforcementMap,
    openLessonGameMix,
    handleBrainGameComplete,
    acknowledgeLessonGameReinforcement,
    resetGameBridge,
  }
}