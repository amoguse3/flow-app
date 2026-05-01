import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'

type Tone = 'sm' | 'md' | 'hi'

interface Props extends HTMLAttributes<HTMLDivElement> {
  /**
   * Glass intensity:
   * - `sm` — subtle (panels nested inside other panels)
   * - `md` — default (modals, side cards)
   * - `hi` — heavy (full-screen sheets, settings dialog)
   */
  tone?: Tone
  /** Adds a soft accent halo around the card. */
  glow?: boolean
  /** Soft rounded corners variant. Defaults to `lg` (20px). */
  radius?: 'md' | 'lg' | 'xl' | 'pill'
  children: ReactNode
}

const RADIUS_MAP: Record<NonNullable<Props['radius']>, string> = {
  md: '14px',
  lg: '20px',
  xl: '28px',
  pill: '999px',
}

/**
 * iOS 18 / visionOS-style frosted glass surface.
 * Wraps any panel-like UI in a single, consistent container so we can stop
 * inlining `rgba(...) + backdrop-filter` on every component.
 */
const GlassCard = forwardRef<HTMLDivElement, Props>(function GlassCard(
  { tone = 'md', glow = false, radius = 'lg', className, style, children, ...rest },
  ref,
) {
  const baseClass = `glass-${tone}`
  const composedClass = className ? `${baseClass} ${className}` : baseClass

  const composedStyle: CSSProperties = {
    borderRadius: RADIUS_MAP[radius],
    ...(glow
      ? {
          boxShadow:
            'inset 0 1px 0 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(var(--aura-accent-rgb,255,142,90),0.18), 0 24px 60px -18px rgba(0,0,0,0.6), 0 0 80px -20px rgba(var(--aura-accent-rgb,255,142,90),0.35)',
        }
      : null),
    ...style,
  }

  return (
    <div ref={ref} className={composedClass} style={composedStyle} {...rest}>
      {children}
    </div>
  )
})

export default GlassCard
