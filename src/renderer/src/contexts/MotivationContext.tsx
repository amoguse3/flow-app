import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BADGES } from '../../../../shared/constants'
import type { MotivationState } from '../../../../shared/types'
import { useLanguage } from './LanguageContext'

export interface AchievementNotice {
  icon: string
  title: string
  text: string
}

export interface MotivationContextValue {
  motivation: MotivationState | null
  achievementNotice: AchievementNotice | null
  initializeMotivation: (next: MotivationState | null) => void
  syncMotivation: (next: MotivationState | null, options?: { silent?: boolean }) => void
  refreshMotivation: () => Promise<MotivationState | null>
  setTrackingEnabled: (enabled: boolean) => void
  clearAchievementNotice: () => void
  showAchievementNotice: (notice: AchievementNotice, durationMs?: number) => void
}

const MotivationContext = createContext<MotivationContextValue | null>(null)

export function MotivationProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const [motivation, setMotivation] = useState<MotivationState | null>(null)
  const [achievementNotice, setAchievementNotice] = useState<AchievementNotice | null>(null)
  const [trackingEnabled, setTrackingEnabledState] = useState(false)
  const previousXpRef = useRef(0)
  const previousLevelRef = useRef(1)
  const previousBadgesRef = useRef<string[]>([])
  const achievementTimerRef = useRef<number | null>(null)

  const clearAchievementTimer = useCallback(() => {
    if (achievementTimerRef.current != null) {
      window.clearTimeout(achievementTimerRef.current)
      achievementTimerRef.current = null
    }
  }, [])

  const clearAchievementNotice = useCallback(() => {
    clearAchievementTimer()
    setAchievementNotice(null)
  }, [clearAchievementTimer])

  const showAchievementNotice = useCallback((notice: AchievementNotice, durationMs = 4_200) => {
    clearAchievementTimer()
    setAchievementNotice(notice)
    achievementTimerRef.current = window.setTimeout(() => {
      setAchievementNotice(null)
      achievementTimerRef.current = null
    }, durationMs)
  }, [clearAchievementTimer])

  const commitMotivation = useCallback((next: MotivationState | null, silent = false) => {
    if (!next) {
      previousXpRef.current = 0
      previousLevelRef.current = 1
      previousBadgesRef.current = []
      setMotivation(null)
      return
    }

    if (!silent) {
      if (next.level > previousLevelRef.current) {
        showAchievementNotice({
          icon: '⬆',
          title: t('app.levelUpTitle'),
          text: t('app.levelReached', { level: next.level }),
        }, 4_000)
      } else {
        const newBadges = (next.badges || []).filter((badgeId) => !previousBadgesRef.current.includes(badgeId))
        const latestBadgeId = newBadges[newBadges.length - 1]
        if (latestBadgeId) {
          const badge = BADGES.find((item) => item.id === latestBadgeId)
          if (badge) {
            showAchievementNotice({
              icon: badge.icon,
              title: t('app.badgeUnlocked'),
              text: t(badge.nameKey),
            })
          }
        }
      }
    }

    previousXpRef.current = next.xp
    previousLevelRef.current = next.level
    previousBadgesRef.current = next.badges || []
    setMotivation(next)
  }, [showAchievementNotice, t])

  const initializeMotivation = useCallback((next: MotivationState | null) => {
    commitMotivation(next, true)
  }, [commitMotivation])

  const syncMotivation = useCallback((next: MotivationState | null, options?: { silent?: boolean }) => {
    commitMotivation(next, options?.silent === true)
  }, [commitMotivation])

  const refreshMotivation = useCallback(async () => {
    const next = await window.aura.motivation.getState()
    commitMotivation(next)
    return next
  }, [commitMotivation])

  const setTrackingEnabled = useCallback((enabled: boolean) => {
    setTrackingEnabledState(enabled)
  }, [])

  useEffect(() => {
    if (!trackingEnabled) return undefined

    const pollId = window.setInterval(() => {
      void refreshMotivation().catch(() => undefined)
    }, 8_000)

    return () => window.clearInterval(pollId)
  }, [refreshMotivation, trackingEnabled])

  useEffect(() => {
    if (!trackingEnabled) return undefined

    const minutesId = window.setInterval(() => {
      void window.aura.motivation.addMinutes(1)
        .then((next) => commitMotivation(next))
        .catch(() => undefined)
    }, 60_000)

    return () => window.clearInterval(minutesId)
  }, [commitMotivation, trackingEnabled])

  useEffect(() => () => clearAchievementTimer(), [clearAchievementTimer])

  const value = useMemo<MotivationContextValue>(() => ({
    motivation,
    achievementNotice,
    initializeMotivation,
    syncMotivation,
    refreshMotivation,
    setTrackingEnabled,
    clearAchievementNotice,
    showAchievementNotice,
  }), [
    achievementNotice,
    clearAchievementNotice,
    initializeMotivation,
    motivation,
    refreshMotivation,
    setTrackingEnabled,
    showAchievementNotice,
    syncMotivation,
  ])

  return <MotivationContext.Provider value={value}>{children}</MotivationContext.Provider>
}

export function useMotivation() {
  const context = useContext(MotivationContext)
  if (!context) {
    throw new Error('useMotivation must be used within MotivationProvider')
  }
  return context
}