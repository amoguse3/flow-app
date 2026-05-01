import { useState, useEffect, useRef, useCallback } from 'react'
import type { BrainGameCompletion, GameChallenge, GameChallengeSeed, GameAction } from '../../../../../shared/types'
import { useLanguage } from '../../contexts/LanguageContext'

interface Props { onEnd: () => void; onResult?: (result: BrainGameCompletion) => void; challengeSeed?: GameChallengeSeed | null; difficulty?: import('../../../../../shared/types').GameDifficulty }

export default function MathSpeedGame({ onEnd, onResult, challengeSeed = null, difficulty = 'normal' }: Props) {
  const { t } = useLanguage()
  const [challenge, setChallenge] = useState<GameChallenge | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [input, setInput] = useState('')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<{ verified: boolean; score: number; points: number } | null>(null)
  const actionsRef = useRef<GameAction[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.aura.games.startChallenge('math_speed', difficulty, challengeSeed).then(setChallenge)
  }, [challengeSeed, difficulty])

  useEffect(() => {
    if (!challenge || finished) return
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); endGame(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [challenge, finished])

  useEffect(() => {
    inputRef.current?.focus()
  }, [currentIdx])

  const endGame = useCallback(async () => {
    if (finished || !challenge) return
    setFinished(true)
    const completedAt = Date.now()
    const res = await window.aura.games.submitResult({
      challengeId: challenge.id,
      actions: actionsRef.current,
      claimedScore: score,
      completedAt,
    })
    setResult(res)
    onResult?.({ gameType: 'math_speed', verified: res.verified, score: res.score, points: res.points, completedAt })
  }, [finished, challenge, score, onResult])

  const submitAnswer = () => {
    if (!challenge || !input.trim() || finished) return
    const problems = challenge.data.problems

    actionsRef.current.push({
      type: 'answer',
      value: Number(input),
      timestamp: Date.now()
    })

    // We don't know the answer — main process validates. Show as "submitted"
    setScore(s => s + 1) // Tentative count
    setInput('')

    if (currentIdx + 1 >= problems.length) {
      endGame()
    } else {
      setCurrentIdx(i => i + 1)
    }
  }

  if (!challenge) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-breathe w-12 h-12 rounded-full" style={{
          background: 'radial-gradient(circle, #d97706, transparent)'
        }} />
      </div>
    )
  }

  const problems = challenge.data.problems
  const current = problems[currentIdx]

  if (finished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{
          background: result?.verified ? 'radial-gradient(circle, #10b981, #059669)' : 'radial-gradient(circle, #ef4444, #dc2626)',
          boxShadow: result?.verified ? '0 0 30px rgba(16,185,129,0.3)' : '0 0 30px rgba(239,68,68,0.3)'
        }}>
          <span className="text-2xl">{result?.verified ? '✓' : '✗'}</span>
        </div>
        <h2 className="text-xl font-semibold text-aura-text mb-2">
          {result?.verified ? t('game.math.success') : t('game.math.fail')}
        </h2>
        <p className="text-sm text-aura-muted mb-1">{t('game.score', { score: result?.score || 0 })}</p>
        <p className="text-sm text-aura-muted mb-1">{t('game.pointsAward', { points: result?.points || 0 })}</p>
        <p className="text-[10px] text-aura-muted mb-6">
          {t('game.answeredCount', { answered: actionsRef.current.length, total: problems.length })}
        </p>
        <button onClick={onEnd}
          className="px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)', color: '#d97706' }}>
          {t('game.backToGames')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
      {/* Timer + progress */}
      <div className="flex items-center justify-between w-full max-w-xs mb-6">
        <span className={`text-lg font-mono font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-aura-orange'}`}>
          {t('game.timeShort', { seconds: timeLeft })}
        </span>
        <span className="text-xs text-aura-muted">{currentIdx + 1}/{problems.length}</span>
        <button onClick={onEnd} className="text-xs text-aura-muted hover:text-red-400 transition-colors">✕ {t('game.quit')}</button>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1 rounded-full mb-8" style={{ background: 'rgba(42,37,32,0.3)' }}>
        <div className="h-full rounded-full transition-all" style={{
          width: `${(currentIdx / problems.length) * 100}%`,
          background: 'linear-gradient(90deg, #d97706, #f59e0b)'
        }} />
      </div>

      {/* Problem */}
      <div className="text-center mb-8">
        <p className="text-4xl font-light text-aura-text font-mono" style={{ letterSpacing: 4 }}>
          {current.a} {current.op} {current.b}
        </p>
        <p className="text-xs text-aura-muted mt-2">= ?</p>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 max-w-xs">
        <input ref={inputRef}
          type="number" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitAnswer() }}
          className="flex-1 bg-transparent text-center text-2xl text-aura-text font-mono outline-none px-4 py-3 rounded-xl"
          style={{ background: 'rgba(18,16,14,0.8)', border: '1px solid rgba(42,37,32,0.5)' }}
          placeholder="..."
          autoFocus
        />
        <button onClick={submitAnswer}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 0 15px rgba(217,119,6,0.3)' }}>
          <span className="text-white text-lg">→</span>
        </button>
      </div>
    </div>
  )
}
