import { Fragment, useEffect, useState } from 'react'
import type { Lesson } from '../../../../shared/types'
import LessonSupportPanel from './LessonSupportPanel'
import { markLessonCompletedToday } from './StreakNudge'

interface Props {
  lesson: Lesson
  lessonTotal?: number
  onBack: () => void
  onComplete: () => void
  devSkipEnabled?: boolean
  onDevSkip?: () => void
}

// ── Parse markdown code fences ──────────────────────────────────────────────
type Segment =
  | { type: 'text'; value: string }
  | { type: 'code'; lang: string; value: string }

type TextBlock =
  | { type: 'intro'; value: string }
  | { type: 'body'; value: string }
  | { type: 'callout'; value: string }

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'highlight'; value: string }

type LessonSectionLabel = 'HOOK' | 'CORE' | 'PROVE IT' | 'RECAP' | 'CLIFFHANGER'

interface LessonSection {
  label: LessonSectionLabel
  paragraphs: string[]
}

const LESSON_TEXT_SCALE = 1.3
const ls = (size: number) => `${Number((size * LESSON_TEXT_SCALE).toFixed(1))}px`
const READING = "'Palatino Linotype', 'Book Antiqua', Georgia, serif"
const UI = "'Trebuchet MS', 'Segoe UI', sans-serif"
const LESSON_SECTION_PATTERN = /^(HOOK|CORE|PROVE IT|RECAP|CLIFFHANGER):\s*(.*)$/i

const LESSON_SECTION_TONES: Record<LessonSectionLabel, { background: string; border: string; badge: string; text: string }> = {
  HOOK: {
    background: 'linear-gradient(180deg, rgba(232,197,106,0.08), rgba(232,197,106,0.03))',
    border: 'rgba(232,197,106,0.18)',
    badge: 'rgba(232,197,106,0.72)',
    text: 'rgba(245,228,168,0.92)',
  },
  CORE: {
    background: 'linear-gradient(180deg, rgba(46,184,122,0.08), rgba(46,184,122,0.03))',
    border: 'rgba(46,184,122,0.18)',
    badge: 'rgba(120,220,170,0.72)',
    text: 'rgba(232,238,222,0.84)',
  },
  'PROVE IT': {
    background: 'linear-gradient(180deg, rgba(96,180,255,0.08), rgba(96,180,255,0.03))',
    border: 'rgba(96,180,255,0.18)',
    badge: 'rgba(156,212,255,0.74)',
    text: 'rgba(226,236,245,0.84)',
  },
  RECAP: {
    background: 'linear-gradient(180deg, rgba(196,154,60,0.1), rgba(196,154,60,0.03))',
    border: 'rgba(196,154,60,0.18)',
    badge: 'rgba(236,204,124,0.78)',
    text: 'rgba(245,232,196,0.88)',
  },
  CLIFFHANGER: {
    background: 'linear-gradient(180deg, rgba(214,120,80,0.1), rgba(214,120,80,0.03))',
    border: 'rgba(214,120,80,0.18)',
    badge: 'rgba(245,176,144,0.76)',
    text: 'rgba(242,224,214,0.84)',
  },
}

function parseContent(raw: string): Segment[] {
  const segments: Segment[] = []
  const regex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: raw.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'code', lang: match[1] || 'code', value: match[2].trimEnd() })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < raw.length) {
    segments.push({ type: 'text', value: raw.slice(lastIndex) })
  }
  return segments
}

function looksLikeCallout(value: string): boolean {
  const normalized = value.toLowerCase()
  return /analogi|imagin|gândește|gandeste|intu|pe scurt|altfel spus|ca și cum|ca si cum|think|as if|in short|analogy/.test(normalized)
}

function buildTextBlocks(raw: string): TextBlock[] {
  const paragraphs = raw
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)

  if (paragraphs.length === 1) {
    const sentences = paragraphs[0].split(/(?<=[.!?])\s+/).filter(Boolean)
    if (sentences.length >= 3) {
      const first = sentences.slice(0, 1).join(' ')
      const middle = sentences.slice(1, Math.max(2, sentences.length - 1)).join(' ')
      const last = sentences.slice(Math.max(2, sentences.length - 1)).join(' ')
      return [
        { type: 'intro', value: first },
        ...(middle ? [{ type: 'body' as const, value: middle }] : []),
        ...(last ? [{ type: 'callout' as const, value: last }] : []),
      ]
    }
  }

  return paragraphs.map((paragraph, index) => {
    if (index === 0) return { type: 'intro', value: paragraph }
    if (looksLikeCallout(paragraph) || (index === paragraphs.length - 1 && paragraphs.length > 2)) {
      return { type: 'callout', value: paragraph }
    }
    return { type: 'body', value: paragraph }
  })
}

function parseInlineHighlights(value: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: value.slice(lastIndex, match.index) })
    }
    tokens.push({ type: 'highlight', value: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < value.length) {
    tokens.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value }]
}

function renderHighlightedText(value: string, tone: 'display' | 'body' = 'body') {
  const tokens = parseInlineHighlights(value)
  const highlightStyle = tone === 'display'
    ? {
        color: 'rgba(255,240,194,0.98)',
        background: 'rgba(232,197,106,0.16)',
        boxShadow: '0 0 0 1px rgba(232,197,106,0.08)',
      }
    : {
        color: 'rgba(245,230,176,0.94)',
        background: 'rgba(232,197,106,0.12)',
        boxShadow: '0 0 0 1px rgba(232,197,106,0.06)',
      }

  return tokens.map((token, index) => {
    if (token.type === 'highlight') {
      return (
        <span
          key={`${tone}-highlight-${index}`}
          style={{
            ...highlightStyle,
            display: 'inline',
            padding: '0 4px',
            borderRadius: '6px',
            fontWeight: 700,
          }}
        >
          {token.value}
        </span>
      )
    }

    return <Fragment key={`${tone}-text-${index}`}>{token.value}</Fragment>
  })
}

function parseLessonSections(raw: string): LessonSection[] {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n')
  const sections: Array<{ label: LessonSectionLabel; lines: string[] }> = []
  let current: { label: LessonSectionLabel; lines: string[] } | null = null

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    const match = trimmed.match(LESSON_SECTION_PATTERN)
    if (match) {
      if (current) sections.push(current)
      current = {
        label: match[1].toUpperCase() as LessonSectionLabel,
        lines: match[2] ? [match[2].trim()] : [],
      }
      continue
    }

    if (!current) {
      if (trimmed) return []
      continue
    }

    current.lines.push(rawLine.trimEnd())
  }

  if (current) sections.push(current)

  const normalized = sections
    .map((section) => ({
      label: section.label,
      paragraphs: section.lines.join('\n')
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    }))
    .filter((section) => section.paragraphs.length > 0)

  return normalized.length >= 3 ? normalized : []
}

function getRenderableLessonContent(raw: string): string {
  const content = String(raw || '')
  if (!content.includes('[[AURA_PENDING_LESSON]]')) return content

  const titleMatch = content.match(/^(?:Lecția|Lectia|Lesson)\s\d+:\s(.+)$/im)
  const lessonTitle = titleMatch?.[1]?.trim() || 'this lesson'

  return [
    'HOOK:',
    `What practical problem should **${lessonTitle}** help you solve?`,
    '',
    'CORE:',
    `The full lesson is still loading, so start with the baseline goal: understand what **${lessonTitle}** is, when to use it, and what mistake to avoid first.`,
    `While the full version is preparing, try to predict one concrete example where **${lessonTitle}** would matter.`,
    '',
    'PROVE IT:',
    `Say in 1 sentence what you expect to be able to do after learning **${lessonTitle}**.`,
    '',
    'RECAP:',
    `You already have a useful starting frame for **${lessonTitle}**; the detailed lesson should appear automatically when it finishes preparing.`,
  ].join('\n')
}

// ── Code block component ─────────────────────────────────────────────────────
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {
      // Fallback for environments without clipboard permission
      try {
        const textarea = document.createElement('textarea')
        textarea.value = code
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      } catch {
        // last resort: do nothing
      }
    })
  }

  // Minimal keyword-based syntax colouring (no deps)
  const highlight = (src: string) => {
    const lines = src.split('\n')
    return lines.map((line, i) => {
      const parts: React.ReactNode[] = []
      // tokenise by spaces / punctuation loosely
      const tokens = line.split(/(\s+|[()[\]{},.:=<>!+\-*/&#@"'`])/)
      const keywords: Record<string, string> = {
        // python / js / ts / generic
        def: '#c49a3c', function: '#c49a3c', const: '#c49a3c', let: '#c49a3c',
        var: '#c49a3c', class: '#c49a3c', return: '#e8c56a', import: '#e8c56a',
        from: '#e8c56a', export: '#e8c56a', if: '#e8c56a', else: '#e8c56a',
        elif: '#e8c56a', for: '#e8c56a', while: '#e8c56a', in: '#e8c56a',
        and: '#e8c56a', or: '#e8c56a', not: '#e8c56a', True: '#2eb87a',
        False: '#2eb87a', None: '#2eb87a', null: '#2eb87a', undefined: '#2eb87a',
        true: '#2eb87a', false: '#2eb87a', print: '#f5e4a8', console: '#f5e4a8',
      }
      tokens.forEach((tok, j) => {
        if (keywords[tok]) {
          parts.push(<span key={j} style={{ color: keywords[tok] }}>{tok}</span>)
        } else if (/^['"`].*['"`]$/.test(tok) || /^".*"$/.test(tok)) {
          parts.push(<span key={j} style={{ color: 'rgba(46,184,122,0.85)' }}>{tok}</span>)
        } else if (/^\d+$/.test(tok)) {
          parts.push(<span key={j} style={{ color: 'rgba(232,197,106,0.7)' }}>{tok}</span>)
        } else if (tok.startsWith('#')) {
          // comment — rest of line
          parts.push(<span key={j} style={{ color: 'rgba(196,154,60,0.35)', fontStyle: 'italic' }}>{line.slice(line.indexOf('#'))}</span>)
          return
        } else {
          parts.push(<span key={j}>{tok}</span>)
        }
      })
      return <div key={i}>{parts}</div>
    })
  }

  return (
    <div style={{
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid rgba(196,154,60,0.18)',
      background: 'rgba(2,9,4,0.88)',
      marginBottom: '14px',
      boxShadow: '0 0 28px rgba(196,154,60,0.06)',
      position: 'relative',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid rgba(196,154,60,0.1)',
        background: 'rgba(196,154,60,0.04)',
      }}>
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {['rgba(255,90,90,0.55)', 'rgba(255,190,60,0.55)', 'rgba(46,184,122,0.55)'].map((c, i) => (
            <div key={i} style={{
              width: '8px', height: '8px', borderRadius: '2px',
              background: c, border: `1px solid ${c.replace('0.55', '0.3')}`,
            }} />
          ))}
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px',
            color: 'rgba(196,154,60,0.28)',
            marginLeft: '8px',
            letterSpacing: '0.1em',
          }}>
            {lang.toLowerCase() || 'code'}
          </span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '5px',
            color: copied ? 'rgba(46,184,122,0.84)' : 'rgba(196,154,60,0.38)',
            background: 'none',
            border: '1px solid',
            borderColor: copied ? 'rgba(46,184,122,0.28)' : 'rgba(196,154,60,0.14)',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            letterSpacing: '0.08em',
            lineHeight: 2,
          }}
          onMouseEnter={e => !copied && (e.currentTarget.style.color = 'rgba(232,197,106,0.7)')}
          onMouseLeave={e => !copied && (e.currentTarget.style.color = 'rgba(196,154,60,0.38)')}
        >
          {copied ? '✓ copiat' : '⎘ copiaza'}
        </button>
      </div>

      {/* Code body */}
      <div style={{
        padding: '16px 18px',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(196,154,60,0.1) transparent',
      }}>
        {/* Line numbers + code */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Line numbers */}
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: 'rgba(196,154,60,0.2)',
            lineHeight: 2,
            userSelect: 'none',
            flexShrink: 0,
            textAlign: 'right',
          }}>
            {code.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Divider */}
          <div style={{
            width: '1px',
            background: 'rgba(196,154,60,0.08)',
            flexShrink: 0,
          }} />

          {/* Highlighted code */}
          <pre style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '6px',
            color: 'rgba(245,228,168,0.75)',
            lineHeight: 2,
            margin: 0,
            flex: 1,
            whiteSpace: 'pre',
          }}>
            {highlight(code)}
          </pre>
        </div>
      </div>

      {/* Bottom glow accent */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(196,154,60,0.22), transparent)',
      }} />
    </div>
  )
}

export default function LessonViewer({ lesson, lessonTotal = 0, onBack, onComplete: rawOnComplete, devSkipEnabled = false, onDevSkip }: Props) {
  // Wrap completion to silence the streak nudge for today.
  const onComplete = () => {
    markLessonCompletedToday()
    rawOnComplete()
  }
  const [understandingScore, setUnderstandingScore] = useState<number | null>(null)
  const [lessonStage, setLessonStage] = useState<'lesson' | 'support'>('lesson')
  const renderableContent = getRenderableLessonContent(lesson.content)
  const lessonPending = String(lesson.content || '').includes('[[AURA_PENDING_LESSON]]')

  useEffect(() => {
    setUnderstandingScore(null)
    setLessonStage('lesson')
  }, [lesson.id])

  const currentLesson = Math.max(1, lesson.order_num)
  const totalLessons = Math.max(lessonTotal, currentLesson)
  const progressPct = totalLessons > 0 ? (currentLesson / totalLessons) * 100 : 0

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        padding: '30px 24px 48px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(196,154,60,0.1) transparent',
      }}
    >
      <div style={{ width: 'min(100%, 920px)', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: '28px' }}>
          <button
            onClick={onBack}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: ls(6),
              color: 'rgba(196,154,60,0.30)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'color 0.2s',
              letterSpacing: '0.08em',
              lineHeight: 2,
              background: 'none',
              border: 'none',
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(232,197,106,0.58)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(196,154,60,0.30)')}
          >
            ← Back to module
          </button>
          {devSkipEnabled && onDevSkip && (
            <button
              onClick={onDevSkip}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: ls(5),
                color: 'rgba(96,180,255,0.82)',
                background: 'rgba(96,180,255,0.08)',
                border: '1px solid rgba(96,180,255,0.18)',
                borderRadius: '10px',
                padding: '9px 12px',
                cursor: 'pointer',
                lineHeight: 2,
                letterSpacing: '0.06em',
              }}
            >
              DEV: SKIP LESSON
            </button>
          )}
        </div>

        <div style={{ animation: 'fadeUp 0.55s cubic-bezier(.16,1,.3,1) forwards' }}>

          <div style={{ width: 'min(100%, 620px)', margin: '0 auto 26px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              borderRadius: '999px',
              background: 'rgba(196,154,60,0.06)',
              border: '1px solid rgba(196,154,60,0.14)',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: ls(5),
              color: 'rgba(196,154,60,0.34)',
              lineHeight: 2,
              letterSpacing: '0.08em',
              marginBottom: '10px',
            }}>
              📖 LESSON {currentLesson} / {totalLessons}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(196,154,60,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, rgba(232,197,106,0.55), rgba(46,184,122,0.45))' }} />
            </div>
          </div>

          {/* Lesson header */}
          <div
            style={{
              marginBottom: '34px',
              position: 'relative',
              textAlign: 'center',
            }}
          >
          {/* Ambient glow */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '-38px',
            transform: 'translateX(-50%)',
            width: '420px',
            height: '240px',
            background: 'radial-gradient(ellipse at center, rgba(196,154,60,0.07), transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '5px',
            background: 'rgba(196,154,60,0.06)',
            border: '1px solid rgba(196,154,60,0.14)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: ls(5),
            color: 'rgba(196,154,60,0.30)',
            marginBottom: '14px',
            lineHeight: 2,
            letterSpacing: '0.08em',
          }}>
            📖 LESSON {lesson.order_num}
          </div>

          {/* Title row */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            {/* Icon */}
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '10px',
              flexShrink: 0,
              background: 'radial-gradient(circle at 40% 35%, rgba(232,197,106,0.52), rgba(196,154,60,0.16))',
              border: '1px solid rgba(232,197,106,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 0 20px rgba(196,154,60,0.24)',
              animation: 'auraPulse 3s ease-in-out infinite',
            }}>
              📖
            </div>

            <div>
              <h2 style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: ls(14),
                color: 'rgba(245,228,168,0.97)',
                letterSpacing: '0.02em',
                lineHeight: 1.8,
                textShadow: '0 0 40px rgba(196,154,60,0.18)',
                margin: 0,
              }}>
                {lesson.title}
              </h2>
            </div>
          </div>
          </div>

          {/* Content block */}
          <div style={{
            width: 'min(100%, 760px)',
            margin: '0 auto 18px',
            padding: '26px 28px',
            borderRadius: '18px',
            marginBottom: '22px',
            background: 'rgba(4,14,8,0.6)',
            border: '1px solid rgba(196,154,60,0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}
          >
            <div style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              width: '220px',
              height: '2px',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, transparent, rgba(232,197,106,0.45), transparent)',
            }} />

            <div>
              {parseContent(renderableContent).map((seg, i) => {
                if (seg.type === 'code') {
                  return <CodeBlock key={i} lang={seg.lang} code={seg.value} />
                }

                const lessonSections = parseLessonSections(seg.value)
                if (lessonSections.length > 0) {
                  return lessonSections.map((section, sectionIndex) => {
                    const tone = LESSON_SECTION_TONES[section.label]
                    const isHook = section.label === 'HOOK'

                    return (
                      <div
                        key={`${i}-section-${sectionIndex}`}
                        style={{
                          margin: '0 0 18px 0',
                          padding: section.label === 'CORE' ? '20px 20px 18px' : '18px 18px 16px',
                          borderRadius: 18,
                          background: tone.background,
                          border: `1px solid ${tone.border}`,
                          boxShadow: '0 0 28px rgba(0,0,0,0.08)',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '5px 10px',
                            borderRadius: 999,
                            marginBottom: '12px',
                            background: 'rgba(6,10,10,0.22)',
                            border: `1px solid ${tone.border}`,
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: ls(4.5),
                            color: tone.badge,
                            lineHeight: 1.9,
                            letterSpacing: '0.08em',
                          }}
                        >
                          {section.label}
                        </div>

                        {section.paragraphs.map((paragraph, paragraphIndex) => (
                          <div
                            key={`${i}-section-${sectionIndex}-paragraph-${paragraphIndex}`}
                            style={{
                              fontFamily: isHook && paragraphIndex === 0 ? READING : UI,
                              fontSize: isHook && paragraphIndex === 0 ? 24 : section.label === 'RECAP' ? 19 : 18,
                              color: tone.text,
                              lineHeight: isHook && paragraphIndex === 0 ? 1.55 : 1.68,
                              whiteSpace: 'pre-wrap',
                              textAlign: isHook && paragraphIndex === 0 ? 'center' : 'left',
                              margin: paragraphIndex === section.paragraphs.length - 1 ? 0 : '0 0 12px 0',
                            }}
                          >
                            {renderHighlightedText(paragraph, isHook && paragraphIndex === 0 ? 'display' : 'body')}
                          </div>
                        ))}
                      </div>
                    )
                  })
                }

                return buildTextBlocks(seg.value).map((block, blockIndex) => {
                  if (block.type === 'intro') {
                    return (
                      <div key={`${i}-${blockIndex}`} style={{
                        fontFamily: READING,
                        fontSize: 24,
                        color: 'rgba(245,228,168,0.84)',
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        margin: '0 0 18px 0',
                        textAlign: 'center',
                      }}>
                        {renderHighlightedText(block.value, 'display')}
                      </div>
                    )
                  }

                  if (block.type === 'callout') {
                    return (
                      <div key={`${i}-${blockIndex}`} style={{
                        margin: '0 0 18px 0',
                        padding: '16px 18px',
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, rgba(232,197,106,0.08), rgba(40,180,120,0.06))',
                        border: '1px solid rgba(196,154,60,0.12)',
                        textAlign: 'left',
                      }}>
                        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: ls(4.6), color: 'rgba(200,180,40,0.48)', lineHeight: 1.8, letterSpacing: '0.08em', marginBottom: '8px' }}>
                          ANALOGY / INTUITION
                        </div>
                        <div style={{ fontFamily: UI, fontSize: 18, color: 'rgba(235,225,205,0.8)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {renderHighlightedText(block.value)}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={`${i}-${blockIndex}`} style={{
                      fontFamily: UI,
                      fontSize: 18,
                      color: 'rgba(235,225,205,0.78)',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      margin: '0 0 16px 0',
                      textAlign: 'left',
                    }}>
                      {renderHighlightedText(block.value)}
                    </div>
                  )
                })
              })}
            </div>
          </div>

          {!lesson.completed && lessonStage === 'lesson' && !lessonPending && (
            <div style={{ width: 'min(100%, 420px)', margin: '0 auto' }}>
              <button
                onClick={() => setLessonStage('support')}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(46,184,122,0.18), rgba(232,197,106,0.14))',
                  border: '1px solid rgba(46,184,122,0.22)',
                  color: 'rgba(245,228,168,0.92)',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: ls(5),
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  lineHeight: 1.9,
                  boxShadow: '0 0 20px rgba(46,184,122,0.1)',
                }}
              >
                AM CITIT
              </button>
            </div>
          )}

          {!lesson.completed && lessonStage === 'lesson' && lessonPending && (
            <div style={{ width: 'min(100%, 520px)', margin: '0 auto', padding: '14px 16px', borderRadius: '14px', background: 'rgba(196,154,60,0.06)', border: '1px solid rgba(196,154,60,0.12)', color: 'rgba(232,197,106,0.72)', fontFamily: "'Press Start 2P', monospace", fontSize: ls(4.8), textAlign: 'center', lineHeight: 2, letterSpacing: '0.05em' }}>
              FULL LESSON IS STILL PREPARING. THE NEXT STEP UNLOCKS AUTOMATICALLY WHEN CONTENT IS READY.
            </div>
          )}

          {!lesson.completed && lessonStage === 'support' && (
            <LessonSupportPanel
              lesson={lesson}
              understandingScore={understandingScore}
              onUnderstandingScoreChange={setUnderstandingScore}
              autoGenerateFlashcards
              continueLabel="LET'S DO THE ASSIGNMENT →"
              onContinue={onComplete}
            />
          )}

          {/* Complete button */}
          <div
            style={{
              opacity: 1,
              width: 'min(100%, 580px)',
              margin: '0 auto',
            }}
          >
          {lesson.completed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '14px 20px',
                borderRadius: '10px',
                background: 'rgba(13,61,46,0.55)',
                border: '1px solid rgba(46,184,122,0.24)',
                boxShadow: '0 0 14px rgba(46,184,122,0.2)',
              }}
            >
              <span style={{ fontSize: '16px' }}>✓</span>
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: ls(6),
                color: 'rgba(46,184,122,0.94)',
                lineHeight: 2,
                letterSpacing: '0.06em',
              }}>
                Lesson completed
              </span>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}