import { useState, useEffect, useRef } from 'react'
import type { BrainGameCompletion, GameChallenge, GameChallengeSeed, GameAction } from '../../../../../shared/types'
import { useLanguage } from '../../contexts/LanguageContext'

interface Props { onEnd: () => void; onResult?: (result: BrainGameCompletion) => void; challengeSeed?: GameChallengeSeed | null; difficulty?: import('../../../../../shared/types').GameDifficulty }

export default function ColorStroopGame({ onEnd, onResult, challengeSeed = null, difficulty = 'normal' }: Props) {
  const { t } = useLanguage()
  const [challenge, setChallenge] = useState<GameChallenge | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [timeLeft, setTimeLeft] = useState(45)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<{ verified: boolean; score: number; points: number } | null>(null)
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null)
  const actionsRef = useRef<GameAction[]>([])

  useEffect(() => {
    window.aura.games.startChallenge('color_stroop', difficulty, challengeSeed).then(setChallenge)
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
    onResult?.({ gameType: 'color_stroop', verified: res.verified, score: res.score, points: res.points, completedAt })
  }

  const selectColor = (color: string) => {
    if (!challenge || finished) return

    actionsRef.current.push({ type: 'answer', value: color, timestamp: Date.now() })

    // Visual feedback
    const round = challenge.data.rounds[currentIdx]
    const hexToName: Record<string, string> = {
      '#ef4444': t('color.red'), '#3b82f6': t('color.blue'), '#22c55e': t('color.green'),
      '#eab308': t('color.yellow'), '#f97316': t('color.orange')
    }
    const correctColor = hexToName[round.displayColor] || ''
    if (color === correctColor) {
      setCorrect(c => c + 1)
      setFlash('correct')
    } else {
      setFlash('wrong')
    }

    setTimeout(() => {
      setFlash(null)
      if (currentIdx + 1 >= challenge.data.rounds.length) {
        endGame()
      } else {
        setCurrentIdx(i => i + 1)
      }
    }, 300)
  }

  if (!challenge) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="animate-breathe w-12 h-12 rounded-full" style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
    </div>
  }

  if (finished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{
          background: 'radial-gradient(circle, #f97316, #ea580c)', boxShadow: '0 0 30px rgba(249,115,22,0.3)'
        }}>
          <span className="text-2xl">🎨</span>
        </div>
        <h2 className="text-xl font-semibold text-aura-text mb-2">{t('game.stroop.complete')}</h2>
        <p className="text-sm text-aura-muted mb-1">{t('game.score', { score: result?.score || 0 })}</p>
        <p className="text-sm text-aura-muted mb-1">{t('game.roundsCorrect', { correct, total: challenge.data.rounds.length })}</p>
        <p className="text-sm text-aura-muted mb-6">{t('game.pointsAward', { points: result?.points || 0 })}</p>
        <button onClick={onEnd}
          className="px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c' }}>
          {t('game.backToGames')}
        </button>
      </div>
    )
  }

  const round = challenge.data.rounds[currentIdx]
  const colorButtons: Array<{ name: string; hex: string }> = [
    { name: t('color.red'), hex: '#ef4444' },
    { name: t('color.blue'), hex: '#3b82f6' },
    { name: t('color.green'), hex: '#22c55e' },
    { name: t('color.yellow'), hex: '#eab308' },
    { name: t('color.orange'), hex: '#f97316' }
  ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10"
      style={{
        background: flash === 'correct' ? 'rgba(16,185,129,0.05)' : flash === 'wrong' ? 'rgba(239,68,68,0.05)' : 'transparent',
        transition: 'background 0.2s ease'
      }}>

      <div className="flex items-center justify-between w-full max-w-xs mb-6">
        <span className={`text-lg font-mono font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}>
          {t('game.timeShort', { seconds: timeLeft })}
        </span>
        <span className="text-xs text-aura-muted">{currentIdx + 1}/{challenge.data.rounds.length}</span>
        <button onClick={onEnd} className="text-xs text-aura-muted hover:text-red-400">✕</button>
      </div>

      <p className="text-xs text-aura-muted mb-2">{t('game.stroop.question')}</p>
      <p className="text-[10px] text-aura-muted mb-8">{t('game.stroop.ignore')}</p>

      {/* The stroop word */}
      <div className="mb-10">
        <p className="text-5xl font-bold transition-all" style={{
          color: round.displayColor,
          textShadow: `0 0 20px ${round.displayColor}30`,
          fontFamily: 'Georgia, serif'
        }}>
          {round.text}
        </p>
      </div>

      {/* Color options */}
      <div className="flex flex-wrap justify-center gap-2 max-w-xs">
        {colorButtons.map(btn => (
          <button key={btn.name} onClick={() => selectColor(btn.name)}
            className="px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-110 active:scale-95"
            style={{
              background: `${btn.hex}20`,
              border: `2px solid ${btn.hex}40`,
              color: btn.hex
            }}>
            {btn.name}
          </button>
        ))}
      </div>

      {/* Score */}
      <p className="text-xs text-aura-muted mt-6">{t('game.correctCount', { count: correct })}</p>
    </div>
  )
}
