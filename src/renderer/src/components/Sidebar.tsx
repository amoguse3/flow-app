import { useState, useEffect } from 'react'
import type { Task, UserProfile } from '../../../../shared/types'
import { LEVELS, BADGES } from '../../../../shared/constants'
import { useLanguage } from '../contexts/LanguageContext'
import { useMotivation } from '../contexts/MotivationContext'

interface Props {
  onClose: () => void
  profile: UserProfile
}

export default function Sidebar({ onClose, profile }: Props) {
  const { t } = useLanguage()
  const { motivation, syncMotivation } = useMotivation()
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [tab, setTab] = useState<'tasks' | 'stats'>('tasks')

  useEffect(() => {
    window.aura.tasks.list().then(setTasks)
  }, [])

  const addTask = async () => {
    if (!newTask.trim()) return
    const task = await window.aura.tasks.add(newTask.trim())
    setTasks(prev => [{ ...task, done: false }, ...prev])
    setNewTask('')
  }

  const toggleTask = async (id: number) => {
    await window.aura.tasks.toggle(id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
    // Award XP for completing — propagate via shared context so other panels stay in sync.
    const task = tasks.find(t => t.id === id)
    if (task && !task.done) {
      const mot = await window.aura.motivation.addXP(15)
      syncMotivation(mot)
    }
  }

  const removeTask = async (id: number) => {
    await window.aura.tasks.remove(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const level = motivation ? LEVELS[motivation.level - 1] : LEVELS[0]
  const nextLevel = motivation && motivation.level < LEVELS.length ? LEVELS[motivation.level] : null
  const xpProgress = motivation && nextLevel
    ? ((motivation.xp - level.minXP) / (nextLevel.minXP - level.minXP)) * 100
    : 100

  const pendingCount = tasks.filter(t => !t.done).length
  const doneCount = tasks.filter(t => t.done).length
  const streakMessage = motivation
    ? motivation.streak === 0
      ? t('sidebar.streak.start')
      : motivation.streak < 3
        ? t('sidebar.streak.keepUp')
        : motivation.streak < 7
          ? t('sidebar.streak.onFire')
          : motivation.streak < 30
            ? t('sidebar.streak.legendary')
            : t('sidebar.streak.master')
    : null

  const courseMilestones = [1, 3, 5, 10]
  const wordMilestones = [200, 1000, 5000, 15000]
  const timeMilestones = [30, 120, 600, 1800]

  const nextMilestone = (value: number, milestones: number[]) => milestones.find(m => value < m) ?? null
  const progressToNext = (value: number, milestones: number[]) => {
    const next = nextMilestone(value, milestones)
    if (!next) return 100
    const prev = [...milestones].reverse().find(m => m <= value) ?? 0
    const span = Math.max(1, next - prev)
    return Math.max(0, Math.min(100, ((value - prev) / span) * 100))
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 z-40 animate-slide-right flex flex-col"
      style={{
        background: 'rgba(12,10,8,0.95)',
        borderLeft: '1px solid rgba(42,37,32,0.4)',
        backdropFilter: 'blur(20px)'
      }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid rgba(42,37,32,0.3)' }}>
        <div className="flex gap-1">
          <button onClick={() => setTab('tasks')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${tab === 'tasks' ? 'text-aura-orange' : 'text-aura-muted'}`}
            style={tab === 'tasks' ? { background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' } : { background: 'transparent', border: '1px solid transparent' }}>
            {t('sidebar.tasks')}
          </button>
          <button onClick={() => setTab('stats')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${tab === 'stats' ? 'text-aura-violet' : 'text-aura-muted'}`}
            style={tab === 'stats' ? { background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' } : { background: 'transparent', border: '1px solid transparent' }}>
            {t('sidebar.stats')}
          </button>
        </div>
        <button onClick={onClose} className="text-aura-muted hover:text-aura-text text-sm px-1">✕</button>
      </div>

      {tab === 'tasks' ? (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {/* Add task */}
          <div className="flex gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder={t('sidebar.newTask')}
              className="flex-1 bg-transparent text-xs text-aura-text placeholder:text-aura-muted px-3 py-2 rounded-lg"
              style={{ border: '1px solid rgba(42,37,32,0.5)' }}
            />
            <button onClick={addTask}
              className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(217,119,6,0.15)', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)' }}>
              +
            </button>
          </div>

          {/* Counter */}
          <div className="flex gap-3 text-[10px] text-aura-muted px-1">
            <span>{t('sidebar.todoCount', { count: pendingCount })}</span>
            <span>{t('sidebar.doneCount', { count: doneCount })}</span>
          </div>

          {/* Task list */}
          {tasks.map((task) => (
            <div key={task.id}
              className="group flex items-start gap-2 px-3 py-2 rounded-lg transition-all animate-fade-in"
              style={{
                background: task.done ? 'rgba(16,185,129,0.05)' : 'rgba(26,23,20,0.5)',
                border: `1px solid ${task.done ? 'rgba(16,185,129,0.15)' : 'rgba(42,37,32,0.3)'}`
              }}>
              <button onClick={() => toggleTask(task.id)}
                className="mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all"
                style={{
                  borderColor: task.done ? '#10b981' : 'rgba(42,37,32,0.6)',
                  background: task.done ? 'rgba(16,185,129,0.2)' : 'transparent'
                }}>
                {task.done && <span className="text-[10px] text-emerald-400">✓</span>}
              </button>
              <span className={`flex-1 text-xs leading-relaxed ${task.done ? 'line-through text-aura-muted' : 'text-aura-text'}`}>
                {task.text}
              </span>
              <button onClick={() => removeTask(task.id)}
                className="opacity-0 group-hover:opacity-100 text-[10px] text-aura-muted hover:text-red-400 transition-all">
                ✕
              </button>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="text-center py-8">
              <span className="text-2xl opacity-30">📋</span>
              <p className="text-xs text-aura-muted mt-2">{t('sidebar.noTasks')}</p>
              <p className="text-[10px] text-aura-muted mt-1">{t('sidebar.emptyHint')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* XP Bar */}
          {motivation && (
            <>
              <div className="rounded-xl p-3" style={{
                background: 'rgba(26,23,20,0.6)',
                border: '1px solid rgba(42,37,32,0.3)'
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-aura-text">{t(level.nameKey)}</span>
                  <span className="text-[10px] text-aura-orange">{motivation.xp} XP</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,37,32,0.5)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${Math.min(xpProgress, 100)}%`,
                    background: 'linear-gradient(90deg, #d97706, #f59e0b)',
                    boxShadow: '0 0 8px rgba(217,119,6,0.4)'
                  }} />
                </div>
                {nextLevel && (
                  <p className="text-[10px] text-aura-muted mt-1.5">
                    {nextLevel.minXP - motivation.xp} XP → {t(nextLevel.nameKey)}
                  </p>
                )}
              </div>

              {/* Streak */}
              <div className="rounded-xl p-3 flex items-center gap-3" style={{
                background: motivation.streak >= 7
                  ? 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(217,119,6,0.1))'
                  : 'rgba(26,23,20,0.6)',
                border: `1px solid ${motivation.streak >= 7 ? 'rgba(239,68,68,0.2)' : 'rgba(42,37,32,0.3)'}`
              }}>
                <span className="text-2xl">{motivation.streak >= 7 ? '🔥' : motivation.streak >= 3 ? '⚡' : '💫'}</span>
                <div>
                  <p className="text-sm font-medium text-aura-text">{t('sidebar.streakDays', { count: motivation.streak })}</p>
                  <p className="text-[10px] text-aura-muted">{streakMessage}</p>
                </div>
              </div>

              {/* Badges */}
              <div className="rounded-xl p-3" style={{
                background: 'rgba(26,23,20,0.6)',
                border: '1px solid rgba(42,37,32,0.3)'
              }}>
                <p className="text-xs font-medium text-aura-text mb-2">{t('sidebar.badges')}</p>
                <div className="flex flex-wrap gap-2">
                  {BADGES.map(badge => {
                    const earned = motivation.badges.includes(badge.id)
                    return (
                      <div key={badge.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px]"
                        style={{
                          background: earned ? 'rgba(217,119,6,0.1)' : 'rgba(42,37,32,0.2)',
                          border: `1px solid ${earned ? 'rgba(217,119,6,0.2)' : 'rgba(42,37,32,0.3)'}`,
                          opacity: earned ? 1 : 0.4
                        }}>
                        <span>{badge.icon}</span>
                        <span className={earned ? 'text-aura-text' : 'text-aura-muted'}>{t(badge.nameKey)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Achievement tracks */}
              <div className="rounded-xl p-3" style={{
                background: 'rgba(26,23,20,0.6)',
                border: '1px solid rgba(42,37,32,0.3)'
              }}>
                <p className="text-xs font-medium text-aura-text mb-3">{t('sidebar.achievements')}</p>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-aura-text">📚 {t('achievements.coursesTrack')} · {t('achievements.levelLabel')} {motivation.achievementLevels.courses}</span>
                    <span className="text-[10px] text-aura-muted">{motivation.coursesCompleted}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,37,32,0.5)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${progressToNext(motivation.coursesCompleted, courseMilestones)}%`,
                      background: 'linear-gradient(90deg, #10b981, #34d399)'
                    }} />
                  </div>
                  {nextMilestone(motivation.coursesCompleted, courseMilestones) && (
                    <p className="text-[10px] text-aura-muted mt-1">
                      {t('sidebar.nextLevelCourses', { count: nextMilestone(motivation.coursesCompleted, courseMilestones)! })}
                    </p>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-aura-text">✍️ {t('achievements.wordsTrack')} · {t('achievements.levelLabel')} {motivation.achievementLevels.words}</span>
                    <span className="text-[10px] text-aura-muted">{motivation.wordsTyped}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,37,32,0.5)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${progressToNext(motivation.wordsTyped, wordMilestones)}%`,
                      background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)'
                    }} />
                  </div>
                  {nextMilestone(motivation.wordsTyped, wordMilestones) && (
                    <p className="text-[10px] text-aura-muted mt-1">
                      {t('sidebar.nextLevelWords', { count: nextMilestone(motivation.wordsTyped, wordMilestones)! })}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-aura-text">⏱ {t('achievements.timeTrack')} · {t('achievements.levelLabel')} {motivation.achievementLevels.time}</span>
                    <span className="text-[10px] text-aura-muted">{motivation.minutesSpent} {t('common.minutesShort')}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,37,32,0.5)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${progressToNext(motivation.minutesSpent, timeMilestones)}%`,
                      background: 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    }} />
                  </div>
                  {nextMilestone(motivation.minutesSpent, timeMilestones) && (
                    <p className="text-[10px] text-aura-muted mt-1">
                      {t('sidebar.nextLevelMinutes', { count: nextMilestone(motivation.minutesSpent, timeMilestones)! })}
                    </p>
                  )}
                </div>
              </div>

              {/* Profile info */}
              <div className="rounded-xl p-3" style={{
                background: 'rgba(26,23,20,0.6)',
                border: '1px solid rgba(42,37,32,0.3)'
              }}>
                <p className="text-xs font-medium text-aura-text mb-1">{profile.name}</p>
                <p className="text-[10px] text-aura-muted">
                  {profile.hasADHD ? `${t('sidebar.adhdModeActive')} · ` : ''}
                  {profile.language === 'ro' ? 'Română' : profile.language === 'ru' ? 'Русский' : 'English'}
                </p>
                <p className="text-[10px] text-aura-muted mt-1">
                  {t('sidebar.quickToggle')}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
