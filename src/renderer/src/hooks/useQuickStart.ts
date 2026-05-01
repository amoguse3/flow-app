import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { BotMood } from '../components/BotOrb'
import type { AchievementNotice } from '../contexts/MotivationContext'
import type { MotivationState, QuickStartIntent, UserProfile } from '../../../../shared/types'

interface UseQuickStartOptions {
  profile: UserProfile | null
  setProfile: Dispatch<SetStateAction<UserProfile | null>>
  todayEnergy: number | null
  setShowEnergy: Dispatch<SetStateAction<boolean>>
  setPendingEnergyAfterQuickStart: Dispatch<SetStateAction<boolean>>
  setShowQuickStart: Dispatch<SetStateAction<boolean>>
  setShowTutorial: Dispatch<SetStateAction<boolean>>
  resetTutorialCourseGenerated: () => void
  setMood: Dispatch<SetStateAction<BotMood>>
  setBotText: Dispatch<SetStateAction<string>>
  setSpeaking: Dispatch<SetStateAction<boolean>>
  showAchievementNotice: (notice: AchievementNotice, durationMs?: number) => void
  syncMotivation: (next: MotivationState | null, options?: { silent?: boolean }) => void
  onOpenTasks: () => void
  onOpenCourseCreator: () => void
  onOpenFocus: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export function useQuickStart({
  profile,
  setProfile,
  todayEnergy,
  setShowEnergy,
  setPendingEnergyAfterQuickStart,
  setShowQuickStart,
  setShowTutorial,
  resetTutorialCourseGenerated,
  setMood,
  setBotText,
  setSpeaking,
  showAchievementNotice,
  syncMotivation,
  onOpenTasks,
  onOpenCourseCreator,
  onOpenFocus,
  t,
}: UseQuickStartOptions) {
  const handleQuickStartChoice = useCallback(async (intent: QuickStartIntent) => {
    if (!profile) return

    const nextProfile: UserProfile = {
      ...profile,
      onboardingIntent: intent,
      onboardingQuickStartDone: true,
    }

    setProfile(nextProfile)
    setShowQuickStart(false)
    setMood('excited')
    setSpeaking(true)
    window.setTimeout(() => setSpeaking(false), 2_600)

    try {
      await window.aura.profile.save(nextProfile)
    } catch {
      // Keep the quick-start flow moving even if persistence fails once.
    }

    try {
      const updatedMotivation = await window.aura.motivation.addXP(25)
      syncMotivation(updatedMotivation)
    } catch {
      // Bonus XP is helpful but should not block the first action.
    }

    showAchievementNotice({
      icon: '✦',
      title: t('app.quickStart.title'),
      text: '+25 XP',
    }, 4_000)

    if (intent === 'organize') {
      setBotText(t('app.quickStart.organize'))
      onOpenTasks()
      return
    }

    if (intent === 'learn') {
      setBotText(t('app.quickStart.learn'))
      onOpenCourseCreator()
      return
    }

    setBotText(t('app.quickStart.focus'))
    onOpenFocus()
  }, [
    onOpenCourseCreator,
    onOpenFocus,
    onOpenTasks,
    profile,
    setBotText,
    setMood,
    setProfile,
    setShowQuickStart,
    setSpeaking,
    showAchievementNotice,
    syncMotivation,
    t,
  ])

  const completeGuidedTutorial = useCallback(async () => {
    if (!profile) return

    const nextProfile: UserProfile = {
      ...profile,
      onboardingIntent: 'learn',
      onboardingQuickStartDone: true,
    }

    setProfile(nextProfile)
    setShowTutorial(false)
    resetTutorialCourseGenerated()
    setPendingEnergyAfterQuickStart(false)
    setMood('proud')
    setBotText(t('app.tutorialComplete'))
    setSpeaking(true)
    window.setTimeout(() => setSpeaking(false), 3_200)

    try {
      await window.aura.profile.save(nextProfile)
    } catch {
      // Keep the first-session flow moving even if persistence fails once.
    }

    try {
      const updatedMotivation = await window.aura.motivation.addXP(25)
      syncMotivation(updatedMotivation)
    } catch {
      // XP bonus is helpful but should not block tutorial completion.
    }

    showAchievementNotice({
      icon: '🌱',
      title: t('app.firstCourse.title'),
      text: '+25 XP',
    }, 4_200)

    if (todayEnergy === null) {
      setShowEnergy(true)
    }
  }, [
    profile,
    resetTutorialCourseGenerated,
    setBotText,
    setMood,
    setPendingEnergyAfterQuickStart,
    setProfile,
    setShowEnergy,
    setShowTutorial,
    setSpeaking,
    showAchievementNotice,
    syncMotivation,
    t,
    todayEnergy,
  ])

  return {
    handleQuickStartChoice,
    completeGuidedTutorial,
  }
}