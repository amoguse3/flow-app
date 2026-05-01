import { useState, type CSSProperties } from 'react'
import type { AgeGroup, UserProfile } from '../../../../shared/types'
import { t, LANGUAGE_OPTIONS, type AppLanguage, DEFAULT_LANGUAGE } from '../../../../shared/i18n'
import DisplayTitle from './ui/DisplayTitle'
import GlassCard from './ui/GlassCard'
import Button from './ui/Button'
import { useTheme } from '../contexts/ThemeContext'
import type { ThemeId } from '../../../../shared/themes'

interface Props {
  onComplete: (profile: UserProfile) => void
}

type Step = 0 | 1 | 2 | 3

interface OrbSkin {
  id: ThemeId
  label: string
  hint: string
  gradient: string
  ring: string
  glow: string
}

const ORB_SKINS: OrbSkin[] = [
  {
    id: 'cosmos',
    label: 'Cosmos',
    hint: 'Aurora-violet, dreamy',
    gradient: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #C8A3FF 35%, #6B3DD4 75%, #1B0F30 100%)',
    ring: 'rgba(200,163,255,0.5)',
    glow: 'rgba(200,163,255,0.45)',
  },
  {
    id: 'sunset',
    label: 'Apus',
    hint: 'Warm ember, sunset',
    gradient: 'radial-gradient(circle at 35% 30%, #FFF1D6 0%, #FFB07A 35%, #C45A2A 75%, #2A0E14 100%)',
    ring: 'rgba(255,142,90,0.5)',
    glow: 'rgba(255,142,90,0.45)',
  },
  {
    id: 'sakura',
    label: 'Sakura',
    hint: 'Soft pink, calm',
    gradient: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #FFB6D9 35%, #C44A8E 75%, #2A0E1F 100%)',
    ring: 'rgba(255,182,217,0.5)',
    glow: 'rgba(255,182,217,0.45)',
  },
  {
    id: 'forest',
    label: 'Moss',
    hint: 'Grounded, focused',
    gradient: 'radial-gradient(circle at 35% 30%, #F2FFE8 0%, #9DE07A 35%, #3F7A2D 75%, #0A1810 100%)',
    ring: 'rgba(157,224,122,0.5)',
    glow: 'rgba(157,224,122,0.45)',
  },
]

const TOPIC_PRESETS = [
  { emoji: '🎯', label: 'English for TikTok' },
  { emoji: '⚛️', label: 'React from zero' },
  { emoji: '🐍', label: 'Python basics' },
  { emoji: '💸', label: 'Money & investing' },
  { emoji: '🎨', label: 'Drawing daily' },
  { emoji: '✨', label: 'Surprise me' },
]

const AGE_OPTIONS: Array<{ code: AgeGroup; label: string; emoji: string }> = [
  { code: 'under16', label: 'Under 16', emoji: '🌱' },
  { code: '16to25', label: '16 — 25', emoji: '🔥' },
  { code: '25plus', label: '25+', emoji: '🌌' },
  { code: 'unknown', label: 'Skip', emoji: '·' },
]

export default function OnboardingDesktop({ onComplete }: Props) {
  const { setThemeId } = useTheme()
  const [step, setStep] = useState<Step>(0)
  const [name, setName] = useState('')
  const [orbSkin, setOrbSkin] = useState<OrbSkin>(ORB_SKINS[0])
  const [hasADHD, setHasADHD] = useState<boolean | null>(null)
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('16to25')
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE)
  const [fade, setFade] = useState(true)

  const transition = (next: Step) => {
    setFade(false)
    window.setTimeout(() => {
      setStep(next)
      setFade(true)
    }, 240)
  }

  const finish = () => {
    setThemeId(orbSkin.id)
    const profile: UserProfile = {
      name: name.trim(),
      hasADHD: hasADHD ?? false,
      preferSoftMode: hasADHD ?? true,
      selectedModel: '',
      language,
      onboardingDone: true,
      onboardingQuickStartDone: false,
      ageGroup,
      dopamineRewards: [
        t('onboarding.defaultReward1', language),
        t('onboarding.defaultReward2', language),
        t('onboarding.defaultReward3', language),
      ],
    }
    onComplete(profile)
  }

  // ─── Hero orb (lives in the upper area on every step, scales between steps) ──
  const HeroOrb = ({ size, animate }: { size: number; animate?: boolean }) => (
    <div
      className={animate ? 'animate-breathe' : ''}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: orbSkin.gradient,
        boxShadow: `0 0 ${size * 0.6}px ${orbSkin.glow}, 0 0 ${size * 1.4}px ${orbSkin.ring}`,
        position: 'relative',
      } as CSSProperties}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: 'inset 0 0 30px rgba(255,255,255,0.18), inset 0 -20px 40px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )

  // ─── Background haze that picks up the chosen orb's tone ────────────────────
  const haze: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: `radial-gradient(ellipse at 50% 30%, ${orbSkin.glow} 0%, transparent 55%)`,
    opacity: 0.6,
    transition: 'background 0.5s ease',
  }

  return (
    <div className="relative z-20 h-full flex items-center justify-center px-6">
      <div style={haze} />

      {/* Step indicator */}
      <div
        className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2 z-30"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map(i => (
          <span
            key={i}
            style={{
              width: i === step ? 28 : 6,
              height: 6,
              borderRadius: 999,
              background:
                i <= step
                  ? 'linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.55))'
                  : 'rgba(255,255,255,0.16)',
              transition: 'all 0.45s cubic-bezier(.165,.84,.44,1)',
            }}
          />
        ))}
      </div>

      <div
        className="w-full max-w-md flex flex-col items-center"
        style={{
          opacity: fade ? 1 : 0,
          transform: fade ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.32s ease-out, transform 0.32s ease-out',
        }}
      >
        {/* ── Step 0 — name + hero ────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <div className="mb-8">
              <HeroOrb size={140} animate />
            </div>
            <DisplayTitle size="lg" gradient="aurora" tight className="text-center mb-3">
              Hey. Welcome.
            </DisplayTitle>
            <p className="text-center mb-8" style={{ color: 'var(--color-paper-2)', maxWidth: 320, fontSize: 14, lineHeight: 1.55 }}>
              I'm Wispucci. I'll teach you anything in 5-minute bites — designed for short attention.
            </p>
            <div className="w-full space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && transition(1)}
                placeholder="What should I call you?"
                autoFocus
                className="w-full px-5 py-3.5 text-center"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  fontSize: 15,
                  color: 'var(--color-paper-0)',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              <Button
                size="lg"
                block
                disabled={!name.trim()}
                onClick={() => name.trim() && transition(1)}
                trailing={<span style={{ fontSize: 16, lineHeight: 1 }}>→</span>}
              >
                Let's go
              </Button>
            </div>
            <p className="text-center mt-6" style={{ fontSize: 11, color: 'var(--color-paper-3)' }}>
              Everything runs locally. No one sees this.
            </p>
          </>
        )}

        {/* ── Step 1 — pick orb skin (theme) ──────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="mb-7">
              <HeroOrb size={104} animate />
            </div>
            <DisplayTitle size="md" gradient="aurora" tight className="text-center mb-2">
              Choose your aura.
            </DisplayTitle>
            <p className="text-center mb-7" style={{ color: 'var(--color-paper-2)', fontSize: 13.5 }}>
              Pick a vibe. Change anytime in settings.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              {ORB_SKINS.map(skin => {
                const active = orbSkin.id === skin.id
                return (
                  <button
                    key={skin.id}
                    onClick={() => setOrbSkin(skin)}
                    className="relative p-4 flex flex-col items-center gap-3 hover-lift"
                    style={{
                      background: active ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 18,
                      cursor: 'pointer',
                    }}
                    aria-pressed={active}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: skin.gradient,
                        boxShadow: `0 0 24px ${skin.glow}, inset 0 0 18px rgba(255,255,255,0.15), inset 0 -8px 16px rgba(0,0,0,0.3)`,
                      }}
                    />
                    <div className="text-center">
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-paper-0)' }}>{skin.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-paper-2)', marginTop: 2 }}>{skin.hint}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="w-full mt-6 flex gap-3">
              <Button variant="ghost" size="md" onClick={() => transition(0)}>Back</Button>
              <Button size="md" block onClick={() => transition(2)} trailing={<span style={{ fontSize: 14 }}>→</span>}>
                That's me
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2 — mind type (non-stigmatizing) + age ─────────────────── */}
        {step === 2 && (
          <>
            <DisplayTitle size="md" gradient="aurora" tight className="text-center mb-2">
              Quick — how's your brain?
            </DisplayTitle>
            <p className="text-center mb-7" style={{ color: 'var(--color-paper-2)', fontSize: 13.5, maxWidth: 340 }}>
              Just so I know how to pace things. No labels, no judgement.
            </p>
            <div className="w-full space-y-3 mb-5">
              <button
                onClick={() => setHasADHD(false)}
                className="w-full text-left p-4 hover-lift"
                style={{
                  background: hasADHD === false ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${hasADHD === false ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-paper-0)' }}>🧠 I can lock in for hours</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-paper-2)', marginTop: 4, lineHeight: 1.5 }}>
                  Standard pacing, deeper lessons.
                </div>
              </button>
              <button
                onClick={() => setHasADHD(true)}
                className="w-full text-left p-4 hover-lift"
                style={{
                  background: hasADHD === true ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${hasADHD === true ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-paper-0)' }}>⚡ Everything distracts me</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-paper-2)', marginTop: 4, lineHeight: 1.5 }}>
                  Smaller chunks, gentler tone, anti-shame mode.
                </div>
              </button>
            </div>

            <div className="w-full">
              <div style={{ fontSize: 11, color: 'var(--color-paper-3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8, paddingLeft: 4 }}>
                Age group
              </div>
              <div className="grid grid-cols-4 gap-2 w-full mb-6">
                {AGE_OPTIONS.map(opt => {
                  const active = ageGroup === opt.code
                  return (
                    <button
                      key={opt.code}
                      onClick={() => setAgeGroup(opt.code)}
                      className="py-2.5 text-center"
                      style={{
                        background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 14 }}>{opt.emoji}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-paper-1)', marginTop: 2 }}>{opt.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="w-full flex gap-3">
              <Button variant="ghost" size="md" onClick={() => transition(1)}>Back</Button>
              <Button
                size="md"
                block
                disabled={hasADHD === null}
                onClick={() => transition(3)}
                trailing={<span style={{ fontSize: 14 }}>→</span>}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {/* ── Step 3 — language + final CTA ───────────────────────────────── */}
        {step === 3 && (
          <>
            <div className="mb-6">
              <HeroOrb size={84} animate />
            </div>
            <DisplayTitle size="md" gradient="aurora" tight className="text-center mb-2">
              One last thing.
            </DisplayTitle>
            <p className="text-center mb-6" style={{ color: 'var(--color-paper-2)', fontSize: 13.5 }}>
              What language should I speak with you?
            </p>
            <GlassCard tone="sm" radius="lg" className="w-full p-2 mb-6">
              <div className="flex flex-col gap-1.5">
                {LANGUAGE_OPTIONS.map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => setLanguage(code)}
                    className="py-2.5 px-4 text-left flex items-center justify-between"
                    style={{
                      background: language === code ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: `1px solid ${language === code ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.04)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      color: language === code ? 'var(--color-paper-0)' : 'var(--color-paper-1)',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ fontWeight: language === code ? 600 : 500 }}>{label}</span>
                    {language === code && <span style={{ fontSize: 14 }}>·</span>}
                  </button>
                ))}
              </div>
            </GlassCard>

            <div style={{ fontSize: 11, color: 'var(--color-paper-3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10, alignSelf: 'flex-start', paddingLeft: 4 }}>
              First topic — pick one or build your own
            </div>
            <div className="grid grid-cols-3 gap-2 w-full mb-6">
              {TOPIC_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={finish}
                  className="py-3 text-center hover-lift"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 16 }}>{p.emoji}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-paper-1)', marginTop: 4, lineHeight: 1.3 }}>
                    {p.label}
                  </div>
                </button>
              ))}
            </div>

            <div className="w-full flex gap-3">
              <Button variant="ghost" size="md" onClick={() => transition(2)}>Back</Button>
              <Button size="md" block onClick={finish} trailing={<span style={{ fontSize: 14 }}>→</span>}>
                Build my first lesson
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
