import { useState, useEffect, useRef } from 'react'
import type { BrainGameCompletion, GameChallenge, GameChallengeSeed, GameAction } from '../../../../../shared/types'
import { useLanguage } from '../../contexts/LanguageContext'

interface Props { onEnd: () => void; onResult?: (result: BrainGameCompletion) => void; challengeSeed?: GameChallengeSeed | null; difficulty?: import('../../../../../shared/types').GameDifficulty }

type Phase = 'waiting' | 'ready' | 'go' | 'clicked' | 'too_early'

export default function ReactionTimeGame({ onEnd, onResult, challengeSeed = null, difficulty = 'normal' }: Props) {
  const { t } = useLanguage()
  const [challenge, setChallenge] = useState<GameChallenge | null>(null)
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<Phase>('waiting')
  const [reactionTime, setReactionTime] = useState(0)
  const [reactions, setReactions] = useState<number[]>([])
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<{ verified: boolean; score: number; points: number } | null>(null)
  const actionsRef = useRef<GameAction[]>([])
  const goTimeRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    window.aura.games.startChallenge('reaction_time', difficulty, challengeSeed).then(c => {
      setChallenge(c)
      startRound(c, 0)
    })
  }, [challengeSeed, difficulty])

  const startRound = (c: GameChallenge, idx: number) => {
    if (idx >= c.data.rounds) {
      endGame(c)
      return
    }
    setRound(idx)
    setPhase('ready')
    setReactionTime(0)

    // Random delay before showing "GO"
    const delay = 1000 + Math.floor(Math.random() * 3000)
    timerRef.current = setTimeout(() => {
      goTimeRef.current = Date.now()
      setPhase('go')
    }, delay)
  }

  const handleClick = () => {
    if (!challenge) return

    if (phase === 'ready') {
      // Clicked too early
      if (timerRef.current) clearTimeout(timerRef.current)
      setPhase('too_early')
      actionsRef.current.push({ type: 'reaction', value: -1, timestamp: Date.now() })
      setTimeout(() => startRound(challenge, round + 1), 1500)
      return
    }

    if (phase === 'go') {
      const rt = Date.now() - goTimeRef.current
      setReactionTime(rt)
      setReactions(prev => [...prev, rt])
      setPhase('clicked')
      actionsRef.current.push({ type: 'reaction', value: rt, timestamp: Date.now() })
      setTimeout(() => startRound(challenge, round + 1), 1500)
    }
  }

  const endGame = async (c?: GameChallenge) => {
    const ch = c || challenge
    if (finished || !ch) return
    setFinished(true)
    const validReactions = reactions.filter(r => r > 0)
    const score = validReactions.reduce((sum, r) => sum + Math.max(0, Math.floor(100 * (1 - r / 1000))), 0)
    const completedAt = Date.now()
    const res = await window.aura.games.submitResult({
      challengeId: ch.id,
      actions: actionsRef.current,
      claimedScore: score,
      completedAt,
    })
    setResult(res)
    onResult?.({ gameType: 'reaction_time', verified: res.verified, score: res.score, points: res.points, completedAt })
  }

  if (!challenge) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="animate-breathe w-12 h-12 rounded-full" style={{ background: 'radial-gradient(circle, #ef4444, transparent)' }} />
    </div>
  }

  if (finished) {
    const avgTime = reactions.length > 0
      ? Math.round(reactions.filter(r => r > 0).reduce((a, b) => a + b, 0) / reactions.filter(r => r > 0).length)
      : 0
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{
          background: 'radial-gradient(circle, #ef4444, #dc2626)', boxShadow: '0 0 30px rgba(239,68,68,0.3)'
        }}>
          <span className="text-2xl">⚡</span>
        </div>
        <h2 className="text-xl font-semibold text-aura-text mb-2">{t('game.reaction.complete')}</h2>
        <p className="text-sm text-aura-muted mb-1">{t('game.averageMs', { ms: avgTime })}</p>
        <p className="text-sm text-aura-muted mb-1">{t('game.score', { score: result?.score || 0 })}</p>
        <p className="text-sm text-aura-muted mb-6">{t('game.pointsAward', { points: result?.points || 0 })}</p>
        <button onClick={onEnd}
          className="px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {t('game.backToGames')}
        </button>
      </div>
    )
  }

  const bgColor = phase === 'go' ? '#10b981' : phase === 'too_early' ? '#ef4444' : phase === 'clicked' ? '#3b82f6' : '#2a2520'
  const reactionFeedback = reactionTime < 200
    ? t('game.reaction.feedbackAmazing')
    : reactionTime < 350
      ? t('game.reaction.feedbackGood')
      : t('game.reaction.feedbackKeepTrying')

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative z-10 cursor-pointer select-none"
      onClick={handleClick}
      style={{ background: phase === 'go' ? 'rgba(16,185,129,0.1)' : phase === 'too_early' ? 'rgba(239,68,68,0.1)' : 'transparent' }}>

      <div className="flex items-center justify-between w-full max-w-xs mb-6 px-6">
        <span className="text-sm font-medium" style={{ color: '#ef4444' }}>
          {t('game.roundProgress', { current: round + 1, total: challenge.data.rounds })}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onEnd() }}
          className="text-xs text-aura-muted hover:text-red-400">✕</button>
      </div>

      {/* Main circle */}
      <div className="w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 mb-6" style={{
        background: `radial-gradient(circle, ${bgColor}, ${bgColor}60)`,
        boxShadow: `0 0 40px ${bgColor}30`,
        transform: phase === 'go' ? 'scale(1.2)' : 'scale(1)'
      }}>
        {phase === 'ready' && <span className="text-lg text-aura-muted">{t('game.reaction.wait')}</span>}
        {phase === 'go' && <span className="text-2xl text-white font-bold">{t('game.reaction.tap')}</span>}
        {phase === 'too_early' && <span className="text-sm text-white">{t('game.reaction.tooEarly')}</span>}
        {phase === 'clicked' && <span className="text-lg text-white font-mono">{reactionTime}ms</span>}
      </div>

      <p className="text-xs text-aura-muted">
        {phase === 'ready' ? t('game.reaction.waitGreen') :
          phase === 'go' ? t('game.reaction.clickNow') :
            phase === 'too_early' ? t('game.reaction.waitNext') :
              `${reactionTime}ms - ${reactionFeedback}`}
      </p>
    </div>
  )
}
