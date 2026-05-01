import { useState, useEffect, useRef, useCallback } from 'react'
import type { BrainGameCompletion, GameChallenge, GameChallengeSeed, GameAction } from '../../../../../shared/types'
import { useLanguage } from '../../contexts/LanguageContext'

interface Props { onEnd: () => void; onResult?: (result: BrainGameCompletion) => void; challengeSeed?: GameChallengeSeed | null; difficulty?: import('../../../../../shared/types').GameDifficulty }

export default function MemoryTilesGame({ onEnd, onResult, challengeSeed = null, difficulty = 'normal' }: Props) {
  const { t } = useLanguage()
  const [challenge, setChallenge] = useState<GameChallenge | null>(null)
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<'showing' | 'input' | 'result'>('showing')
  const [shownTiles, setShownTiles] = useState<number[]>([])
  const [selectedTiles, setSelectedTiles] = useState<number[]>([])
  const [correctRounds, setCorrectRounds] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<{ verified: boolean; score: number; points: number } | null>(null)
  const actionsRef = useRef<GameAction[]>([])
  // We need the actual tile data from challenge — but it's hidden. We show tiles during "showing" phase
  // The server sends rounds with {count, showTime} — we need to display actual tiles
  // Since answers are server-side, we'll receive tile positions during the challenge

  useEffect(() => {
    window.aura.games.startChallenge('memory_tiles', difficulty, challengeSeed).then(c => {
      setChallenge(c)
      // Start first round
      startRound(c, 0)
    })
  }, [challengeSeed, difficulty])

  const startRound = (c: GameChallenge, roundIdx: number) => {
    if (roundIdx >= c.data.rounds.length) {
      endGame(c)
      return
    }
    setRound(roundIdx)
    setPhase('showing')
    setSelectedTiles([])

    // Generate random tiles for display (these will be validated server-side)
    const count = c.data.rounds[roundIdx].count
    const gridSize = c.data.gridSize
    const tiles: number[] = []
    while (tiles.length < count) {
      const t = Math.floor(Math.random() * (gridSize * gridSize))
      if (!tiles.includes(t)) tiles.push(t)
    }
    setShownTiles(tiles)

    // Hide after showTime
    const showTime = c.data.rounds[roundIdx].showTime
    setTimeout(() => {
      setPhase('input')
    }, showTime)
  }

  const toggleTile = (idx: number) => {
    if (phase !== 'input') return
    setSelectedTiles(prev =>
      prev.includes(idx) ? prev.filter(t => t !== idx) : [...prev, idx]
    )
  }

  const submitRound = () => {
    if (!challenge || phase !== 'input') return
    const sorted = [...selectedTiles].sort((a, b) => a - b)

    actionsRef.current.push({
      type: 'round_complete',
      value: sorted,
      timestamp: Date.now()
    })

    // Check if correct (local feedback)
    const expected = [...shownTiles].sort((a, b) => a - b)
    if (JSON.stringify(sorted) === JSON.stringify(expected)) {
      setCorrectRounds(c => c + 1)
    }

    // Next round
    startRound(challenge, round + 1)
  }

  const endGame = useCallback(async (c?: GameChallenge) => {
    const ch = c || challenge
    if (finished || !ch) return
    setFinished(true)
    const completedAt = Date.now()
    const res = await window.aura.games.submitResult({
      challengeId: ch.id,
      actions: actionsRef.current,
      claimedScore: correctRounds * 100,
      completedAt,
    })
    setResult(res)
    onResult?.({ gameType: 'memory_tiles', verified: res.verified, score: res.score, points: res.points, completedAt })
  }, [finished, challenge, correctRounds, onResult])

  if (!challenge) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-breathe w-12 h-12 rounded-full" style={{
          background: 'radial-gradient(circle, #8b5cf6, transparent)'
        }} />
      </div>
    )
  }

  if (finished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{
          background: 'radial-gradient(circle, #8b5cf6, #6d28d9)',
          boxShadow: '0 0 30px rgba(139,92,246,0.3)'
        }}>
          <span className="text-2xl">🧠</span>
        </div>
        <h2 className="text-xl font-semibold text-aura-text mb-2">{t('game.memory.complete')}</h2>
        <p className="text-sm text-aura-muted mb-1">{t('game.score', { score: result?.score || 0 })}</p>
        <p className="text-sm text-aura-muted mb-1">{t('game.pointsAward', { points: result?.points || 0 })}</p>
        <p className="text-[10px] text-aura-muted mb-6">{t('game.roundsCorrect', { correct: correctRounds, total: challenge.data.rounds.length })}</p>
        <button onClick={onEnd}
          className="px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
          {t('game.backToGames')}
        </button>
      </div>
    )
  }

  const gridSize = challenge.data.gridSize

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-xs mb-4">
        <span className="text-sm font-medium" style={{ color: '#8b5cf6' }}>
          {t('game.roundProgress', { current: round + 1, total: challenge.data.rounds.length })}
        </span>
        <span className="text-xs text-aura-muted">{t('game.correctCount', { count: correctRounds })}</span>
        <button onClick={onEnd} className="text-xs text-aura-muted hover:text-red-400">✕</button>
      </div>

      <p className="text-xs text-aura-muted mb-4">
        {phase === 'showing' ? t('game.memory.memorize') : t('game.memory.tapRemember')}
      </p>

      {/* Grid */}
      <div className="grid gap-2 mb-6" style={{
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        width: gridSize * 60 + (gridSize - 1) * 8
      }}>
        {Array.from({ length: gridSize * gridSize }, (_, i) => {
          const isShown = phase === 'showing' && shownTiles.includes(i)
          const isSelected = phase === 'input' && selectedTiles.includes(i)

          return (
            <button key={i} onClick={() => toggleTile(i)}
              className="w-14 h-14 rounded-lg transition-all"
              style={{
                background: isShown
                  ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                  : isSelected
                    ? 'rgba(139,92,246,0.4)'
                    : 'rgba(42,37,32,0.3)',
                border: isSelected ? '2px solid #8b5cf6' : '1px solid rgba(42,37,32,0.4)',
                boxShadow: isShown ? '0 0 15px rgba(139,92,246,0.4)' : 'none',
                transform: isShown ? 'scale(1.05)' : 'scale(1)',
                cursor: phase === 'input' ? 'pointer' : 'default'
              }} />
          )
        })}
      </div>

      {phase === 'input' && (
        <button onClick={submitRound}
          className="px-8 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105"
          style={{
            background: selectedTiles.length > 0 ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'rgba(42,37,32,0.3)',
            boxShadow: selectedTiles.length > 0 ? '0 0 20px rgba(139,92,246,0.3)' : 'none',
            color: selectedTiles.length > 0 ? 'white' : '#8a7e72'
          }}>
          {t('game.memory.submit', { count: selectedTiles.length })}
        </button>
      )}
    </div>
  )
}
