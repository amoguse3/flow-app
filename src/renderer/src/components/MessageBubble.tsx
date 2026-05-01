import { useState, useEffect, useRef } from 'react'
import type { Message } from '../../../../shared/types'
import LessonRichText from './LessonRichText'

interface Props {
  message: Message
  isStreaming?: boolean
  streamText?: string
}

export default function MessageBubble({ message, isStreaming, streamText }: Props) {
  const isUser = message.role === 'user'
  const text = isStreaming ? (streamText || '') : message.content
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [text])

  return (
    <div ref={ref}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 px-4`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.3s ease-out'
      }}>
      {/* AURA avatar for bot messages */}
      {!isUser && (
        <div className="shrink-0 mr-2.5 mt-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center animate-breathe" style={{
            background: 'radial-gradient(circle, #d97706 0%, #92400e 100%)',
            boxShadow: '0 0 12px rgba(217,119,6,0.3)'
          }}>
            <span className="text-xs font-bold text-white">A</span>
          </div>
        </div>
      )}

      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isUser
        ? 'rounded-br-md'
        : 'rounded-bl-md'
        }`}
        style={{
          background: isUser
            ? 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(217,119,6,0.08))'
            : 'rgba(26,23,20,0.8)',
          border: `1px solid ${isUser ? 'rgba(217,119,6,0.2)' : 'rgba(42,37,32,0.5)'}`,
          backdropFilter: 'blur(10px)'
        }}>
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#f0e6d9' }}>
            {text}
            {isStreaming && (
              <span className="inline-flex ml-1 gap-0.5">
                <span className="w-1 h-1 rounded-full bg-aura-orange" style={{ animation: 'typing-dot 1.4s infinite 0s' }} />
                <span className="w-1 h-1 rounded-full bg-aura-orange" style={{ animation: 'typing-dot 1.4s infinite 0.2s' }} />
                <span className="w-1 h-1 rounded-full bg-aura-orange" style={{ animation: 'typing-dot 1.4s infinite 0.4s' }} />
              </span>
            )}
          </p>
        ) : (
          <div style={{ color: '#e8e0d8' }}>
            <LessonRichText content={text} variant="bubble" />
            {isStreaming && (
              <div className="inline-flex mt-2 gap-0.5">
                <span className="w-1 h-1 rounded-full bg-aura-orange" style={{ animation: 'typing-dot 1.4s infinite 0s' }} />
                <span className="w-1 h-1 rounded-full bg-aura-orange" style={{ animation: 'typing-dot 1.4s infinite 0.2s' }} />
                <span className="w-1 h-1 rounded-full bg-aura-orange" style={{ animation: 'typing-dot 1.4s infinite 0.4s' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="shrink-0 ml-2.5 mt-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            boxShadow: '0 0 10px rgba(139,92,246,0.2)'
          }}>
            <span className="text-xs font-bold text-white">T</span>
          </div>
        </div>
      )}
    </div>
  )
}
