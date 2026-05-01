import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import type { Message, UserProfile, AIStatus, ChatTokenEvent } from '../../../../shared/types'
import type { ChatAction } from '../lib/chat-actions'
import { getChatActionLabel, parseChatAssistantResponse } from '../lib/chat-actions'
import { useLanguage } from '../contexts/LanguageContext'

// ─── design tokens ─────────────────────────────────────────────────────────────
const PX   = "'Press Start 2P', monospace"
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
  violet:       'rgba(139,92,246,0.94)',
  violetBorder: 'rgba(139,92,246,0.24)',
}

// ─── injected CSS (keyframes + hover classes) ──────────────────────────────────
const AURA_CHAT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

@keyframes auraPulse {
  0%,100% { box-shadow: 0 0 14px rgba(196,154,60,0.24); }
  50%      { box-shadow: 0 0 28px rgba(196,154,60,0.45), 0 0 50px rgba(196,154,60,0.12); }
}
@keyframes breathe {
  0%,100% { transform: scale(1);    box-shadow: 0 0 12px rgba(217,119,6,0.3); }
  50%      { transform: scale(1.06); box-shadow: 0 0 22px rgba(217,119,6,0.5); }
}
@keyframes violetBreathe {
  0%,100% { box-shadow: 0 0 12px rgba(139,92,246,0.4); }
  50%      { box-shadow: 0 0 24px rgba(139,92,246,0.65); }
}
@keyframes typingDot {
  0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
  40%          { transform: scale(1);   opacity: 1;   }
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(8px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes slideInUp {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes energyFlow {
  0%   { opacity: 0.9; transform: scaleY(1); }
  100% { opacity: 0;   transform: scaleY(1.6); }
}

.aura-chat-send-btn:hover {
  transform: scale(1.08);
}
.aura-chat-suggestion-yes:hover {
  border-color: rgba(46,184,122,0.5) !important;
  box-shadow: 0 0 18px rgba(46,184,122,0.2) !important;
  transform: translateY(-1px);
}
.aura-chat-suggestion-no:hover {
  border-color: rgba(196,154,60,0.22) !important;
  color: rgba(232,197,106,0.54) !important;
  transform: translateY(-1px);
}
.aura-quick-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(196,154,60,0.26) !important;
}
/* scrollbar */
.aura-chat-messages::-webkit-scrollbar { width: 4px; }
.aura-chat-messages::-webkit-scrollbar-track { background: transparent; }
.aura-chat-messages::-webkit-scrollbar-thumb { background: rgba(196,154,60,0.1); border-radius: 4px; }
`

interface Props {
  profile: UserProfile
  aiStatus: AIStatus | null
  voiceHook?: {
    speak: (text: string) => void
    isSpeaking: boolean
    startListening: (onResult: (text: string) => void, continuous?: boolean) => void
    stopListening: () => void
    isListening: boolean
    transcript: string
    hasSpeechRecognition: boolean
  }
  onStartVoiceCall?: () => void
  onStartPomodoro?: () => void
  onOpenTasks?: () => void
  onOpenCourses?: () => void
  onOpenCourseCreator?: () => void
  onOpenCourse?: (courseId: number) => void
  onOpenFlashcards?: () => void
  onOpenTeacher?: (courseId: number) => void
}

const SUGGESTION_PATTERNS = /vrei|hai |te-ar|ai chef|încercăm|propun|jucăm|oferă|respirăm|spargi|ajut|să facem|să încercăm|want|let's|try|how about|shall we|suggest|play|offer|breathe|help|let us/i

export default function Chat({ profile, aiStatus, voiceHook, onStartVoiceCall, onStartPomodoro, onOpenTasks, onOpenCourses, onOpenCourseCreator, onOpenCourse, onOpenFlashcards, onOpenTeacher }: Props) {
  const { t } = useLanguage()
  const [messages,       setMessages]        = useState<Message[]>([])
  const [input,          setInput]           = useState('')
  const [isTyping,       setIsTyping]        = useState(false)
  const [streamText,     setStreamText]      = useState('')
  const [showSuggestion, setShowSuggestion]  = useState(false)
  const [lastBotText,    setLastBotText]     = useState('')
  const [pendingActions, setPendingActions]  = useState<ChatAction[]>([])
  const scrollRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const unsubRef   = useRef<(() => void) | null>(null)

  // Load history
  useEffect(() => {
    window.aura.chat.getHistory().then((history) => {
      setMessages(history)
      if (history.length === 0) {
        const welcome: Message = {
          id: -1,
          role: 'assistant',
          content: t('chat.welcome'),
          created_at: new Date().toISOString()
        }
        setMessages([welcome])
      }
    })
  }, [profile.name])

  // Subscribe to tokens
  useEffect(() => {
    unsubRef.current = window.aura.chat.onToken((data: ChatTokenEvent) => {
      if (data.done) {
        setIsTyping(false)
        setStreamText(prev => {
          const final = prev + data.token
          const parsed = parseChatAssistantResponse(final)
          const visibleText = parsed.visibleText || final
          setLastBotText(visibleText)
          setPendingActions(parsed.actions)
          setMessages(msgs => [
            ...msgs.filter(m => m.id !== -999),
            { id: Date.now(), role: 'assistant', content: visibleText, created_at: new Date().toISOString() }
          ])
          if (SUGGESTION_PATTERNS.test(visibleText)) setShowSuggestion(true)
          return ''
        })
      } else {
        setStreamText(prev => prev + data.token)
      }
    })
    return () => { unsubRef.current?.() }
  }, [])

  // Auto scroll — always stick to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages, streamText])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return
    const userMsg: Message = {
      id: Date.now(), role: 'user',
      content: text.trim(), created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    setStreamText('')
    setPendingActions([])
    setShowSuggestion(false)
    setMessages(prev => [
      ...prev,
      { id: -999, role: 'assistant', content: '', created_at: new Date().toISOString() }
    ])
    await window.aura.chat.send(text.trim())
  }, [isTyping])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleSuggestionClick = (response: string) => {
    setShowSuggestion(false)
    sendMessage(response)
  }

  const handleActionClick = (action: ChatAction) => {
    setPendingActions([])
    switch (action.kind) {
      case 'OPEN_TASKS':
        onOpenTasks?.()
        break
      case 'OPEN_COURSES':
        onOpenCourses?.()
        break
      case 'OPEN_COURSE_CREATOR':
        onOpenCourseCreator?.()
        break
      case 'OPEN_COURSE':
        if (action.courseId) onOpenCourse?.(action.courseId)
        break
      case 'OPEN_FLASHCARDS':
        onOpenFlashcards?.()
        break
      case 'OPEN_TEACHER':
        if (action.courseId) onOpenTeacher?.(action.courseId)
        break
    }
  }

  // ─── is input active? ────────────────────────────────────────────────────────
  const canSend     = !!input.trim() && !isTyping
  const listenActive = voiceHook?.isListening ?? false

  return (
    <>
      <style>{AURA_CHAT_CSS}</style>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        position: 'relative', zIndex: 10, minWidth: 0,
        fontFamily: PX,
      }}>

        {/* ── MODEL INDICATOR (brand-style top bar) ──────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px',
          borderBottom: `1px solid ${C.border}`,
          background: 'rgba(2,9,4,0.7)',
        }}>
          {/* left: orb + model name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 2,
              background: 'radial-gradient(circle at 35% 35%, rgba(232,197,106,0.78), rgba(196,154,60,0.24))',
              border: '1px solid rgba(196,154,60,0.42)',
              animation: 'auraPulse 4s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: PX, fontSize: 5, color: C.textDim, letterSpacing: '0.2em', textTransform: 'uppercase', lineHeight: 2 }}>
              {aiStatus?.running ? 'wispucci ai beta' : 'connecting...'}
            </span>
          </div>
          {/* right: local badge */}
          <span style={{
            fontFamily: PX, fontSize: 5, color: C.textGhost,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(196,154,60,0.06)',
            border: `1px solid ${C.border}`,
            lineHeight: 2, letterSpacing: '0.1em',
          }}>
            WISP UCCI
          </span>
        </div>

        {/* ── MESSAGES ───────────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="aura-chat-messages"
          style={{
            flex: 1, overflowY: 'auto',
            padding: '16px 0',
            scrollBehavior: 'smooth',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(196,154,60,0.1) transparent',
          }}
        >
          {messages.map((msg) => (
            msg.id === -999 && isTyping ? (
              <MessageBubble key="streaming" message={msg} isStreaming streamText={streamText} />
            ) : msg.id !== -999 ? (
              <MessageBubble key={msg.id} message={msg} />
            ) : null
          ))}

          {/* Typing indicator (aura-score orb style) */}
          {isTyping && !streamText && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0 18px', marginBottom: 12,
              animation: 'fadeUp 0.3s cubic-bezier(.16,1,.3,1)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'radial-gradient(circle at 40% 38%, rgba(217,119,6,0.7), rgba(180,83,9,0.4))',
                border: '1px solid rgba(217,119,6,0.3)',
                boxShadow: '0 0 14px rgba(217,119,6,0.25)',
                animation: 'breathe 2s ease-in-out infinite',
              }}>
                <span style={{ fontFamily: PX, fontSize: 7, color: C.goldPale, fontWeight: 700 }}>A</span>
              </div>
              <div style={{
                display: 'flex', gap: 6,
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(4,14,8,0.7)',
                border: `1px solid ${C.border}`,
              }}>
                {[0, 0.22, 0.44].map((delay, i) => (
                  <span key={i} style={{
                    width: 7, height: 7, borderRadius: 2,
                    background: C.gold,
                    display: 'inline-block',
                    animation: `typingDot 1.4s infinite ${delay}s`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Smart suggestion buttons — da / nu */}
          {showSuggestion && !isTyping && (
            <div style={{
              display: 'flex', gap: 8, padding: '0 18px', marginBottom: 12,
              animation: 'slideInUp 0.35s cubic-bezier(.16,1,.3,1)',
            }}>
              <button
                className="aura-chat-suggestion-yes"
                onClick={() => handleSuggestionClick('Yes, let\'s go!')}
                style={{
                  fontFamily: PX, fontSize: 6, lineHeight: 2,
                  padding: '8px 16px', borderRadius: 8,
                  background: 'linear-gradient(135deg, rgba(46,184,122,0.14), rgba(13,61,46,0.18))',
                  border: '1px solid rgba(46,184,122,0.28)',
                  color: 'rgba(46,184,122,0.84)',
                  cursor: 'pointer', transition: 'all 0.25s ease',
                }}>
                Yes ✓
              </button>
              <button
                className="aura-chat-suggestion-no"
                onClick={() => handleSuggestionClick('Not now, thanks.')}
                style={{
                  fontFamily: PX, fontSize: 6, lineHeight: 2,
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(4,14,8,0.55)',
                  border: `1px solid ${C.border}`,
                  color: C.textGhost,
                  cursor: 'pointer', transition: 'all 0.25s ease',
                }}>
                Not now
              </button>
            </div>
          )}

          {pendingActions.length > 0 && !isTyping && (
            <div style={{
              display: 'flex', gap: 8, padding: '0 18px', marginBottom: 12, flexWrap: 'wrap',
              animation: 'slideInUp 0.35s cubic-bezier(.16,1,.3,1)',
            }}>
              {pendingActions.map((action, index) => (
                <button
                  key={`${action.kind}:${action.courseId || index}`}
                  onClick={() => handleActionClick(action)}
                  className="aura-chat-suggestion-yes"
                  style={{
                    fontFamily: PX, fontSize: 6, lineHeight: 2,
                    padding: '8px 16px', borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(196,154,60,0.14), rgba(13,61,46,0.18))',
                    border: '1px solid rgba(196,154,60,0.28)',
                    color: 'rgba(232,197,106,0.86)',
                    cursor: 'pointer', transition: 'all 0.25s ease',
                  }}
                >
                  {getChatActionLabel(action, t)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── INPUT AREA ─────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: '10px 14px 12px',
          borderTop: `1px solid ${C.border}`,
          background: 'rgba(2,9,4,0.8)',
        }}>

          {/* quick actions (cooldown-bar style) */}
          {(voiceHook?.hasSpeechRecognition && onStartVoiceCall || onStartPomodoro) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {voiceHook?.hasSpeechRecognition && onStartVoiceCall && (
                <button
                  className="aura-quick-btn"
                  onClick={onStartVoiceCall}
                  style={{
                    fontFamily: PX, fontSize: 5, lineHeight: 2,
                    padding: '6px 11px', borderRadius: 6,
                    background: 'rgba(13,29,22,0.55)',
                    border: '1px solid rgba(139,92,246,0.18)',
                    color: 'rgba(180,160,240,0.7)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  📞 Apel vocal
                </button>
              )}
              {onStartPomodoro && (
                <button
                  className="aura-quick-btn"
                  onClick={onStartPomodoro}
                  style={{
                    fontFamily: PX, fontSize: 5, lineHeight: 2,
                    padding: '6px 11px', borderRadius: 6,
                    background: 'rgba(13,29,22,0.55)',
                    border: `1px solid ${C.greenBorder}`,
                    color: 'rgba(46,184,122,0.7)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  ⏱ Pomodoro
                </button>
              )}
            </div>
          )}

          {/* voice transcript preview */}
          {listenActive && voiceHook?.transcript && (
            <div style={{
              marginBottom: 10, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(80,60,160,0.08)',
              border: '1px solid rgba(139,92,246,0.15)',
              animation: 'fadeUp 0.3s cubic-bezier(.16,1,.3,1)',
            }}>
              <div style={{ fontFamily: PX, fontSize: 5, color: 'rgba(180,160,240,0.7)', marginBottom: 4, lineHeight: 2 }}>
                🎤 Te ascult...
              </div>
              <div style={{ fontFamily: PX, fontSize: 6, color: C.textMain, lineHeight: 2 }}>
                {voiceHook.transcript}
              </div>
            </div>
          )}

          {/* main input box (input-wrap style) */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(4,13,8,0.8)',
            border: `1px solid ${listenActive ? 'rgba(139,92,246,0.32)' : C.borderStrong}`,
            boxShadow: listenActive ? '0 0 20px rgba(139,92,246,0.09)' : 'none',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}>

            {/* mic button */}
            {voiceHook?.hasSpeechRecognition && (
              <button
                onClick={() => {
                  if (voiceHook.isListening) {
                    voiceHook.stopListening()
                  } else {
                    voiceHook.startListening((text) => sendMessage(text))
                  }
                }}
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer', transition: 'all 0.25s',
                  background: listenActive
                    ? 'linear-gradient(135deg, rgba(139,92,246,0.7), rgba(109,40,217,0.6))'
                    : 'rgba(13,29,22,0.55)',
                  boxShadow: listenActive ? '0 0 14px rgba(139,92,246,0.4)' : 'none',
                  animation: listenActive ? 'violetBreathe 2s ease-in-out infinite' : 'none',
                }}>
                <span style={{ fontSize: 12 }}>{listenActive ? '⏹' : '🎤'}</span>
              </button>
            )}

            {/* textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listenActive ? t('chat.placeholder') : t('chat.placeholder')}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: PX, fontSize: 6, color: C.textMain, lineHeight: 2,
                resize: 'none', maxHeight: 120, minHeight: 24,
              }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = '24px'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }}
            />

            {/* send button */}
            <button
              className="aura-chat-send-btn"
              onClick={() => sendMessage(input)}
              disabled={!canSend}
              style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: canSend ? 'pointer' : 'default',
                transition: 'all 0.25s',
                background: canSend
                  ? 'linear-gradient(135deg, rgba(196,154,60,0.55), rgba(13,61,46,0.45))'
                  : 'rgba(13,29,22,0.45)',
                boxShadow: canSend ? '0 0 18px rgba(196,154,60,0.28)' : 'none',
                opacity: canSend ? 1 : 0.35,
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={canSend ? C.goldLight : C.textGhost}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>

          {/* hint row (pixel-small) */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 8, padding: '0 2px',
          }}>
            <span style={{ fontFamily: PX, fontSize: 4, color: C.textGhost, lineHeight: 2, letterSpacing: '0.06em' }}>
              ENTER — send · 🎤 — voice · SHIFT+ENTER — new line
            </span>
            <span style={{ fontFamily: PX, fontSize: 4, color: C.textGhost, lineHeight: 2, letterSpacing: '0.06em' }}>
              LOCAL ✓
            </span>
          </div>
        </div>
      </div>
    </>
  )
}