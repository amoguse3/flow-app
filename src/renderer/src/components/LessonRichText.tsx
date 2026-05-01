import { Fragment } from 'react'

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

interface Props {
  content: string
  variant?: 'teacher' | 'bubble'
}

const READING = "'Palatino Linotype', 'Book Antiqua', Georgia, serif"
const UI = "'Trebuchet MS', 'Segoe UI', sans-serif"
const PX = "'Press Start 2P', monospace"
const LESSON_SECTION_PATTERN = /^(HOOK|CORE|PROVE IT|RECAP|CLIFFHANGER):\s*(.*)$/i

const SECTION_TONES: Record<LessonSectionLabel, { background: string; border: string; badge: string; text: string }> = {
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
  return /analogi|imagin|gandeste|intu|pe scurt|altfel spus|ca si cum|as if|in short|analogy|example|exemplu/.test(normalized)
}

function buildTextBlocks(raw: string): TextBlock[] {
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((part) => part.trim())
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

  return normalized.length >= 2 ? normalized : []
}

function renderHighlightedText(value: string, tone: 'display' | 'body') {
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

export default function LessonRichText({ content, variant = 'teacher' }: Props) {
  const bubble = variant === 'bubble'

  return (
    <div style={{ display: 'grid', gap: bubble ? 10 : 16 }}>
      {parseContent(content).map((segment, segmentIndex) => {
        if (segment.type === 'code') {
          return (
            <pre
              key={`code-${segmentIndex}`}
              style={{
                margin: 0,
                padding: bubble ? '12px 14px' : '16px 18px',
                borderRadius: 16,
                background: 'rgba(2,9,4,0.72)',
                border: '1px solid rgba(196,154,60,0.12)',
                color: 'rgba(245,228,168,0.82)',
                fontFamily: "'Cascadia Mono', 'Consolas', monospace",
                fontSize: bubble ? 12 : 15,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                textAlign: 'left',
              }}
            >
              {segment.value}
            </pre>
          )
        }

        const sections = parseLessonSections(segment.value)
        if (sections.length > 0) {
          return sections.map((section, sectionIndex) => {
            const tone = SECTION_TONES[section.label]
            const isHook = section.label === 'HOOK'

            return (
              <div
                key={`section-${segmentIndex}-${sectionIndex}`}
                style={{
                  padding: bubble ? '14px 14px 12px' : section.label === 'CORE' ? '20px 20px 18px' : '18px 18px 16px',
                  borderRadius: 18,
                  background: tone.background,
                  border: `1px solid ${tone.border}`,
                  boxShadow: bubble ? 'none' : '0 0 28px rgba(0,0,0,0.08)',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: bubble ? '4px 8px' : '5px 10px',
                    borderRadius: 999,
                    marginBottom: '12px',
                    background: 'rgba(6,10,10,0.22)',
                    border: `1px solid ${tone.border}`,
                    fontFamily: PX,
                    fontSize: bubble ? 4.2 : 4.5,
                    color: tone.badge,
                    lineHeight: 1.9,
                    letterSpacing: '0.08em',
                  }}
                >
                  {section.label}
                </div>

                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <div
                    key={`paragraph-${segmentIndex}-${sectionIndex}-${paragraphIndex}`}
                    style={{
                      fontFamily: isHook && paragraphIndex === 0 ? READING : UI,
                      fontSize: bubble ? (isHook && paragraphIndex === 0 ? 15 : section.label === 'RECAP' ? 13.5 : 13) : (isHook && paragraphIndex === 0 ? 24 : section.label === 'RECAP' ? 19 : 18),
                      color: tone.text,
                      lineHeight: isHook && paragraphIndex === 0 ? 1.55 : 1.68,
                      whiteSpace: 'pre-wrap',
                      textAlign: isHook && paragraphIndex === 0 && !bubble ? 'center' : 'left',
                      maxWidth: bubble ? undefined : isHook && paragraphIndex === 0 ? 620 : 640,
                      margin: paragraphIndex === section.paragraphs.length - 1 ? (bubble ? 0 : (isHook && paragraphIndex === 0 ? '0 auto' : 0)) : (bubble ? '0 0 10px 0' : isHook && paragraphIndex === 0 ? '0 auto 12px' : '0 0 12px 0'),
                    }}
                  >
                    {renderHighlightedText(paragraph, isHook && paragraphIndex === 0 ? 'display' : 'body')}
                  </div>
                ))}
              </div>
            )
          })
        }

        return buildTextBlocks(segment.value).map((block, blockIndex) => {
          if (block.type === 'intro') {
            return (
              <div
                key={`intro-${segmentIndex}-${blockIndex}`}
                style={{
                  fontFamily: READING,
                  fontSize: bubble ? 15 : 24,
                  color: 'rgba(245,228,168,0.84)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  textAlign: bubble ? 'left' : 'center',
                  maxWidth: bubble ? undefined : 620,
                  margin: bubble ? 0 : '0 auto',
                }}
              >
                {renderHighlightedText(block.value, 'display')}
              </div>
            )
          }

          if (block.type === 'callout') {
            return (
              <div
                key={`callout-${segmentIndex}-${blockIndex}`}
                style={{
                  padding: bubble ? '12px 14px' : '16px 18px',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(232,197,106,0.08), rgba(40,180,120,0.06))',
                  border: '1px solid rgba(196,154,60,0.12)',
                }}
              >
                <div style={{ fontFamily: PX, fontSize: bubble ? 4.1 : 4.3, color: 'rgba(200,180,40,0.46)', lineHeight: 1.8, letterSpacing: '0.08em', marginBottom: 8 }}>
                  ANALOGY / EXPLANATION
                </div>
                <div style={{ fontFamily: UI, fontSize: bubble ? 13 : 18, color: 'rgba(235,225,205,0.8)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {renderHighlightedText(block.value, 'body')}
                </div>
              </div>
            )
          }

          return (
            <div
              key={`body-${segmentIndex}-${blockIndex}`}
              style={{
                fontFamily: UI,
                fontSize: bubble ? 13 : 18,
                color: 'rgba(220,230,210,0.8)',
                lineHeight: 1.68,
                whiteSpace: 'pre-wrap',
                textAlign: 'left',
                maxWidth: bubble ? undefined : 640,
                margin: bubble ? 0 : '0 auto',
              }}
            >
              {renderHighlightedText(block.value, 'body')}
            </div>
          )
        })
      })}
    </div>
  )
}