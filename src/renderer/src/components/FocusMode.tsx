import { useState, useEffect, useRef, type ReactElement } from 'react'

// ─── design tokens ─────────────────────────────────────────────────────────────
const PX = "'Press Start 2P', monospace"
const C = {
  border:    'rgba(196,154,60,0.11)',
  borderStrong: 'rgba(196,154,60,0.26)',
  textMain:  'rgba(245,228,168,0.94)',
  textDim:   'rgba(196,154,60,0.48)',
  textGhost: 'rgba(196,154,60,0.30)',
  gold:      '#c49a3c',
  goldLight: '#e8c56a',
  green:     'rgba(46,184,122,0.88)',
}

const FOCUS_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

@keyframes auraPulse {
  0%,100% { box-shadow: 0 0 14px rgba(196,154,60,0.24); }
  50%      { box-shadow: 0 0 28px rgba(196,154,60,0.45), 0 0 50px rgba(196,154,60,0.12); }
}
@keyframes breathe {
  0%,100% { transform: scale(1);    opacity: 0.7; }
  50%      { transform: scale(1.05); opacity: 1;   }
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0);    }
}
@keyframes energyFlow {
  0%   { opacity:0.9; top:14px; }
  100% { opacity:0;   top:80%;  }
}
@keyframes nodeRing {
  0%,100% { transform:scale(1);   opacity:0.5; }
  50%     { transform:scale(1.8); opacity:0;   }
}
@keyframes xpPop {
  0%   { opacity:0; transform:scale(0.6) translateY(4px); }
  60%  { opacity:1; transform:scale(1.1) translateY(-2px); }
  100% { opacity:1; transform:scale(1)   translateY(0);    }
}

.aura-preset-card {
  transition: all 0.25s cubic-bezier(.16,1,.3,1);
  cursor: pointer;
}
.aura-preset-card:hover {
  transform: translateY(-2px) scale(1.02) !important;
}
.aura-preset-card:active {
  transform: scale(0.97) !important;
}
.aura-control-btn { transition: all 0.25s cubic-bezier(.16,1,.3,1); }
.aura-control-btn:hover { transform: scale(1.1); }
.aura-back-btn { transition: color 0.2s; }
.aura-back-btn:hover { color: rgba(232,197,106,0.58) !important; }
.aura-stop-btn { transition: color 0.2s; }
.aura-stop-btn:hover { color: rgba(239,68,68,0.8) !important; }

/* thin gold scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(196,154,60,0.1); border-radius: 4px; }
`

// ─── pixel SVG icons for presets ───────────────────────────────────────────────
const PRESET_ICONS: Record<string, ReactElement> = {
  '🧠': (
    <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
      <rect x="6"  y="2"  width="10" height="8"  rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <rect x="2"  y="8"  width="4"  height="6"  rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="16" y="8"  width="4"  height="6"  rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="6"  y="10" width="10" height="8"  rx="2" fill="currentColor" opacity="0.25"/>
      <rect x="9"  y="14" width="4"  height="6"  rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  '⚡': (
    <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
      <path d="M13 2 L5 13 L10 13 L9 20 L17 9 L12 9 Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.3" strokeLinejoin="round"/>
    </svg>
  ),
  '🌊': (
    <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
      <rect x="2"  y="6"  width="4" height="4" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="6"  y="4"  width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="10" y="6"  width="4" height="4" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="14" y="4"  width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="2"  y="13" width="4" height="4" rx="1" fill="currentColor" opacity="0.35"/>
      <rect x="6"  y="11" width="4" height="4" rx="1" fill="currentColor" opacity="0.55"/>
      <rect x="10" y="13" width="4" height="4" rx="1" fill="currentColor" opacity="0.35"/>
      <rect x="14" y="11" width="4" height="4" rx="1" fill="currentColor" opacity="0.55"/>
    </svg>
  ),
  '🏃': (
    <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
      <rect x="9"  y="2"  width="4"  height="4"  rx="2" fill="currentColor"/>
      <rect x="7"  y="6"  width="8"  height="5"  rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="3"  y="9"  width="5"  height="2"  rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="11" y="8"  width="2"  height="5"  rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="6"  y="11" width="3"  height="7"  rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="11" y="13" width="3"  height="7"  rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="3"  y="17" width="4"  height="2"  rx="1" fill="currentColor" opacity="0.4"/>
    </svg>
  ),
}

// ─── pixel SVG: pause / play / stop ───────────────────────────────────────────
const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <rect x="2" y="1" width="4" height="12" rx="1"/>
    <rect x="8" y="1" width="4" height="12" rx="1"/>
  </svg>
)
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <path d="M3 1 L13 7 L3 13 Z"/>
  </svg>
)
const StopIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
    <rect x="1" y="1" width="9" height="9" rx="1"/>
  </svg>
)

interface Props {
  onClose: () => void
  speak?: (text: string) => void
}

type FocusPreset = {
  name: string
  icon: string
  workMin: number
  breakMin: number
  sessions: number
  ambient: string
}

const PRESETS: FocusPreset[] = [
  { name: 'Deep Work',    icon: '🧠', workMin: 50, breakMin: 10, sessions: 3, ambient: '#8b5cf6' },
  { name: 'Sprint',       icon: '⚡', workMin: 25, breakMin:  5, sessions: 4, ambient: '#ef4444' },
  { name: 'Gentle Flow',  icon: '🌊', workMin: 15, breakMin:  5, sessions: 6, ambient: '#3b82f6' },
  { name: 'Marathon',     icon: '🏃', workMin: 90, breakMin: 15, sessions: 2, ambient: '#d97706' },
]

// ─── pixel divider ─────────────────────────────────────────────────────────────
function PixelDivider() {
  return (
    <div style={{
      height: 1, margin: '14px 0',
      background: 'repeating-linear-gradient(90deg,rgba(196,154,60,0.15) 0,rgba(196,154,60,0.15) 4px,transparent 4px,transparent 8px)',
    }} />
  )
}

export default function FocusMode({ onClose, speak }: Props) {
  const [preset,         setPreset]         = useState<FocusPreset | null>(null)
  const [phase,          setPhase]          = useState<'work' | 'break'>('work')
  const [session,        setSession]        = useState(1)
  const [timeLeft,       setTimeLeft]       = useState(0)
  const [running,        setRunning]        = useState(false)
  const [paused,         setPaused]         = useState(false)
  const [totalFocusTime, setTotalFocusTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!running || paused) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handlePhaseEnd(); return 0 }
        if (phase === 'work') setTotalFocusTime(f => f + 1)
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running, paused, phase])

  const handlePhaseEnd = () => {
    if (!preset) return
    if (phase === 'work') {
      if (session >= preset.sessions) {
        speak?.('Congrats! You finished all sessions. You are a champion.')
        setRunning(false)
        window.aura.motivation.addXP(25)
        return
      }
      speak?.('Break time! You deserve a short rest.')
      setPhase('break')
      setTimeLeft(preset.breakMin * 60)
    } else {
      speak?.('Let\'s get to work! Session starting.')
      setPhase('work')
      setSession(s => s + 1)
      setTimeLeft(preset.workMin * 60)
    }
  }

  const startFocus = (p: FocusPreset) => {
    setPreset(p)
    setPhase('work')
    setSession(1)
    setTimeLeft(p.workMin * 60)
    setRunning(true)
    setPaused(false)
    setTotalFocusTime(0)
    speak?.(`Focus mode activated. ${p.name}. ${p.workMin} minutes of concentration.`)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // ── PRESET SELECTION ──────────────────────────────────────────────────────────
  if (!preset || !running) {
    return (
      <>
        <style>{FOCUS_CSS}</style>
        <div data-tutorial="focus-mode-root" style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24,
          background: 'rgba(3,13,6,0.96)',
          backdropFilter: 'blur(24px)',
          fontFamily: PX,
        }}>

          {/* completion banner */}
          {totalFocusTime > 0 && (
            <div style={{
              marginBottom: 24, textAlign: 'center',
              animation: 'fadeUp 0.5s cubic-bezier(.16,1,.3,1)',
            }}>
              {/* trophy node */}
              <div style={{
                width: 56, height: 56, borderRadius: 10, margin: '0 auto 14px',
                background: 'radial-gradient(circle at 40% 38%, rgba(46,184,122,0.48), rgba(13,61,46,0.34))',
                border: '1px solid rgba(46,184,122,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, boxShadow: '0 0 28px rgba(46,184,122,0.22)',
                animation: 'auraPulse 3s ease-in-out infinite',
              }}>🏆</div>
              <div style={{ fontFamily: PX, fontSize: 9, color: C.textMain, marginBottom: 8, lineHeight: 2 }}>
                Session complete!
              </div>
              <div style={{ fontFamily: PX, fontSize: 6, color: C.textGhost, marginBottom: 6, lineHeight: 2 }}>
                {Math.floor(totalFocusTime / 60)} minutes of pure focus
              </div>
              <div style={{
                display: 'inline-block',
                fontFamily: PX, fontSize: 6, lineHeight: 2,
                padding: '4px 12px', borderRadius: 5,
                background: 'rgba(46,184,122,0.1)',
                border: '1px solid rgba(46,184,122,0.24)',
                color: 'rgba(46,184,122,0.82)',
                animation: 'xpPop 0.5s cubic-bezier(.16,1,.3,1) 0.1s both',
              }}>
                +25 XP
              </div>
              <PixelDivider />
            </div>
          )}

          {/* header */}
          <div style={{ fontFamily: PX, fontSize: 11, color: C.textMain, marginBottom: 8, lineHeight: 2, textShadow: '0 0 26px rgba(196,154,60,0.25)', letterSpacing: '0.04em' }}>
            Focus Mode
          </div>
          <div style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, marginBottom: 24, lineHeight: 2, letterSpacing: '0.12em' }}>
            Choose your focus style
          </div>

          {/* preset tree */}
          <div style={{ position: 'relative', paddingLeft: 46, width: '100%', maxWidth: 340, marginBottom: 24 }}>
            {/* trunk */}
            <div style={{
              position: 'absolute', left: 17, top: 14, bottom: 20, width: 2,
              background: 'linear-gradient(180deg, rgba(196,154,60,0.52) 0%, rgba(196,154,60,0.08) 100%)',
              borderRadius: 2,
            }} />
            {/* energy flow */}
            <div style={{
              position: 'absolute', left: 17, top: 14, width: 2, height: 44,
              background: 'linear-gradient(180deg, rgba(232,197,106,0.76), transparent)',
              borderRadius: 2, animation: 'energyFlow 3s ease-in-out infinite',
            }} />

            {PRESETS.map((p, i) => (
              <div key={p.name} style={{
                position: 'relative', marginBottom: 8,
                animation: `fadeUp 0.4s cubic-bezier(.16,1,.3,1) ${i * 55}ms both`,
              }}>
                {/* node dot */}
                <div style={{
                  position: 'absolute', left: -36, top: 16,
                  width: 12, height: 12, borderRadius: 3,
                  border: `2px solid ${p.ambient}80`,
                  background: `${p.ambient}22`,
                  boxShadow: `0 0 10px ${p.ambient}30`,
                  zIndex: 2,
                }} />

                <button
                  className="aura-preset-card"
                  onClick={() => startFocus(p)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(4,14,8,0.65)',
                    border: `1px solid ${p.ambient}22`,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  {/* icon box */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${p.ambient}18`,
                    border: `1px solid ${p.ambient}30`,
                    color: p.ambient,
                    boxShadow: `0 0 12px ${p.ambient}20`,
                  }}>
                    {PRESET_ICONS[p.icon]}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: PX, fontSize: 7, color: C.textMain, lineHeight: 2 }}>
                      {p.name}
                    </div>
                    <div style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, marginTop: 4, lineHeight: 2 }}>
                      {p.workMin}m work · {p.breakMin}m break · ×{p.sessions}
                    </div>
                  </div>

                  <span style={{ fontFamily: PX, fontSize: 7, color: C.textGhost }}>▶</span>
                </button>
              </div>
            ))}

            {/* tree end diamond */}
            <div style={{
              position: 'absolute', left: 11, bottom: 6,
              width: 11, height: 11,
              background: 'rgba(196,154,60,0.1)', border: `1px solid ${C.border}`,
              transform: 'rotate(45deg)', borderRadius: 2,
            }} />
          </div>

          {/* back */}
          <button
            className="aura-back-btn"
            onClick={onClose}
            style={{ fontFamily: PX, fontSize: 6, color: C.textGhost, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 2 }}
          >
            ← Back
          </button>
        </div>
      </>
    )
  }

  // ── ACTIVE SESSION ─────────────────────────────────────────────────────────────
  const total       = phase === 'work' ? preset.workMin * 60 : preset.breakMin * 60
  const progress    = ((total - timeLeft) / total) * 100
  const circumference = 2 * Math.PI * 70
  const phaseColor  = phase === 'work' ? preset.ambient : 'rgba(46,184,122,0.88)'

  return (
    <>
      <style>{FOCUS_CSS}</style>
      <div data-tutorial="focus-mode-root" style={{
        position: 'absolute', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: PX,
        background: phase === 'work'
          ? `radial-gradient(circle at 50% 50%, ${preset.ambient}0a 0%, #030d06 70%)`
          : 'radial-gradient(circle at 50% 50%, rgba(46,184,122,0.06) 0%, #030d06 70%)',
        backgroundColor: 'rgba(3,13,6,0.96)',
        backdropFilter: 'blur(24px)',
      }}>

        {/* session badge (course-badge style) */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', borderRadius: 8, marginBottom: 24,
          background: `${phaseColor}0d`,
          border: `1px solid ${phaseColor}22`,
          animation: 'fadeUp 0.4s cubic-bezier(.16,1,.3,1)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${phaseColor}1a`,
            border: `1px solid ${phaseColor}30`,
            color: phaseColor,
            boxShadow: `0 0 10px ${phaseColor}22`,
          }}>
            {PRESET_ICONS[preset.icon]}
          </div>
          <div>
            <div style={{ fontFamily: PX, fontSize: 7, color: C.textMain, lineHeight: 2 }}>
              {preset.name}
            </div>
            <div style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, lineHeight: 2 }}>
              Session {session}/{preset.sessions} · {phase === 'work' ? 'FOCUS' : 'BREAK'}
            </div>
          </div>
        </div>

        {/* circular timer */}
        <div style={{ position: 'relative', marginBottom: 22 }}>
          <svg width="180" height="180" viewBox="0 0 180 180">
            {/* track */}
            <circle cx="90" cy="90" r="70" fill="none"
              stroke="rgba(196,154,60,0.08)" strokeWidth="5"/>
            {/* pixel dashes on track */}
            <circle cx="90" cy="90" r="70" fill="none"
              stroke="rgba(196,154,60,0.04)" strokeWidth="5"
              strokeDasharray="4 8"/>
            {/* progress arc */}
            <circle cx="90" cy="90" r="70" fill="none"
              stroke={phaseColor}
              strokeWidth="5"
              strokeLinecap="square"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              transform="rotate(-90 90 90)"
              style={{
                transition: 'stroke-dashoffset 1s linear',
                filter: `drop-shadow(0 0 7px ${phaseColor}66)`,
              }}
            />
          </svg>

          {/* center readout */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: PX, fontSize: 22,
              color: phaseColor, lineHeight: 1.4,
              textShadow: `0 0 20px ${phaseColor}55`,
              letterSpacing: '0.04em',
            }}>
              {formatTime(timeLeft)}
            </div>
            <div style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, marginTop: 8, lineHeight: 2 }}>
              {phase === 'work' ? 'Focus' : 'Relax'}
            </div>
          </div>
        </div>

        {/* body-doubling bar (cooldown-bar style) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', borderRadius: 8, marginBottom: 22,
          background: 'rgba(4,14,8,0.65)',
          border: C.border,
          animation: 'breathe 4s ease-in-out infinite',
        }}>
          {/* pulsing dot */}
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: phaseColor,
            boxShadow: `0 0 8px ${phaseColor}`,
            animation: 'auraPulse 2.5s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: PX, fontSize: 5, color: C.textGhost, lineHeight: 2 }}>
            Wispucci AI is here with you
          </span>
          <div style={{ marginLeft: 'auto', fontFamily: PX, fontSize: 5, color: C.textDim }}>
            {Math.floor(totalFocusTime / 60)}m {totalFocusTime % 60}s
          </div>
        </div>

        {/* controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* pause / resume (module-num style) */}
          <button
            className="aura-control-btn"
            onClick={() => setPaused(!paused)}
            style={{
              width: 48, height: 48, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: paused ? `${preset.ambient}1a` : 'rgba(4,14,8,0.65)',
              border: `1px solid ${paused ? `${preset.ambient}44` : C.border}`,
              boxShadow: paused ? `0 0 18px ${preset.ambient}22` : 'none',
              color: paused ? preset.ambient : C.textDim,
              cursor: 'pointer',
            }}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>

          {/* stop */}
          <button
            className="aura-control-btn aura-stop-btn"
            onClick={() => { setRunning(false); onClose() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 8,
              background: 'rgba(4,14,8,0.65)',
              border: C.border,
              color: C.textGhost,
              cursor: 'pointer',
              fontFamily: PX, fontSize: 6, lineHeight: 2,
            }}>
            <StopIcon />
            Stop
          </button>
        </div>

      </div>
    </>
  )
}