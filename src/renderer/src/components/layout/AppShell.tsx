import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AIStatus, ChatTokenEvent, UserProfile } from '../../../../../shared/types'
import { t as translateString, type AppLanguage } from '../../../../../shared/i18n'
import OnboardingDesktop from '../OnboardingDesktop'
import Sidebar from '../Sidebar'
import StreakNudge from '../StreakNudge'
import BotOrb, { MOOD_CONFIG, type BotMood } from '../BotOrb'
import type { MenuAction } from '../FloatingMenu'
import FloatingMenu from '../FloatingMenu'
import TopIndicator from '../TopIndicator'
import ThemedBackground from '../ThemedBackground'
import TypewriterText from '../TypewriterText'
import PanelManager from './PanelManager'
import { useTheme } from '../../contexts/ThemeContext'
import { useLanguage } from '../../contexts/LanguageContext'
import type { MotivationContextValue } from '../../contexts/MotivationContext'
import { playAchievement, playBlip, playBoot, playClick, playMoodTone, playWhoosh } from '../../lib/sounds'
import type { ChatAction } from '../../lib/chat-actions'
import { getChatActionLabel, parseChatAssistantResponse } from '../../lib/chat-actions'
import { useVoice } from '../../hooks/useVoice'
import { useGameBridge } from '../../hooks/useGameBridge'
import { usePanelRouting } from '../../hooks/usePanelRouting'
import { useQuickStart } from '../../hooks/useQuickStart'

const BASE_VIEWPORT = {
  width: 1280,
  height: 760,
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getUiScale(width: number, height: number) {
  return clampValue(Math.min(width / BASE_VIEWPORT.width, height / BASE_VIEWPORT.height), 0.74, 1)
}

function clampOrbPosition(position: { x: number; y: number }, width: number, height: number) {
  const insetX = clampValue(width * 0.13, 124, 168)
  const insetTop = clampValue(height * 0.18, 124, 172)
  const insetBottom = clampValue(height * 0.24, 180, 230)
  const maxX = Math.max(insetX, width - insetX)
  const maxY = Math.max(insetTop, height - insetBottom)

  return {
    x: clampValue(position.x, insetX, maxX),
    y: clampValue(position.y, insetTop, maxY),
  }
}

interface Props {
  motivationState: MotivationContextValue
}

export default function AppShell({ motivationState }: Props) {
  const theme = useTheme()
  const { t, lang } = useLanguage()
  const {
    motivation,
    achievementNotice,
    initializeMotivation,
    syncMotivation,
    refreshMotivation,
    setTrackingEnabled,
    clearAchievementNotice,
    showAchievementNotice,
  } = motivationState
  const isWebRuntime = typeof window !== 'undefined' && window.__AURA_RUNTIME__ === 'web'
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? BASE_VIEWPORT.width : window.innerWidth,
    height: typeof window === 'undefined' ? BASE_VIEWPORT.height : window.innerHeight,
  }))
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const [showEnergy, setShowEnergy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [todayEnergy, setTodayEnergy] = useState<number | null>(null)
  const [pendingEnergyAfterQuickStart, setPendingEnergyAfterQuickStart] = useState(false)
  const [tutorialCourseGenerated, setTutorialCourseGenerated] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [mood, setMood] = useState<BotMood>('neutral')
  const [speaking, setSpeaking] = useState(false)
  const [botText, setBotText] = useState('')
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [botActions, setBotActions] = useState<ChatAction[]>([])
  const [orbPos, setOrbPos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const clearBotActions = useCallback(() => {
    setBotActions([])
  }, [])
  const routing = usePanelRouting({ onRoute: clearBotActions })
  const gameBridge = useGameBridge()
  const voice = useVoice()
  const dragRef = useRef({
    active: false,
    moved: false,
    startClientX: 0,
    startClientY: 0,
    startOrbX: 0,
    startOrbY: 0,
  })
  const orbPosRef = useRef<{ x: number; y: number } | null>(null)
  const uiScale = getUiScale(viewport.width, viewport.height)

  orbPosRef.current = orbPos

  const { handleQuickStartChoice, completeGuidedTutorial } = useQuickStart({
    profile,
    setProfile,
    todayEnergy,
    setShowEnergy,
    setPendingEnergyAfterQuickStart,
    setShowQuickStart: routing.setShowQuickStart,
    setShowTutorial: routing.setShowTutorial,
    resetTutorialCourseGenerated: () => setTutorialCourseGenerated(false),
    setMood,
    setBotText,
    setSpeaking,
    showAchievementNotice,
    syncMotivation,
    onOpenTasks: routing.openTasksPanel,
    onOpenCourseCreator: () => routing.openCourseCreator(),
    onOpenFocus: () => routing.setShowFocus(true),
    t,
  })

  useEffect(() => {
    let cancelled = false

    async function init() {
      const [nextProfile, status, energy, motivationState] = await Promise.all([
        window.aura.profile.get(),
        window.aura.ai.status(),
        window.aura.energy.getToday(),
        window.aura.motivation.getState(),
      ])

      if (cancelled) return

      setProfile(nextProfile)
      setAiStatus(status)
      setTodayEnergy(energy)
      initializeMotivation(motivationState)

      const profileLang = (nextProfile?.language || lang) as AppLanguage
      const translate = (key: string, params?: Record<string, string | number>) => translateString(key, profileLang, params)
      let welcomeBackMessage: string | null = null

      if (nextProfile?.onboardingDone) {
        const updatedMotivation = await window.aura.motivation.updateStreak()
        if (cancelled) return

        syncMotivation(updatedMotivation, { silent: true })
        if (updatedMotivation?.welcomeBack === 'freeze_used') {
          welcomeBackMessage = translate('app.welcomeBackFreeze', { name: nextProfile.name })
          setMood('grateful')
        } else if (updatedMotivation?.welcomeBack === 'streak_reset') {
          welcomeBackMessage = translate('app.welcomeBackReset', { name: nextProfile.name })
          setMood('loving')
        }
      }

      if (nextProfile?.onboardingDone) {
        if (welcomeBackMessage) {
          setBotText(welcomeBackMessage)
          setSpeaking(true)
          playBoot()
          window.setTimeout(() => setSpeaking(false), 4_500)
          void window.aura.motivation.acknowledgeWelcomeBack().then((next) => syncMotivation(next, { silent: true })).catch(() => undefined)
        } else {
          const hour = new Date().getHours()
          const timeGreetKey = hour < 6
            ? 'app.greeting.night'
            : hour < 12
              ? 'app.greeting.morning'
              : hour < 18
                ? 'app.greeting.afternoon'
                : 'app.greeting.evening'
          setBotText(translate('app.greeting.intro', { greeting: translate(timeGreetKey), name: nextProfile.name }))
          setSpeaking(true)
          playBoot()
          window.setTimeout(() => setSpeaking(false), 3_000)
        }
      }

      const shouldShowFirstSessionTutorial = Boolean(
        nextProfile?.onboardingDone && nextProfile.onboardingQuickStartDone !== true && (motivationState?.xp ?? 0) === 0,
      )

      if (nextProfile?.onboardingDone && energy === null) {
        if (shouldShowFirstSessionTutorial) {
          setPendingEnergyAfterQuickStart(true)
        } else {
          setShowEnergy(true)
        }
      }

      if (shouldShowFirstSessionTutorial) {
        routing.setShowTutorial(true)
      }

      setLoading(false)
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [initializeMotivation, lang, routing, syncMotivation])

  useEffect(() => {
    setTrackingEnabled(Boolean(profile?.onboardingDone))
  }, [profile?.onboardingDone, setTrackingEnabled])

  useEffect(() => {
    if (!pendingEnergyAfterQuickStart || routing.hasBlockingOverlay || showEnergy || todayEnergy !== null) {
      return
    }

    setShowEnergy(true)
    setPendingEnergyAfterQuickStart(false)
  }, [pendingEnergyAfterQuickStart, routing.hasBlockingOverlay, showEnergy, todayEnergy])

  useEffect(() => {
    if (!achievementNotice) return
    playAchievement()
  }, [achievementNotice])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_orb_pos')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          setOrbPos(clampOrbPosition({ x: parsed.x, y: parsed.y }, window.innerWidth, window.innerHeight))
        }
      }
    } catch {
      // Ignore corrupted orb-position storage.
    }

    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      setOrbPos((current) => {
        if (!current) return current
        return clampOrbPosition(current, window.innerWidth, window.innerHeight)
      })
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startOrbDrag = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return

    const host = event.currentTarget as HTMLElement
    const rect = host.getBoundingClientRect()
    dragRef.current = {
      active: true,
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOrbX: rect.left + rect.width / 2,
      startOrbY: rect.top + rect.height / 2,
    }

    const onMove = (pointerEvent: PointerEvent) => {
      const drag = dragRef.current
      if (!drag.active) return

      const deltaX = pointerEvent.clientX - drag.startClientX
      const deltaY = pointerEvent.clientY - drag.startClientY
      if (!drag.moved && Math.hypot(deltaX, deltaY) > 5) {
        drag.moved = true
        setIsDragging(true)
        document.body.style.cursor = 'grabbing'
      }

      if (drag.moved) {
        setOrbPos(clampOrbPosition({ x: drag.startOrbX + deltaX, y: drag.startOrbY + deltaY }, window.innerWidth, window.innerHeight))
      }
    }

    const onUp = () => {
      const drag = dragRef.current
      if (drag.moved && orbPosRef.current) {
        try {
          localStorage.setItem('aura_orb_pos', JSON.stringify(orbPosRef.current))
        } catch {
          // Ignore one-off localStorage failures.
        }
      }

      drag.active = false
      setIsDragging(false)
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const handleOrbClick = useCallback(() => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false
      return
    }

    setShowMenu((current) => !current)
  }, [])

  const handleOrbDoubleClick = useCallback(() => {
    setOrbPos(null)
    try {
      localStorage.removeItem('aura_orb_pos')
    } catch {
      // Ignore storage removal errors.
    }
  }, [])

  useEffect(() => {
    return window.aura.chat.onToken((data: ChatTokenEvent) => {
      if (data.done) {
        setIsTyping(false)
        setStreamText((current) => {
          const final = current + data.token
          const parsed = parseChatAssistantResponse(final)
          const visibleText = parsed.visibleText || final
          setBotText(visibleText)
          setBotActions(parsed.actions)
          setSpeaking(true)
          window.setTimeout(() => setSpeaking(false), 3_000)

          const normalized = visibleText.toLowerCase()
          let nextMood: BotMood = 'happy'
          if (/haha|lol|amuzant|funny/.test(normalized)) nextMood = 'laughing'
          else if (/trist|rău|greu|sad|bad|hard/.test(normalized)) nextMood = 'sad'
          else if (/super|minunat|genial|bravo|great|awesome|amazing/.test(normalized)) nextMood = 'excited'
          else if (/gândesc|analize|think|analy/.test(normalized)) nextMood = 'thinking'
          else if (/calm|liniștit|relaxa|peaceful|relax/.test(normalized)) nextMood = 'calm'

          setMood(nextMood)
          playMoodTone(nextMood)
          void refreshMotivation().catch(() => undefined)
          return ''
        })
        return
      }

      setStreamText((current) => {
        const updated = current + data.token
        setBotText(updated)
        return updated
      })
    })
  }, [refreshMotivation])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return

    setInput('')
    setIsTyping(true)
    setStreamText('')
    setBotActions([])
    setMood('thinking')
    setBotText(t('chat.thinking'))
    setSpeaking(false)
    playBlip()
    await window.aura.chat.send(text.trim())
  }, [isTyping, t])

  useEffect(() => {
    return window.aura.overlay.onMessage((message: string) => {
      if (message) {
        void sendMessage(message)
      }
    })
  }, [sendMessage])

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(input)
    }
  }, [input, sendMessage])

  const handleMenuSelect = useCallback((action: MenuAction) => {
    setShowMenu(false)
    playClick()
    playWhoosh()
    routing.handleMenuSelect(action, { beforeOpenGames: gameBridge.resetGameBridge })
  }, [gameBridge.resetGameBridge, routing])

  const openFlashcardsFromBot = useCallback(async () => {
    routing.setShowChat(false)

    try {
      const cards = await window.aura.educator.getDueFlashcards()
      if (!cards.length) {
        setBotText(t('app.flashcards.noneDue'))
        setBotActions([])
        return
      }

      routing.openFlashcards(cards)
    } catch {
      setBotText(t('app.flashcards.openError'))
      setBotActions([])
    }
  }, [routing, t])

  const runBotAction = useCallback((action: ChatAction) => {
    switch (action.kind) {
      case 'OPEN_TASKS':
        routing.openTasksPanel()
        break
      case 'OPEN_COURSES':
        routing.openCoursesList()
        break
      case 'OPEN_COURSE_CREATOR':
        routing.openCourseCreator()
        break
      case 'OPEN_COURSE':
        if (action.courseId) {
          routing.openCourseView(action.courseId, 'currentLesson')
        }
        break
      case 'OPEN_FLASHCARDS':
        void openFlashcardsFromBot()
        break
      case 'OPEN_TEACHER':
        if (action.courseId) {
          routing.openTeacher(action.courseId)
        }
        break
    }
  }, [openFlashcardsFromBot, routing])

  const handleEnergySubmit = useCallback(async (level: number) => {
    await window.aura.energy.log(level)
    setTodayEnergy(level)
    setShowEnergy(false)
  }, [])

  const handleEnergySkip = useCallback(() => {
    setShowEnergy(false)
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#08070C' }}>
        <ThemedBackground />
        <div className="relative z-10 flex flex-col items-center gap-5 animate-fade-in">
          <div
            className="w-20 h-20 rounded-full animate-breathe"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85) 0%, var(--aura-accent, #C8A3FF) 35%, rgba(0,0,0,0.6) 90%)',
              boxShadow:
                '0 0 50px rgba(var(--aura-accent-rgb, 200,163,255), 0.45), 0 0 110px rgba(var(--aura-accent-rgb, 200,163,255), 0.18)',
            }}
          />
          <span
            style={{
              fontFamily: "'Newsreader', 'Iowan Old Style', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 17,
              letterSpacing: '0.04em',
              color: 'rgba(245,237,225,0.55)',
            }}
          >
            wispucci · ai
          </span>
        </div>
      </div>
    )
  }

  if (!profile?.onboardingDone) {
    return (
      <div className="h-full" style={{ background: '#080606' }}>
        <ThemedBackground />
        <OnboardingDesktop
          onComplete={async (nextProfile) => {
            await window.aura.profile.save(nextProfile)
            setProfile(nextProfile)
            setTutorialCourseGenerated(false)
            routing.setShowTutorial(true)
          }}
        />
      </div>
    )
  }

  const moodConfig = MOOD_CONFIG[mood]
  const shellStyle = {
    background: '#080606',
    fontFamily: theme.fontFamily,
    '--aura-ui-scale': String(uiScale),
  } as CSSProperties

  return (
    <div className="h-full flex flex-col" style={shellStyle}>
      <ThemedBackground />

      <div
        className="titlebar-drag h-8 flex items-center justify-between px-4 shrink-0 relative z-50"
        style={{ background: 'rgba(10,6,6,0.85)', borderBottom: '1px solid rgba(139,58,58,0.06)' }}
      >
        <div className="flex items-center gap-3 titlebar-nodrag">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: aiStatus?.running ? '#10b981' : '#ef4444',
              boxShadow: aiStatus?.running ? '0 0 6px #10b981' : '0 0 6px #ef4444',
            }}
          />
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{ color: 'rgba(200,160,140,0.25)' }}>
            wispucci ai beta
          </span>
          <span className="text-[8px]" style={{ color: 'rgba(200,160,140,0.12)' }}>· beta</span>
          {isWebRuntime && (
            <span
              className="text-[8px] px-2 py-1 rounded-full"
              style={{
                color: 'rgba(96,180,255,0.78)',
                background: 'rgba(96,180,255,0.08)',
                border: '1px solid rgba(96,180,255,0.16)',
              }}
            >
              {t('app.localWeb')}
            </span>
          )}
        </div>
        {!isWebRuntime && (
          <div className="flex items-center gap-0.5 titlebar-nodrag">
            <button onClick={() => window.aura.window.minimize()} className="w-7 h-5 rounded flex items-center justify-center text-[10px]" style={{ color: 'rgba(200,160,140,0.15)' }}>—</button>
            <button onClick={() => window.aura.window.close()} className="w-7 h-5 rounded flex items-center justify-center text-[10px] hover:text-red-400" style={{ color: 'rgba(200,160,140,0.15)' }}>✕</button>
          </div>
        )}
      </div>

      <TopIndicator onClickTask={routing.openTasksPanel} onClickCourse={(courseId) => routing.openCourseView(courseId)} />

      {(() => {
        const orbHalf = 143
        const textWidth = 380
        const gap = 24
        const usingCustomPosition = orbPos !== null
        const textOnRight = usingCustomPosition
          ? orbPos.x + orbHalf + gap + textWidth < window.innerWidth - 16
          : true
        const transitionCss = isDragging
          ? 'none'
          : 'left 0.35s cubic-bezier(.16,1,.3,1), top 0.35s cubic-bezier(.16,1,.3,1)'

        return (
          <div className="relative z-20 flex-1 min-h-0 transition-all duration-700" style={{ opacity: showMenu ? 0.3 : 1, filter: showMenu ? 'blur(2px)' : 'none' }}>
            <div
              onPointerDown={startOrbDrag}
              onDoubleClick={handleOrbDoubleClick}
              data-tutorial="orb-button"
              title="Drag the orb anywhere · double-click to re-center"
              style={{
                position: 'absolute',
                left: usingCustomPosition ? orbPos.x : '50%',
                top: usingCustomPosition ? orbPos.y : '50%',
                transform: 'translate(-50%,-50%)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                transition: transitionCss,
              }}
            >
              <BotOrb mood={mood} speaking={speaking} onClick={handleOrbClick} customImage={theme.orbImage} />
            </div>

            <div
              className="overflow-hidden"
              style={{
                position: 'absolute',
                width: textWidth,
                maxWidth: '40vw',
                pointerEvents: 'none',
                left: usingCustomPosition
                  ? (textOnRight ? orbPos.x + orbHalf + gap : orbPos.x - orbHalf - gap - textWidth)
                  : `calc(50% + ${orbHalf + gap}px)`,
                top: usingCustomPosition ? orbPos.y : '50%',
                transform: 'translateY(-50%)',
                transition: transitionCss,
                opacity: showMenu ? 0 : 1,
              }}
            >
              <TypewriterText text={botText} />
            </div>
          </div>
        )
      })()}

      <div className="relative z-30 shrink-0 px-4 py-3">
        {botActions.length > 0 && !isTyping && (
          <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
            {botActions.map((action, index) => (
              <button
                key={`${action.kind}:${action.courseId || index}`}
                onClick={() => runBotAction(action)}
                className="rounded-xl px-4 py-2 text-[10px] transition-all duration-300"
                style={{
                  fontFamily: theme.fontFamily,
                  background: 'rgba(196,154,60,0.08)',
                  border: '1px solid rgba(196,154,60,0.18)',
                  color: 'rgba(245,228,168,0.8)',
                  boxShadow: '0 0 18px rgba(196,154,60,0.08)',
                }}
              >
                {getChatActionLabel(action, t)}
              </button>
            ))}
          </div>
        )}

        <div className="w-full flex items-center gap-2 rounded-2xl px-5 py-3 transition-all duration-500 aura-input-wrap" data-tutorial="chat-input">
          <div
            className="contents"
            style={{
              background: 'rgba(10,6,6,0.8)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${input ? `${moodConfig.orb}50` : 'rgba(139,58,58,0.08)'}`,
              boxShadow: input
                ? `0 0 20px ${moodConfig.orb}15, 0 0 40px ${moodConfig.orb}08, inset 0 0 20px ${moodConfig.orb}05`
                : '0 0 8px rgba(255,245,220,0.04)',
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t('app.inputPlaceholder')}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/10"
              style={{ color: 'rgba(230,200,190,0.8)' }}
            />
            <button
              onClick={() => { void sendMessage(input) }}
              disabled={!input.trim() || isTyping}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
              style={{
                background: input.trim() ? `${moodConfig.orb}25` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${input.trim() ? `${moodConfig.orb}35` : 'rgba(255,255,255,0.04)'}`,
                opacity: input.trim() ? 1 : 0.3,
              }}
            >
              <span style={{ color: 'rgba(230,200,190,0.6)' }}>↑</span>
            </button>
          </div>
        </div>
      </div>

      <FloatingMenu open={showMenu} onClose={() => setShowMenu(false)} onSelect={handleMenuSelect} />

      <PanelManager
        profile={profile}
        aiStatus={aiStatus}
        isWebRuntime={isWebRuntime}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        showEnergy={showEnergy}
        routing={routing}
        gameBridge={gameBridge}
        voice={voice}
        tutorialCourseGenerated={tutorialCourseGenerated}
        markTutorialCourseGenerated={() => setTutorialCourseGenerated(true)}
        resetTutorialCourseGenerated={() => setTutorialCourseGenerated(false)}
        onQuickStartChoice={handleQuickStartChoice}
        onCompleteTutorial={completeGuidedTutorial}
        onEnergySubmit={handleEnergySubmit}
        onEnergySkip={handleEnergySkip}
        onOpenFlashcardsFromBot={openFlashcardsFromBot}
      />

      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} profile={profile} />}

      <StreakNudge />

      {achievementNotice && (
        <button
          type="button"
          onClick={clearAchievementNotice}
          className="glass-md absolute bottom-4 right-4 z-[60] flex items-center gap-3 text-left"
          style={{
            padding: '12px 16px',
            borderRadius: 16,
            boxShadow:
              'inset 0 1px 0 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(var(--aura-accent-rgb,200,163,255),0.22), 0 0 50px -10px rgba(var(--aura-accent-rgb,200,163,255),0.45), 0 16px 40px -10px rgba(0,0,0,0.55)',
            animation: 'achieveMinecraft 4.2s cubic-bezier(.16,1,.3,1) forwards',
            minWidth: 260,
          }}
        >
          <span style={{ fontSize: 22 }}>{achievementNotice.icon}</span>
          <span className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--color-paper-3)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
              {achievementNotice.title}
            </span>
            <span
              className="font-serif-ui"
              style={{ fontSize: 14, color: 'var(--color-paper-0)', lineHeight: 1.3, fontWeight: 600 }}
            >
              {achievementNotice.text}
            </span>
          </span>
        </button>
      )}

      {motivation && (
        <div className="absolute top-8 left-0 right-0 z-30 h-[2px]" style={{ background: 'rgba(139,58,58,0.06)' }}>
          <div
            className="h-full transition-all duration-1000 ease-out"
            style={{
              width: `${Math.min(100, ((motivation.xp % 100) / 100) * 100)}%`,
              background: 'linear-gradient(90deg, rgba(217,119,6,0.3), rgba(245,158,11,0.5))',
              boxShadow: '0 0 8px rgba(245,158,11,0.2)',
            }}
          />
        </div>
      )}
    </div>
  )
}