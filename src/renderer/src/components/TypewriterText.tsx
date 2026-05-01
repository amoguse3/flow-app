import { useEffect, useState } from 'react'

export default function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setDisplayed('')
    setIndex(0)
  }, [text])

  useEffect(() => {
    if (index >= text.length) return undefined

    const timer = window.setTimeout(() => {
      setDisplayed(text.slice(0, index + 1))
      setIndex(index + 1)
    }, 25 + Math.random() * 20)

    return () => window.clearTimeout(timer)
  }, [index, text])

  return (
    <p
      className="aura-theme-font text-sm leading-relaxed text-left max-w-md transition-colors duration-1000"
      style={{
        color: 'var(--aura-text, rgba(255,250,235,0.9))',
        textShadow: '0 0 12px rgba(255,245,220,0.4), 0 0 30px rgba(255,240,200,0.15)',
      }}
    >
      {displayed}
      {index < text.length && (
        <span
          className="inline-block w-[2px] h-3.5 ml-0.5 align-middle"
          style={{ background: 'rgba(255,250,235,0.9)', animation: 'blink 0.8s infinite' }}
        />
      )}
    </p>
  )
}