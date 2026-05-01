import { useState, useEffect } from 'react'
import type { Course } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'
import GlassCard from './ui/GlassCard'
import Button from './ui/Button'
import DisplayTitle from './ui/DisplayTitle'

interface Props {
  onSelectCourse: (courseId: number) => void
  onCreateCourse: () => void
  onOpenTeacher?: (courseId: number) => void
}

// Per-course cinematic gradient cover, derived deterministically from the title.
const COVER_PALETTES: Array<{ a: string; b: string; c: string; ring: string }> = [
  { a: '#1B0F30', b: '#6B3DD4', c: '#C8A3FF', ring: 'rgba(200,163,255,0.45)' },
  { a: '#2A0E14', b: '#C45A2A', c: '#FFB07A', ring: 'rgba(255,142,90,0.45)' },
  { a: '#0A2435', b: '#1E6F9A', c: '#5DCFFF', ring: 'rgba(93,207,255,0.4)' },
  { a: '#0A1810', b: '#3F7A2D', c: '#9DE07A', ring: 'rgba(157,224,122,0.4)' },
  { a: '#2A0E1F', b: '#C44A8E', c: '#FFB6D9', ring: 'rgba(255,182,217,0.4)' },
  { a: '#160B26', b: '#8E3FBE', c: '#D6A7FF', ring: 'rgba(214,167,255,0.45)' },
]

const coverFor = (key: string) => {
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return COVER_PALETTES[h % COVER_PALETTES.length]
}

export default function CourseList({ onSelectCourse, onCreateCourse, onOpenTeacher }: Props) {
  const { t } = useLanguage()
  const [courses, setCourses] = useState<Course[]>([])
  const [canCreate, setCanCreate] = useState(true)
  const [cooldownMin, setCooldownMin] = useState(0)
  const [cooldownSec, setCooldownSec] = useState(0)

  const syncCreateWindow = (nextCourses: Course[]) => {
    if (nextCourses.length === 0) {
      setCanCreate(true)
      setCooldownMin(0)
      setCooldownSec(0)
      return
    }
    const sorted = [...nextCourses].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    const lastCreated = new Date(sorted[0].created_at).getTime()
    const diff = Date.now() - lastCreated
    const twoHours = 2 * 60 * 60 * 1000
    if (diff < twoHours) {
      const remainMs = twoHours - diff
      setCanCreate(false)
      setCooldownMin(Math.floor(remainMs / 60000))
      setCooldownSec(Math.floor((remainMs % 60000) / 1000))
      return
    }
    setCanCreate(true)
    setCooldownMin(0)
    setCooldownSec(0)
  }

  const loadCourses = async () => {
    const nextCourses = await window.aura.educator.getCourses()
    setCourses(nextCourses)
    syncCreateWindow(nextCourses)
  }

  useEffect(() => {
    loadCourses()
    const unsubscribe = window.aura.educator.onCourseGenToken((event) => {
      if (event.courseId || event.done) {
        loadCourses().catch(() => null)
      }
    })
    return unsubscribe
  }, [])

  // ── Live ticker (per-second), drives both display and unlock transition. ──
  useEffect(() => {
    if (canCreate) return
    const id = window.setInterval(() => {
      syncCreateWindow(courses)
    }, 1000)
    return () => window.clearInterval(id)
  }, [canCreate, courses])

  const formatCooldown = (min: number, sec: number) => {
    if (min >= 60) {
      const h = Math.floor(min / 60)
      return `${h}${t('common.hoursShort')} ${min % 60}${t('common.minutesShort')}`
    }
    if (min === 0) return `${sec}s`
    return `${min}${t('common.minutesShort')} ${String(sec).padStart(2, '0')}s`
  }

  const activeCourses = courses.filter(c => c.status !== 'completed')
  const doneCourses = courses.filter(c => c.status === 'completed')

  const renderCard = (course: Course, index: number, finished: boolean) => {
    const cover = coverFor(course.title || `course-${course.id}`)
    const isGenerating = course.status === 'generating'
    const isFailed = course.status === 'failed'
    const isPending = isGenerating || isFailed
    const progress = isGenerating
      ? Math.max(6, Number(course.generation_progress || 0))
      : isFailed
        ? 0
        : finished
          ? 100
          : course.total_modules > 0
            ? Math.round((course.completed_modules / course.total_modules) * 100)
            : 0
    const ringPct = Math.max(0, Math.min(100, progress))
    const ringStroke = isFailed
      ? 'rgba(255,140,140,0.6)'
      : finished
        ? 'rgba(157,224,122,0.85)'
        : cover.c

    return (
      <GlassCard
        key={course.id}
        tone="md"
        radius="xl"
        data-tutorial={!finished && index === 0 ? 'course-list-first' : undefined}
        className="hover-lift cursor-pointer animate-fade-in-up overflow-hidden"
        style={{ animationDelay: `${index * 60}ms`, padding: 0 }}
        onClick={() => onSelectCourse(course.id)}
      >
        {/* Cinematic cover band (top half of the card) */}
        <div
          style={{
            height: 110,
            position: 'relative',
            background: `radial-gradient(ellipse at 30% 20%, ${cover.c}77 0%, ${cover.b}55 40%, ${cover.a} 90%)`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 75% 70%, rgba(255,255,255,0.18) 0%, transparent 35%), radial-gradient(circle at 20% 80%, rgba(0,0,0,0.45) 0%, transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          {/* Floating progress ring on cover */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: `conic-gradient(${ringStroke} ${ringPct * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(20,16,28,0.85)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-paper-0)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {finished ? '✓' : `${ringPct}`}
            </div>
          </div>

          {/* Status chip */}
          {isPending && (
            <div
              className="chip"
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                background: isFailed
                  ? 'rgba(255,120,120,0.18)'
                  : 'rgba(255,255,255,0.12)',
                borderColor: isFailed
                  ? 'rgba(255,120,120,0.32)'
                  : 'rgba(255,255,255,0.2)',
              }}
            >
              {isFailed ? '· failed' : '· generating'}
            </div>
          )}
          {finished && (
            <div
              className="chip"
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                background: 'rgba(157,224,122,0.18)',
                borderColor: 'rgba(157,224,122,0.35)',
                color: 'rgba(220,255,200,0.92)',
              }}
            >
              ✓ done
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px 18px' }}>
          <div
            className="font-serif-ui"
            style={{
              fontSize: 16,
              color: 'var(--color-paper-0)',
              fontWeight: 600,
              lineHeight: 1.32,
              marginBottom: 6,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {course.title}
          </div>

          {isPending ? (
            <div
              style={{
                fontSize: 12,
                color: isFailed ? 'rgba(255,168,168,0.7)' : 'var(--color-paper-2)',
                lineHeight: 1.5,
                marginBottom: 10,
              }}
            >
              {isFailed
                ? course.generation_error || t('courseList.failedHint')
                : course.generation_summary || t('courseList.generatingHint')}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--color-paper-2)', marginBottom: 10 }}>
              <span className="font-mono">{course.completed_modules}</span>
              <span style={{ opacity: 0.5 }}> / </span>
              <span className="font-mono">{course.total_modules}</span>
              <span style={{ opacity: 0.6 }}> modules</span>
            </div>
          )}

          {/* Progress bar */}
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
              marginBottom: onOpenTeacher && !isPending ? 12 : 0,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 999,
                background: finished
                  ? 'linear-gradient(90deg, rgba(157,224,122,0.85), rgba(220,255,200,0.65))'
                  : isFailed
                    ? 'rgba(255,140,140,0.55)'
                    : `linear-gradient(90deg, ${cover.b}, ${cover.c})`,
                boxShadow: finished
                  ? '0 0 10px rgba(157,224,122,0.35)'
                  : `0 0 10px ${cover.ring}`,
                transition: 'width 0.9s cubic-bezier(.16,1,.3,1)',
              }}
            />
          </div>

          {onOpenTeacher && !isPending && (
            <Button
              variant="ghost"
              size="sm"
              block
              onClick={e => {
                e.stopPropagation()
                onOpenTeacher(course.id)
              }}
            >
              <span style={{ marginRight: 6 }}>📖</span>
              {t('courseList.teacher')}
            </Button>
          )}
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* ── Hero header ────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between mb-7">
          <div>
            <DisplayTitle size="md" gradient="aurora" tight>
              Your library
            </DisplayTitle>
            <div style={{ fontSize: 12.5, color: 'var(--color-paper-2)', marginTop: 6 }}>
              <span className="font-mono">{courses.length}</span>
              <span style={{ opacity: 0.6 }}> · </span>
              {t('courseList.count', { count: courses.length })}
            </div>
          </div>

          {/* Create CTA */}
          {canCreate ? (
            <Button
              size="md"
              data-tutorial="course-list-create-button"
              onClick={onCreateCourse}
              leading={<span style={{ fontSize: 14, lineHeight: 1 }}>✦</span>}
            >
              {t('courseList.create')}
            </Button>
          ) : (
            <GlassCard tone="sm" radius="md" className="px-4 py-2.5 flex items-center gap-3">
              <span style={{ fontSize: 14 }}>🌱</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--color-paper-2)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {t('courseList.nextAvailable')}
                </div>
                <div className="font-mono" style={{ fontSize: 13, color: 'var(--color-paper-0)' }}>
                  {formatCooldown(cooldownMin, cooldownSec)}
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* ── Active courses grid ────────────────────────────────────────── */}
        {activeCourses.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-paper-3)',
                marginBottom: 12,
              }}
            >
              {t('courseList.growing')} · in progress
            </div>
            <div className="grid gap-4 mb-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {activeCourses.map((c, i) => renderCard(c, i, false))}
            </div>
          </>
        )}

        {/* ── Completed grid ─────────────────────────────────────────────── */}
        {doneCourses.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-paper-3)',
                marginBottom: 12,
              }}
            >
              {t('courseList.bloomed')} · finished
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {doneCourses.map((c, i) => renderCard(c, activeCourses.length + i, true))}
            </div>
          </>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {courses.length === 0 && (
          <div className="text-center py-14 animate-fade-in-up">
            <div
              className="animate-breathe mx-auto mb-7"
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85) 0%, var(--aura-accent, #C8A3FF) 35%, rgba(0,0,0,0.6) 90%)',
                boxShadow:
                  '0 0 60px rgba(var(--aura-accent-rgb,200,163,255),0.4), 0 0 130px rgba(var(--aura-accent-rgb,200,163,255),0.18)',
              }}
            />
            <DisplayTitle size="sm" gradient="aurora" tight className="mb-3">
              The library waits.
            </DisplayTitle>
            <div style={{ fontSize: 14, color: 'var(--color-paper-2)', maxWidth: 360, margin: '0 auto 24px', lineHeight: 1.55 }}>
              {t('courseList.emptySubtitle')}
            </div>
            <Button
              size="lg"
              onClick={onCreateCourse}
              leading={<span>✦</span>}
            >
              {t('courseList.emptyAction')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
