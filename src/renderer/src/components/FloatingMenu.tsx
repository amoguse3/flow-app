import { useEffect, useState, type ReactElement } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

export type MenuAction = 'chat' | 'tasks' | 'games' | 'courses' | 'focus' | 'teacher' | 'achievements' | 'companion' | 'memory' | 'settings'

// ─── pixel SVG icons ───────────────────────────────────────────────────────────
const ICONS: Record<MenuAction, ReactElement> = {
  tasks: (
    // pixel checklist
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="2" y="9" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="2" y="15" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="9" y="4" width="10" height="2" rx="1" fill="currentColor"/>
      <rect x="9" y="10" width="8" height="2" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="9" y="16" width="6" height="2" rx="1" fill="currentColor" opacity="0.35"/>
      <path d="M3 5 L4.5 6.5 L6 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  chat: (
    // pixel speech rune — two stacked bars + dot
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2"  y="2"  width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <rect x="2"  y="16" width="6"  height="4"  rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="6"  y="7"  width="10" height="2"  rx="1" fill="currentColor"/>
      <rect x="6"  y="11" width="6"  height="2"  rx="1" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
  games: (
    // pixel controller / crossed swords
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="2"  width="2" height="14" rx="1" fill="currentColor"/>
      <rect x="2"  y="10" width="14" height="2" rx="1" fill="currentColor"/>
      <rect x="14" y="6"  width="2" height="2"  fill="currentColor" opacity="0.6"/>
      <rect x="6"  y="14" width="2" height="2"  fill="currentColor" opacity="0.6"/>
      <rect x="16" y="16" width="4" height="4"  rx="1" fill="currentColor" opacity="0.4"/>
      <rect x="2"  y="2"  width="4" height="4"  rx="1" fill="currentColor" opacity="0.4"/>
    </svg>
  ),
  courses: (
    // pixel tree — trunk + diamond crown
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9"  y="14" width="4"  height="6"  rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="5"  y="9"  width="12" height="6"  rx="1" fill="currentColor"/>
      <rect x="7"  y="5"  width="8"  height="5"  rx="1" fill="currentColor"/>
      <rect x="9"  y="2"  width="4"  height="4"  rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="2"  y="18" width="18" height="2"  rx="1" fill="currentColor" opacity="0.3"/>
    </svg>
  ),
  focus: (
    // pixel eye / crosshair
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="2"  width="2" height="4" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="10" y="16" width="2" height="4" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="2"  y="10" width="4" height="2" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="16" y="10" width="4" height="2" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="6"  y="6"  width="10" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <rect x="9"  y="9"  width="4"  height="4"  rx="1" fill="currentColor"/>
    </svg>
  ),
  teacher: (
    // pixel graduation cap / teacher
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="11,2 2,8 11,14 20,8" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.3"/>
      <rect x="10" y="8" width="2" height="8" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="4" y="12" width="14" height="2" rx="1" fill="currentColor" opacity="0.4"/>
      <path d="M4 12 C4 16 18 16 18 12" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5"/>
      <rect x="18" y="8" width="2" height="6" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="17" y="14" width="4" height="2" rx="1" fill="currentColor" opacity="0.3"/>
    </svg>
  ),
  settings: (
    // pixel rune gear — diamond + orbiting dots
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9"  y="9"  width="4" height="4" rx="1" fill="currentColor"/>
      <rect x="9"  y="2"  width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="9"  y="16" width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="2"  y="9"  width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="16" y="9"  width="4" height="4" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="4"  y="4"  width="2" height="2" rx="0.5" fill="currentColor" opacity="0.4"/>
      <rect x="16" y="4"  width="2" height="2" rx="0.5" fill="currentColor" opacity="0.4"/>
      <rect x="4"  y="16" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.4"/>
      <rect x="16" y="16" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.4"/>
    </svg>
  ),
  achievements: (
    // pixel trophy
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="3" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="9" y="9" width="4" height="4" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="6" y="13" width="10" height="2" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="5" y="15" width="12" height="3" rx="1" fill="currentColor" opacity="0.4"/>
      <rect x="4" y="4" width="2" height="3" rx="1" fill="currentColor" opacity="0.45"/>
      <rect x="16" y="4" width="2" height="3" rx="1" fill="currentColor" opacity="0.45"/>
    </svg>
  ),
  companion: (
    // pixel presence — orbit + core + two companion dots
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1" fill="none"
        opacity="0.45" strokeDasharray="1.5 2"/>
      <circle cx="11" cy="11" r="3" fill="currentColor" opacity="0.85"/>
      <circle cx="3.5"  cy="11" r="1.4" fill="currentColor" opacity="0.7"/>
      <circle cx="18.5" cy="11" r="1.4" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  memory: (
    // pixel open book with layered pages
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2"  y="5"  width="8" height="13" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15"/>
      <rect x="12" y="5"  width="8" height="13" rx="1" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15"/>
      <rect x="4"  y="8"  width="4" height="1.2" fill="currentColor" opacity="0.65"/>
      <rect x="4"  y="11" width="4" height="1.2" fill="currentColor" opacity="0.45"/>
      <rect x="14" y="8"  width="4" height="1.2" fill="currentColor" opacity="0.65"/>
      <rect x="14" y="11" width="4" height="1.2" fill="currentColor" opacity="0.45"/>
      <rect x="10" y="3"  width="2" height="17" rx="0.5" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
}

const MENU_ITEMS: { id: MenuAction; labelKey: string }[] = [
  { id: 'tasks',    labelKey: 'menu.tasks'},
  { id: 'games',    labelKey: 'menu.games' },
  { id: 'focus',    labelKey: 'menu.focus'  },
  { id: 'teacher',  labelKey: 'menu.teacher'},
  { id: 'memory',    labelKey: 'menu.memory'},
  { id: 'achievements', labelKey: 'menu.achievements' },
  { id: 'settings', labelKey: 'menu.settings' },
]

// accent per item (gold / green / violet variants)
const ACCENTS: Record<MenuAction, { icon: string; border: string; glow: string; label: string }> = {
  chat:     { icon: 'rgba(232,197,106,0.82)', border: 'rgba(196,154,60,0.38)',  glow: 'rgba(196,154,60,0.18)',   label: 'rgba(232,197,106,0.72)' },
  tasks:    { icon: 'rgba(251,191,36,0.82)',  border: 'rgba(245,158,11,0.38)',  glow: 'rgba(245,158,11,0.18)',   label: 'rgba(251,191,36,0.72)'  },
  games:    { icon: 'rgba(180,160,240,0.82)', border: 'rgba(139,92,246,0.38)',  glow: 'rgba(139,92,246,0.18)',   label: 'rgba(180,160,240,0.72)' },
  courses:  { icon: 'rgba(46,184,122,0.82)',  border: 'rgba(46,184,122,0.38)',  glow: 'rgba(46,184,122,0.18)',   label: 'rgba(46,184,122,0.72)'  },
  focus:    { icon: 'rgba(232,197,106,0.82)', border: 'rgba(196,154,60,0.38)',  glow: 'rgba(196,154,60,0.18)',   label: 'rgba(232,197,106,0.72)' },
  teacher:  { icon: 'rgba(96,180,255,0.82)',  border: 'rgba(59,130,246,0.38)',  glow: 'rgba(59,130,246,0.18)',   label: 'rgba(96,180,255,0.72)'  },
  achievements: { icon: 'rgba(255,205,96,0.86)', border: 'rgba(245,158,11,0.38)', glow: 'rgba(245,158,11,0.2)', label: 'rgba(255,205,96,0.76)' },
  companion:{ icon: 'rgba(150,220,190,0.82)', border: 'rgba(80,180,140,0.38)',  glow: 'rgba(80,180,140,0.18)',   label: 'rgba(150,220,190,0.74)' },
  memory:   { icon: 'rgba(244,180,120,0.82)', border: 'rgba(217,119,6,0.38)',   glow: 'rgba(217,119,6,0.18)',    label: 'rgba(244,180,120,0.74)' },
  settings: { icon: 'rgba(196,154,60,0.55)',  border: 'rgba(196,154,60,0.22)',  glow: 'rgba(196,154,60,0.1)',    label: 'rgba(196,154,60,0.48)'  },
}

const PX = "'Press Start 2P', monospace"

const FLOATING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

@keyframes menuPop {
  from { opacity:0; transform: scale(0.4) translateY(8px); }
  to   { opacity:1; transform: scale(1)   translateY(0);   }
}
@keyframes orbPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(196,154,60,0); }
  50%      { box-shadow: 0 0 0 6px rgba(196,154,60,0.08); }
}
@keyframes backdropFadeIn {
  from { opacity:0; }
  to   { opacity:1; }
}
.aura-menu-item {
  transition: transform 0.3s cubic-bezier(.16,1,.3,1), opacity 0.3s ease;
}
.aura-menu-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(196,154,60,0.16) transparent;
}
`

interface Props {
  open: boolean
  onSelect: (action: MenuAction) => void
  onClose: () => void
}

export default function FloatingMenu({ open, onSelect, onClose }: Props) {
  const { t } = useLanguage()
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }))

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!open) return null

  const BASE_RADIUS = 160
  const BTN_W = 110
  const BTN_H = 90
  const baseContainerSize = BASE_RADIUS * 2 + Math.max(BTN_W, BTN_H) + 48
  const menuScale = Math.min((viewport.width - 32) / baseContainerSize, (viewport.height - 32) / baseContainerSize, 1)
  const useCompactLayout = viewport.width < 760 || viewport.height < 620 || menuScale < 0.78
  const radialSize = baseContainerSize * Math.max(menuScale, 0.58)
  const radialInnerScale = Math.max(menuScale, 0.58)
  const center = baseContainerSize / 2

  return (
    <>
      <style>{FLOATING_CSS}</style>

      {/* backdrop — scanline-style overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          overflow: 'auto',
          background: 'rgba(3,13,6,0.72)',
          backdropFilter: 'blur(6px)',
          animation: 'backdropFadeIn 0.2s ease',
          // scanline texture
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px),
            radial-gradient(ellipse at center, rgba(196,154,60,0.04) 0%, transparent 70%)
          `,
        }}
        onClick={onClose}
      >
        {useCompactLayout ? (
          <div
            className="aura-menu-scroll"
            style={{
              width: 'min(440px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              borderRadius: 18,
              padding: 18,
              background: 'rgba(4,14,8,0.9)',
              border: '1px solid rgba(196,154,60,0.16)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontFamily: PX,
              fontSize: 7,
              lineHeight: 1.9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(232,197,106,0.7)',
              marginBottom: 14,
              textAlign: 'center',
            }}>
              Quick Menu
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 12,
            }}>
              {MENU_ITEMS.map((item, i) => {
                const acc = ACCENTS[item.id]
                const isHovered = hoveredIdx === i

                return (
                  <button
                    key={item.id}
                    data-tutorial={`menu-${item.id}`}
                    onClick={() => onSelect(item.id)}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      minHeight: 108,
                      borderRadius: 14,
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      border: `1px solid ${isHovered ? acc.border : 'rgba(196,154,60,0.1)'}`,
                      background: isHovered ? 'rgba(18,28,22,0.96)' : 'rgba(7,18,12,0.88)',
                      boxShadow: isHovered ? `0 0 24px ${acc.glow}` : '0 10px 20px rgba(0,0,0,0.28)',
                      color: isHovered ? acc.icon : 'rgba(196,154,60,0.34)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.03)',
                    }}>
                      {ICONS[item.id]}
                    </div>
                    <span style={{
                      fontFamily: PX,
                      fontSize: 5,
                      lineHeight: 1.5,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: isHovered ? acc.label : 'rgba(232,197,106,0.5)',
                      textAlign: 'center',
                    }}>
                      {t(item.labelKey)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              width: radialSize,
              height: radialSize,
              flex: '0 0 auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: baseContainerSize,
                height: baseContainerSize,
                transform: `scale(${radialInnerScale})`,
                transformOrigin: 'top left',
              }}
            >
              {MENU_ITEMS.map((item, i) => {
                const angle = (i / MENU_ITEMS.length) * Math.PI * 2 - Math.PI / 2
                const x = Math.cos(angle) * BASE_RADIUS
                const y = Math.sin(angle) * BASE_RADIUS

                const isHovered = hoveredIdx === i
                const isShrunk = hoveredIdx !== null && hoveredIdx !== i
                const acc = ACCENTS[item.id]

                return (
                  <button
                    key={item.id}
                    data-tutorial={`menu-${item.id}`}
                    className="aura-menu-item"
                    onClick={() => onSelect(item.id)}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      position: 'absolute',
                      left: center + x - BTN_W / 2,
                      top: center + y - BTN_H / 2,
                      width: BTN_W,
                      height: BTN_H,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 6,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      animation: `menuPop 0.4s cubic-bezier(.16,1,.3,1) ${i * 0.055}s both`,
                      transform: isShrunk ? 'scale(0.72)' : isHovered ? 'scale(1.14)' : 'scale(1)',
                      transformOrigin: 'center center',
                      opacity: isShrunk ? 0.35 : 1,
                      zIndex: isHovered ? 10 : 1,
                    }}
                  >
                    <div style={{
                      width: 56, height: 56, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isHovered
                        ? `radial-gradient(circle at 38% 36%, ${acc.glow.replace('0.18','0.22')}, rgba(4,14,8,0.92))`
                        : 'rgba(4,14,8,0.88)',
                      border: `1px solid ${isHovered ? acc.border : 'rgba(196,154,60,0.1)'}`,
                      boxShadow: isHovered
                        ? `0 0 28px ${acc.glow}, 0 8px 24px rgba(0,0,0,0.5)`
                        : '0 4px 18px rgba(0,0,0,0.45)',
                      color: isHovered ? acc.icon : 'rgba(196,154,60,0.3)',
                      transition: 'all 0.28s cubic-bezier(.16,1,.3,1)',
                      flexShrink: 0,
                    }}>
                      {ICONS[item.id]}
                    </div>

                    <div style={{
                      width: BTN_W,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}>
                      <span style={{
                        fontFamily: PX, fontSize: 5, lineHeight: 1.4,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        color: isHovered ? acc.label : 'rgba(196,154,60,0.22)',
                        transition: 'color 0.28s ease',
                        textShadow: isHovered ? `0 0 12px ${acc.glow}` : 'none',
                        display: 'inline-block',
                        textAlign: 'center',
                      }}>
                        {t(item.labelKey)}
                      </span>
                    </div>
                  </button>
                )
              })}

              <svg
                width={baseContainerSize}
                height={baseContainerSize}
                viewBox={`0 0 ${baseContainerSize} ${baseContainerSize}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  pointerEvents: 'none',
                  opacity: 0.12,
                }}
              >
                <circle
                  cx={center}
                  cy={center}
                  r={152}
                  stroke="rgba(196,154,60,1)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                  fill="none"
                />
                <circle
                  cx={center}
                  cy={center}
                  r={80}
                  stroke="rgba(196,154,60,1)"
                  strokeWidth="0.5"
                  strokeDasharray="2 8"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </>
  )
}