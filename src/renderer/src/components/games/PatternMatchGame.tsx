import { useState, useEffect, useRef } from 'react'
import type { BrainGameCompletion, GameChallenge, GameChallengeSeed, GameAction } from '../../../../../shared/types'
import { useLanguage } from '../../contexts/LanguageContext'

interface Props { onEnd: () => void; onResult?: (result: BrainGameCompletion) => void; challengeSeed?: GameChallengeSeed | null; difficulty?: import('../../../../../shared/types').GameDifficulty }

export default function PatternMatchGame({ onEnd, onResult, challengeSeed = null, difficulty = 'normal' }: Props) {
  const { t } = useLanguage()
  const [challenge, setChallenge] = useState<GameChallenge | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [input, setInput] = useState('')
  const [correct, setCorrect] = useState(0)
  const [timeLeft, setTimeLeft] = useState(90)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<{ verified: boolean; score: number; points: number } | null>(null)
  const actionsRef = useRef<GameAction[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.aura.games.startChallenge('pattern_match', difficulty, challengeSeed).then(setChallenge)
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

  useEffect(() => { inputRef.current?.focus() }, [currentIdx])

  const endGame = async () => {
    if (finished || !challenge) return
    setFinished(true)
    const completedAt = Date.now()
    const res = await window.aura.games.submitResult({
      challengeId: challenge.id,
      actions: actionsRef.current,
      claimedScore: correct * 100,
      completedAt,
    })
    setResult(res)
    onResult?.({ gameType: 'pattern_match', verified: res.verified, score: res.score, points: res.points, completedAt })
  }

  const submitAnswer = () => {
    if (!challenge || !input.trim() || finished) return
    actionsRef.current.push({ type: 'answer', value: Number(input), timestamp: Date.now() })
    setCorrect(c => c + 1) // Tentative
    setInput('')
    if (currentIdx + 1 >= challenge.data.rounds.length) {
      endGame()
    } else {
      setCurrentIdx(i => i + 1)
    }
  }

  if (!challenge) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="animate-breathe w-12 h-12 rounded-full" style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
    </div>
  }

  if (finished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{
          background: 'radial-gradient(circle, #3b82f6, #1d4ed8)', boxShadow: '0 0 30px rgba(59,130,246,0.3)'
        }}>
          <span className="text-2xl">🔢</span>
        </div>
        <h2 className="text-xl font-semibold text-aura-text mb-2">{t('game.pattern.complete')}</h2>
        <p className="text-sm text-aura-muted mb-1">{t('game.score', { score: result?.score || 0 })}</p>
        <p className="text-sm text-aura-muted mb-6">{t('game.pointsAward', { points: result?.points || 0 })}</p>
        <button onClick={onEnd}
          className="px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
          {t('game.backToGames')}
        </button>
      </div>
    )
  }

  const rounds = challenge.data.rounds
  const current = rounds[currentIdx]

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
      <div className="flex items-center justify-between w-full max-w-xs mb-6">
        <span className={`text-lg font-mono font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>
          {t('game.timeShort', { seconds: timeLeft })}
        </span>
        <span className="text-xs text-aura-muted">{currentIdx + 1}/{rounds.length}</span>
        <button onClick={onEnd} className="text-xs text-aura-muted hover:text-red-400">✕</button>
      </div>

      <p className="text-xs text-aura-muted mb-6">{t('game.pattern.prompt')}</p>

      {/* Sequence display */}
      <div className="flex items-center gap-3 mb-8">
        {current.sequence.map((n: number, i: number) => (
          <div key={i} className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-mono font-bold text-aura-text"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
            {n}
          </div>
        ))}
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-mono animate-pulse"
          style={{ background: 'rgba(59,130,246,0.05)', border: '2px dashed rgba(59,130,246,0.3)', color: '#3b82f6' }}>
          ?
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-xs">
        <input ref={inputRef} type="number" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitAnswer() }}
          className="flex-1 bg-transparent text-center text-2xl text-aura-text font-mono outline-none px-4 py-3 rounded-xl"
          style={{ background: 'rgba(18,16,14,0.8)', border: '1px solid rgba(42,37,32,0.5)' }}
          placeholder="..." autoFocus />
        <button onClick={submitAnswer}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 0 15px rgba(59,130,246,0.3)' }}>
          <span className="text-white text-lg">→</span>
        </button>
      </div>
    </div>
  )
}
