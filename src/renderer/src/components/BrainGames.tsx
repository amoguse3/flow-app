import { useState, useEffect } from 'react'
import type { BrainGameCompletion, GameChallengeSeed, GameType, GameDifficulty, GamePoints, DailyLeaderboard } from '../../../../shared/types'
import MathSpeedGame from './games/MathSpeedGame'
import MemoryTilesGame from './games/MemoryTilesGame'
import PatternMatchGame from './games/PatternMatchGame'
import ReactionTimeGame from './games/ReactionTimeGame'
import WordScrambleGame from './games/WordScrambleGame'
import ColorStroopGame from './games/ColorStroopGame'
import Leaderboard from './games/Leaderboard'
import { useLanguage } from '../contexts/LanguageContext'

// ─── design tokens (mirrors aura_courses_v4.html) ────────────────────────────
const C = {
  ink:          '#030d06',
  gold:         '#c49a3c',
  goldLight:    '#e8c56a',
  goldPale:     '#f5e4a8',
  border:       'rgba(196,154,60,0.11)',
  borderStrong: 'rgba(196,154,60,0.26)',
  textMain:     'rgba(245,228,168,0.94)',
  textDim:      'rgba(196,154,60,0.48)',
  textGhost:    'rgba(196,154,60,0.30)',
  green:        'rgba(46,184,122,0.94)',
  greenBorder:  'rgba(46,184,122,0.24)',
}
const PX = "'Press Start 2P', monospace"

// ─── keyframe style tag ───────────────────────────────────────────────────────
const AURA_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

@keyframes auraPulse {
  0%,100% { box-shadow: 0 0 14px rgba(196,154,60,0.24); }
  50%      { box-shadow: 0 0 28px rgba(196,154,60,0.45), 0 0 50px rgba(196,154,60,0.12); }
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes slideIn {
  from { opacity:0; transform:translateX(-8px); }
  to   { opacity:1; transform:translateX(0); }
}
@keyframes energyFlow {
  0%   { top: 14px; opacity: 0.9; }
  100% { top: 80%;  opacity: 0;   }
}
@keyframes nodeRing {
  0%,100% { transform: scale(1);   opacity: 0.5; }
  50%     { transform: scale(1.8); opacity: 0;   }
}
@keyframes branchOpen {
  from { opacity:0; max-height:0;   transform:translateY(-4px); }
  to   { opacity:1; max-height:700px; transform:translateY(0); }
}
@keyframes leafIn {
  from { opacity:0; transform:translateY(-3px); }
  to   { opacity:1; transform:translateY(0); }
}
.aura-game-card:hover {
  background: rgba(196,154,60,0.055) !important;
  border-color: rgba(196,154,60,0.18) !important;
  transform: translateX(2px);
}
.aura-game-card { transition: all 0.25s cubic-bezier(.16,1,.3,1); }
.aura-leaf-btn:hover {
  background: rgba(196,154,60,0.045) !important;
  border-color: rgba(196,154,60,0.1) !important;
  color: rgba(245,228,168,0.84) !important;
}
.aura-chip-btn:hover {
  border-color: rgba(196,154,60,0.22) !important;
  color: rgba(232,197,106,0.54) !important;
}
.aura-redeem-btn:hover {
  border-color: rgba(232,197,106,0.42) !important;
  box-shadow: 0 0 28px rgba(196,154,60,0.16) !important;
  transform: translateY(-1px);
}
.aura-create-btn:hover {
  border-color: rgba(232,197,106,0.4) !important;
  box-shadow: 0 0 28px rgba(196,154,60,0.16) !important;
  transform: translateY(-1px);
}
`

// ─── game definitions (unchanged) ─────────────────────────────────────────────
const GAMES: Array<{
  type: GameType
  name: string
  icon: string
  description: string
  category: 'logic' | 'memory' | 'attention' | 'speed'
  color: string
}> = [
  { type: 'math_speed',    name: 'Math Speed',    icon: '🧮', description: 'Solve math problems before time runs out',    category: 'logic',     color: '#d97706' },
  { type: 'memory_tiles',  name: 'Memory Tiles',  icon: '🧠', description: 'Remember and repeat tile patterns',          category: 'memory',    color: '#8b5cf6' },
  { type: 'pattern_match', name: 'Pattern Match', icon: '🔢', description: 'Find the next number in the sequence',        category: 'logic',     color: '#3b82f6' },
  { type: 'reaction_time', name: 'Reaction Time', icon: '⚡', description: 'Click as fast as possible when you see the signal', category: 'speed', color: '#ef4444' },
  { type: 'word_scramble', name: 'Word Scramble', icon: '🔤', description: 'Unscramble the hidden words',                 category: 'attention', color: '#10b981' },
  { type: 'color_stroop',  name: 'Color Stroop',  icon: '🎨', description: 'Name the color, not the word',               category: 'attention', color: '#f97316' },
]

// ─── pixel divider ─────────────────────────────────────────────────────────────
function PixelDivider() {
  return (
    <div style={{
      height: 1,
      background: 'repeating-linear-gradient(90deg,rgba(196,154,60,0.15) 0,rgba(196,154,60,0.15) 4px,transparent 4px,transparent 8px)',
      margin: '8px 4px',
    }} />
  )
}

// ─── section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: PX, fontSize: 5, letterSpacing: '0.2em',
      textTransform: 'uppercase', color: C.textGhost,
      padding: '14px 6px 8px', lineHeight: 2,
    }}>
      {children}
    </div>
  )
}

// ─── main component ────────────────────────────────────────────────────────────
interface Props {
  onBack?: () => void
  initialGame?: GameType | null
  initialSeed?: GameChallengeSeed | null
  onGameComplete?: (result: BrainGameCompletion) => void
}

export default function BrainGames({ onBack, initialGame = null, initialSeed = null, onGameComplete }: Props) {
  const { t } = useLanguage()
  const [activeGame,     setActiveGame]     = useState<GameType | null>(null)
  const [difficulty,     setDifficulty]     = useState<GameDifficulty>('normal')
  const [showLeaderboard,setShowLeaderboard]= useState(false)
  const [points,         setPoints]         = useState<GamePoints | null>(null)
  const [leaderboard,    setLeaderboard]    = useState<DailyLeaderboard[]>([])

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    if (!initialGame) return
    setActiveGame(initialGame)
  }, [initialGame])

  const loadData = async () => {
    const [pts, lb] = await Promise.all([
      window.aura.games.getPoints(),
      window.aura.games.getLeaderboard(7),
    ])
    setPoints(pts)
    setLeaderboard(lb)
  }

  const handleGameEnd = () => {
    setActiveGame(null)
    loadData()
  }

  // ── passthrough views (logic unchanged) ──────────────────────────────────────
  if (showLeaderboard) {
    return (
      <Leaderboard
        data={leaderboard}
        points={points}
        onBack={() => setShowLeaderboard(false)}
        onRedeem={async () => {
          const result = await window.aura.games.redeemProDay()
          if (result.success) loadData()
          return result
        }}
      />
    )
  }

  if (activeGame) {
    const GameComponent = {
      math_speed:    MathSpeedGame,
      memory_tiles:  MemoryTilesGame,
      pattern_match: PatternMatchGame,
      reaction_time: ReactionTimeGame,
      word_scramble: WordScrambleGame,
      color_stroop:  ColorStroopGame,
    }[activeGame]
    return <GameComponent onEnd={handleGameEnd} onResult={onGameComplete} challengeSeed={initialSeed} difficulty={difficulty} />
  }

  // ── derived values ────────────────────────────────────────────────────────────
  const todayPoints = points?.todayEarned ?? 0
  const totalPoints = points?.total       ?? 0
  const todayBest   = leaderboard[0]

  const difficultyOptions = [
    { d: 'normal' as GameDifficulty, label: '1×', color: '#6b7280' },
    { d: 'x2'     as GameDifficulty, label: '2×', color: '#3b82f6' },
    { d: 'x3'     as GameDifficulty, label: '3×', color: '#8b5cf6' },
    { d: 'x5'     as GameDifficulty, label: '5×', color: '#ef4444' },
  ]

  const categoryMeta = {
    logic:     { label: t('games.category.logic') },
    memory:    { label: t('games.category.memory') },
    attention: { label: t('games.category.attention') },
    speed:     { label: t('games.category.speed') },
  }

  const getGameName = (type: GameType) => {
    switch (type) {
      case 'math_speed':
        return t('games.mathSpeed')
      case 'memory_tiles':
        return t('games.memoryTiles')
      case 'pattern_match':
        return t('games.patternMatch')
      case 'reaction_time':
        return t('games.reactionTime')
      case 'word_scramble':
        return t('games.wordScramble')
      case 'color_stroop':
        return t('games.colorStroop')
      default:
        return type
    }
  }

  const getGameDescription = (type: GameType) => {
    switch (type) {
      case 'math_speed':
        return t('games.desc.mathSpeed')
      case 'memory_tiles':
        return t('games.desc.memoryTiles')
      case 'pattern_match':
        return t('games.desc.patternMatch')
      case 'reaction_time':
        return t('games.desc.reactionTime')
      case 'word_scramble':
        return t('games.desc.wordScramble')
      case 'color_stroop':
        return t('games.desc.colorStroop')
      default:
        return ''
    }
  }

  return (
    <>
      {/* inject keyframes + font once */}
      <style>{AURA_CSS}</style>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflowY: 'auto', position: 'relative', zIndex: 10,
        fontFamily: PX,
        /* thin gold scrollbar */
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,60,0.1) transparent',
      }}>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 18px 0' }}>

          {/* title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* brand orb */}
              <div style={{
                width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                background: 'radial-gradient(circle at 35% 35%, rgba(232,197,106,0.78), rgba(196,154,60,0.24))',
                border: '1px solid rgba(196,154,60,0.42)',
                boxShadow: '0 0 14px rgba(196,154,60,0.28)',
                animation: 'auraPulse 4s ease-in-out infinite',
              }} />
              <span style={{ fontFamily: PX, fontSize: 11, color: 'rgba(232,197,106,0.9)', letterSpacing: '0.08em', textShadow: '0 0 20px rgba(196,154,60,0.4)' }}>
                {t('games.title')}
              </span>
            </div>

            {/* leaderboard button */}
            <button
              onClick={() => setShowLeaderboard(true)}
              className="aura-create-btn"
              style={{
                fontFamily: PX, fontSize: 6,
                padding: '10px 14px', borderRadius: 8,
                border: `1px solid ${C.borderStrong}`,
                background: 'linear-gradient(135deg, rgba(196,154,60,0.1), rgba(13,61,46,0.18))',
                color: 'rgba(232,197,106,0.84)',
                cursor: 'pointer', letterSpacing: '0.05em',
                transition: 'all 0.28s ease', lineHeight: 2,
              }}>
              🏆 {t('games.leaderboard')}
            </button>
          </div>

          {/* ── POINTS BANNER (aura-score style) ───────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(196,154,60,0.04)',
            border: `1px solid ${C.border}`,
          }}>
            {/* orb */}
            <div style={{
              width: 40, height: 40, borderRadius: 6, flexShrink: 0,
              background: 'rgba(13,61,46,0.55)',
              border: '1px solid rgba(46,184,122,0.24)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, boxShadow: '0 0 14px rgba(46,184,122,0.2)',
              animation: 'auraPulse 3s ease-in-out infinite',
            }}>
              💎
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, marginBottom: 5, lineHeight: 2 }}>
                {t('games.pointsLabel')}
              </div>
              <div style={{ fontFamily: PX, fontSize: 5, color: C.textDim, lineHeight: 2 }}>
                {t('games.pointsSummary', { total: totalPoints, today: todayPoints })}
              </div>
            </div>

            {/* streak flame */}
            {totalPoints >= 100 && (
              <button
                onClick={async () => {
                  const result = await window.aura.games.redeemProDay()
                  if (result.success) loadData()
                }}
                className="aura-redeem-btn"
                style={{
                  fontFamily: PX, fontSize: 5, lineHeight: 2,
                  padding: '8px 12px', borderRadius: 7,
                  background: 'rgba(13,29,22,0.45)',
                  border: '1px solid rgba(46,184,122,0.22)',
                  color: 'rgba(46,184,122,0.76)',
                  cursor: 'pointer', transition: 'all 0.28s ease',
                }}>
                {t('games.redeem')}
              </button>
            )}
          </div>

          {/* ── DIFFICULTY (mentor-chip style) ─────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, lineHeight: 2 }}>{t('games.difficulty')}</span>
            {difficultyOptions.map(({ d, label, color }) => {
              const active = difficulty === d
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className="aura-chip-btn"
                  style={{
                    fontFamily: PX, fontSize: 6, lineHeight: 2,
                    padding: '6px 11px', borderRadius: 6,
                    cursor: 'pointer', transition: 'all 0.2s',
                    border: `1px solid ${active ? `${color}50` : C.border}`,
                    background: active ? `${color}20` : 'rgba(4,13,8,0.55)',
                    color: active ? color : C.textGhost,
                  }}>
                  {label}
                  {d !== 'normal' && (
                    <span style={{ fontSize: 5, opacity: 0.6, marginLeft: 4 }}>
                      ({d.replace('x', '')}× pts)
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── TODAY'S BEST (leaf-badge style) ────────────────────────────── */}
          {todayBest && todayBest.entries.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, lineHeight: 2 }}>{t('games.todayBest')}</span>
              {todayBest.entries.map((e, i) => (
                <span key={i} style={{
                  fontFamily: PX, fontSize: 5, lineHeight: 2,
                  padding: '3px 8px', borderRadius: 4,
                  background: 'rgba(196,154,60,0.06)',
                  border: `1px solid ${C.border}`,
                  color: 'rgba(196,154,60,0.52)',
                }}>
                  {GAMES.find(g => g.type === e.gameType)?.icon} {e.bestScore}
                </span>
              ))}
            </div>
          )}

          <PixelDivider />
        </div>

        {/* ── GAME TREE ─────────────────────────────────────────────────────── */}
        {(['logic', 'memory', 'attention', 'speed'] as const).map(category => {
          const categoryGames = GAMES.filter(g => g.category === category)

          return (
            <div key={category} style={{ padding: '0 18px', marginBottom: 6 }}>
              <SectionLabel>{categoryMeta[category].label}</SectionLabel>

              {/* tree trunk */}
              <div style={{ position: 'relative', paddingLeft: 50 }}>
                {/* vertical line */}
                <div style={{
                  position: 'absolute', left: 19, top: 14, bottom: 20, width: 2,
                  background: 'linear-gradient(180deg, rgba(196,154,60,0.52) 0%, rgba(196,154,60,0.28) 35%, rgba(196,154,60,0.12) 65%, rgba(196,154,60,0.04) 100%)',
                  borderRadius: 2,
                }} />
                {/* energy flow animation */}
                <div style={{
                  position: 'absolute', left: 19, top: 14, width: 2, height: 44,
                  background: 'linear-gradient(180deg, rgba(232,197,106,0.76), transparent)',
                  borderRadius: 2, animation: 'energyFlow 3s ease-in-out infinite',
                }} />

                {categoryGames.map((game, idx) => (
                  <div
                    key={game.type}
                    style={{
                      position: 'relative', marginBottom: 6,
                      animation: `slideIn 0.5s cubic-bezier(.16,1,.3,1) ${idx * 60}ms both`,
                    }}
                  >
                    {/* node dot */}
                    <div style={{
                      position: 'absolute', left: -38, top: 18,
                      width: 12, height: 12, borderRadius: 3,
                      border: '2px solid rgba(232,197,106,0.52)',
                      background: 'rgba(196,154,60,0.22)',
                      boxShadow: '0 0 14px rgba(196,154,60,0.32)',
                      zIndex: 2,
                    }} />

                    {/* game card (module-btn style) */}
                    <button
                      className="aura-game-card"
                      onClick={() => setActiveGame(game.type)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '14px 16px', borderRadius: 10,
                        background: 'rgba(4,14,8,0.6)',
                        border: `1px solid rgba(196,154,60,0.1)`,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 14,
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {/* icon box (module-num style) */}
                      <div style={{
                        width: 42, height: 42, borderRadius: 7, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                        background: `${game.color}18`,
                        border: `1px solid ${game.color}30`,
                        color: game.color,
                        boxShadow: `0 0 14px ${game.color}20`,
                      }}>
                        {game.icon}
                      </div>

                      {/* info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: PX, fontSize: 7, color: C.textMain, lineHeight: 2 }}>
                          {getGameName(game.type)}
                        </div>
                        <div style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, marginTop: 5, lineHeight: 2 }}>
                          {getGameDescription(game.type)}
                        </div>
                      </div>

                      {/* chevron */}
                      <span style={{ fontFamily: PX, fontSize: 8, color: C.textGhost, flexShrink: 0 }}>▶</span>

                      {/* gold left glow on hover (handled by CSS class) */}
                    </button>
                  </div>
                ))}

                {/* tree end diamond */}
                <div style={{ position: 'relative', paddingLeft: 0, paddingTop: 6, paddingBottom: 10 }}>
                  <div style={{
                    position: 'absolute', left: -37, top: 2,
                    width: 11, height: 11,
                    background: 'rgba(196,154,60,0.1)', border: '1px solid rgba(196,154,60,0.16)',
                    transform: 'rotate(45deg)', borderRadius: 2,
                  }} />
                </div>
              </div>

              <PixelDivider />
            </div>
          )
        })}

        {/* bottom padding */}
        <div style={{ height: 24 }} />
      </div>
    </>
  )
}