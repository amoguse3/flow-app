import { useEffect, useState } from 'react'
import { useMotivation } from '../contexts/MotivationContext'
import GlassCard from './ui/GlassCard'

const KEY_DISMISSED = 'wispucci_streak_nudge_dismissed_date'
const KEY_LAST_LESSON_DAY = 'wispucci_last_lesson_day'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isAfter6pm = () => new Date().getHours() >= 18

/**
 * Streak-at-risk nudge.
 *
 * Shows a small empathetic bubble near the top of the screen ONLY when:
 * 1. The user has a streak >= 2 days (something worth losing).
 * 2. They haven't completed a lesson today.
 * 3. It's after 18:00 local time.
 * 4. They haven't dismissed it today.
 *
 * The orb visually mirrors the user's risk: when a streak is in danger
 * the bubble nudges them with a soft "don't let me fade" message.
 * It is dismissible, never blocking, and never used for shame.
 */
export default function StreakNudge() {
  const { motivation } = useMotivation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!motivation) {
      setOpen(false)
      return
    }
    if ((motivation.streak ?? 0) < 2) { setOpen(false); return }
    if (!isAfter6pm()) { setOpen(false); return }

    const today = todayKey()
    const dismissed = localStorage.getItem(KEY_DISMISSED)
    if (dismissed === today) { setOpen(false); return }

    const lastLesson = localStorage.getItem(KEY_LAST_LESSON_DAY)
    if (lastLesson === today) { setOpen(false); return }

    setOpen(true)
  }, [motivation])

  if (!open || !motivation) return null

  const streak = motivation.streak

  const dismiss = () => {
    localStorage.setItem(KEY_DISMISSED, todayKey())
    setOpen(false)
  }

  return (
    <GlassCard
      tone="md"
      radius="lg"
      glow
      className="absolute top-14 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-3 animate-fade-in-up"
      style={{ padding: '12px 16px', maxWidth: 380 }}
    >
      <div
        className="animate-breathe shrink-0"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7) 0%, var(--aura-accent, #C8A3FF) 40%, rgba(20,16,28,0.6) 100%)',
          boxShadow: '0 0 24px rgba(var(--aura-accent-rgb,200,163,255), 0.45)',
          opacity: 0.9,
          filter: 'saturate(0.85)',
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="font-serif-ui"
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-paper-0)', lineHeight: 1.3 }}
        >
          {streak} day streak — don't lose me?
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-paper-2)', marginTop: 2 }}>
          One 5-min lesson keeps it alive.
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-paper-3)',
          cursor: 'pointer',
          padding: 4,
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </GlassCard>
  )
}

/** Call this on lesson completion so the nudge stops bothering them today. */
export function markLessonCompletedToday() {
  try {
    localStorage.setItem(KEY_LAST_LESSON_DAY, todayKey())
  } catch {
    /* storage quota / private mode */
  }
}
