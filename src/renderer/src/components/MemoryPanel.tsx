import { useEffect, useMemo, useState } from 'react'
import type { MemoryRecord, MemoryKind } from '../../../../shared/types'
import { useLanguage } from '../contexts/LanguageContext'

type TabKind = 'all' | MemoryKind

const KIND_LABELS: Record<MemoryKind, { labelKey: string; hintKey: string; color: string }> = {
  semantic: {
    labelKey: 'memory.stable',
    hintKey: 'memory.stableHint',
    color: 'rgba(150,220,190,0.7)',
  },
  episodic: {
    labelKey: 'memory.moments',
    hintKey: 'memory.momentsHint',
    color: 'rgba(232,197,106,0.7)',
  },
  working: {
    labelKey: 'memory.session',
    hintKey: 'memory.sessionHint',
    color: 'rgba(180,160,240,0.7)',
  },
}

const TAG_EMOJI: Record<string, string> = {
  win:       '🏆',
  struggle:  '🌧️',
  goal:      '🎯',
  fact:      '📌',
  preference:'❤️',
  learning:  '🧠',
}

export default function MemoryPanel() {
  const { t: tl } = useLanguage()
  const [all, setAll] = useState<MemoryRecord[]>([])
  const [tab, setTab] = useState<TabKind>('all')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newKind, setNewKind] = useState<MemoryKind>('semantic')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const reload = () => {
    setLoading(true)
    window.aura.memory.list()
      .then(rows => setAll(rows || []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // GC pass — promote/drop stale working memories on panel open
    window.aura.memory.decay().catch(() => {})
  }, [])

  const visible = tab === 'all' ? all : all.filter(m => m.kind === tab)
  const selectedMemory = useMemo(() => {
    if (visible.length === 0) return null
    return visible.find((memory) => memory.id === selectedId) || visible[0]
  }, [selectedId, visible])

  useEffect(() => {
    if (visible.length === 0) {
      setSelectedId(null)
      return
    }
    if (!visible.some((memory) => memory.id === selectedId)) {
      setSelectedId(visible[0].id)
    }
  }, [selectedId, visible])

  const handleAdd = async () => {
    const txt = newText.trim()
    if (!txt) return
    await window.aura.memory.add(txt, newKind, null, 4).catch(() => null)
    setNewText('')
    setAdding(false)
    reload()
  }

  const handleDelete = async (id: number) => {
    await window.aura.memory.remove(id).catch(() => null)
    setAll(prev => prev.filter(m => m.id !== id))
    setSelectedId(prev => (prev === id ? null : prev))
  }

  const counts: Record<MemoryKind | 'all', number> = {
    all: all.length,
    semantic: all.filter(m => m.kind === 'semantic').length,
    episodic: all.filter(m => m.kind === 'episodic').length,
    working: all.filter(m => m.kind === 'working').length,
  }

  return (
    <div className="h-full flex flex-col" style={{ color: 'rgba(230,200,190,0.9)' }}>
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] tracking-[0.3em] uppercase" style={{
            color: 'rgba(150,220,190,0.55)',
            fontFamily: "'Press Start 2P', monospace",
          }}>{tl('memory.tagline')}</span>
        </div>
        <h2 className="text-xl mb-2" style={{ fontFamily: 'Georgia, serif' }}>{tl('memory.title')}</h2>
        <p className="text-xs leading-relaxed max-w-md" style={{ color: 'rgba(200,160,140,0.55)' }}>
          {tl('memory.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="px-8 flex items-center gap-2 shrink-0 flex-wrap">
        {(['all', 'semantic', 'episodic', 'working'] as TabKind[]).map(t => {
          const active = tab === t
          const label = t === 'all' ? tl('memory.all') : tl(KIND_LABELS[t].labelKey)
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: active ? 'rgba(150,220,190,0.14)' : 'rgba(26,23,20,0.5)',
                border: `1px solid ${active ? 'rgba(150,220,190,0.38)' : 'rgba(42,37,32,0.5)'}`,
                color: active ? 'rgba(150,220,190,0.95)' : 'rgba(200,160,140,0.5)',
              }}
            >
              {label} <span className="opacity-50 ml-1">{counts[t]}</span>
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          onClick={() => setAdding(v => !v)}
          className="px-3 py-1.5 rounded-lg text-xs transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(217,119,6,0.1))',
            border: '1px solid rgba(217,119,6,0.3)',
            color: '#fef3c7',
          }}
        >
          {adding ? tl('common.cancel') : tl('memory.add')}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="mx-8 mt-3 p-3 rounded-xl shrink-0" style={{
          background: 'rgba(10,6,6,0.6)',
          border: '1px solid rgba(217,119,6,0.2)',
          animation: 'memPanelIn 0.3s ease',
        }}>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder={tl('memory.placeholder')}
            rows={2}
            autoFocus
            className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-white/15"
            style={{ color: 'rgba(230,200,190,0.9)' }}
          />
          <div className="flex items-center gap-2 mt-2">
            {(['semantic', 'episodic', 'working'] as MemoryKind[]).map(k => (
              <button
                key={k}
                onClick={() => setNewKind(k)}
                className="px-2.5 py-1 rounded-md text-[10px] tracking-wide uppercase transition-all"
                style={{
                  background: newKind === k ? `${KIND_LABELS[k].color.replace('0.7', '0.2')}` : 'rgba(42,37,32,0.4)',
                  border: `1px solid ${newKind === k ? KIND_LABELS[k].color.replace('0.7', '0.4') : 'rgba(42,37,32,0.5)'}`,
                  color: newKind === k ? KIND_LABELS[k].color : 'rgba(200,160,140,0.45)',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8,
                }}
              >
                {tl(KIND_LABELS[k].labelKey)}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={handleAdd}
              disabled={!newText.trim()}
              className="px-3 py-1 rounded-md text-xs transition-all"
              style={{
                background: newText.trim() ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(42,37,32,0.3)',
                color: newText.trim() ? '#fff' : 'rgba(200,160,140,0.3)',
                opacity: newText.trim() ? 1 : 0.5,
              }}
            >
              {tl('memory.remember')}
            </button>
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(200,160,140,0.35)' }}>
            {tl(KIND_LABELS[newKind].hintKey)}
          </p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-8 py-4 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full" style={{
              background: 'radial-gradient(circle, rgba(150,220,190,0.4), transparent 70%)',
              animation: 'memPulse 2s ease-in-out infinite',
            }} />
          </div>
        ) : visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-full mb-4 opacity-40" style={{
              background: 'radial-gradient(circle at 40% 35%, rgba(255,250,235,0.85), rgba(255,240,200,0.3) 60%, transparent 100%)',
              animation: 'memPulse 3s ease-in-out infinite',
            }} />
            <p className="text-sm mb-1" style={{ color: 'rgba(200,160,140,0.65)' }}>
              {tab === 'all' ? 'I don\'t remember anything yet.' : 'Nothing in this category.'}
            </p>
            <p className="text-xs max-w-xs" style={{ color: 'rgba(200,160,140,0.4)' }}>
              As we talk, I\'ll note what matters. Or add manually above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedMemory && (
              <div
                className="rounded-2xl px-4 py-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(232,197,106,0.12), rgba(26,23,20,0.82))',
                  border: '1px solid rgba(232,197,106,0.28)',
                  boxShadow: '0 0 22px rgba(232,197,106,0.12)',
                }}
              >
                <div className="flex items-center gap-2 mb-2 text-[10px]" style={{ color: 'rgba(232,197,106,0.72)' }}>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, letterSpacing: '0.12em' }}>
                    TEXT COMPLET
                  </span>
                  <span>·</span>
                  <span>{formatTimeAgo(selectedMemory.created_at)}</span>
                </div>
                <p className="text-sm leading-relaxed break-words" style={{ color: 'rgba(250,238,210,0.92)' }}>
                  {selectedMemory.content}
                </p>
              </div>
            )}

            <div className="space-y-2">
            {visible.map((m, idx) => (
              <div
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedId(m.id)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedMemory?.id === m.id}
                className="group relative rounded-xl px-4 py-3 transition-all"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: selectedMemory?.id === m.id ? 'rgba(232,197,106,0.1)' : 'rgba(26,23,20,0.6)',
                  border: `1px solid ${selectedMemory?.id === m.id ? 'rgba(232,197,106,0.34)' : KIND_LABELS[m.kind].color.replace('0.7', '0.2')}`,
                  boxShadow: selectedMemory?.id === m.id ? '0 0 16px rgba(232,197,106,0.12)' : 'none',
                  animation: `memPanelIn 0.35s cubic-bezier(.16,1,.3,1) ${idx * 0.02}s both`,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5 text-base">
                    {m.tag && TAG_EMOJI[m.tag] ? TAG_EMOJI[m.tag] : '·'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed break-words" style={{ color: 'rgba(230,200,190,0.9)' }}>
                      {previewMemory(m.content)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: 'rgba(200,160,140,0.4)' }}>
                      <span
                        className="uppercase tracking-wider"
                        style={{
                          color: KIND_LABELS[m.kind].color,
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 7,
                        }}
                      >
                        {tl(KIND_LABELS[m.kind].labelKey)}
                      </span>
                      <span>·</span>
                      <span>{formatTimeAgo(m.created_at)}</span>
                      {m.importance >= 4 && (
                        <>
                          <span>·</span>
                          <span style={{ color: 'rgba(251,191,36,0.5)' }}>
                            {'★'.repeat(Math.min(5, m.importance))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDelete(m.id)
                    }}
                    title="Forget this"
                    className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                    style={{ color: 'rgba(200,160,140,0.5)', fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes memPanelIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes memPulse {
          0%,100% { opacity: 0.5; transform: scale(1); }
          50%     { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}

function previewMemory(content: string): string {
  const clean = content.replace(/\s+/g, ' ').trim()
  if (clean.length <= 96) return clean
  return `${clean.slice(0, 96).trimEnd()}...`
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso.replace(' ', 'T')).getTime()
  if (Number.isNaN(then)) return iso
  const diff = Date.now() - then
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}
