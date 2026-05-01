import type { BrainGameCompletion, CourseReinforcementSummary } from '../../../../shared/types'

export function mergeCourseReinforcementSummary(
  current: CourseReinforcementSummary | undefined,
  courseId: number,
  result: BrainGameCompletion,
  seeded: boolean,
): CourseReinforcementSummary {
  return {
    courseId,
    totalGames: (current?.totalGames || 0) + 1,
    verifiedGames: (current?.verifiedGames || 0) + (result.verified ? 1 : 0),
    totalPoints: (current?.totalPoints || 0) + Math.max(0, result.points || 0),
    seededGames: (current?.seededGames || 0) + (seeded ? 1 : 0),
    latestGameType: result.gameType,
  }
}