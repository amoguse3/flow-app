import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Predefined hero sizes — keeps editorial rhythm consistent. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Apply the aurora gradient text fill. */
  gradient?: 'aurora' | 'ember' | null
  /** Tighter line-height for stacked headlines. */
  tight?: boolean
  className?: string
  style?: CSSProperties
}

const SIZE_MAP: Record<NonNullable<Props['size']>, { fontSize: string; lineHeight: number }> = {
  sm: { fontSize: 'clamp(22px, 2.4vw, 32px)', lineHeight: 1.12 },
  md: { fontSize: 'clamp(30px, 3.6vw, 48px)', lineHeight: 1.08 },
  lg: { fontSize: 'clamp(40px, 5.2vw, 72px)', lineHeight: 1.04 },
  xl: { fontSize: 'clamp(54px, 7.5vw, 110px)', lineHeight: 0.96 },
}

/**
 * Italic display serif used for hero/onboarding headlines —
 * the visual signature of the Helious / "Journey Beyond Earth" moodboard.
 */
export default function DisplayTitle({
  children,
  size = 'lg',
  gradient = null,
  tight = false,
  className,
  style,
}: Props) {
  const sized = SIZE_MAP[size]
  const gradientClass = gradient === 'aurora'
    ? 'text-gradient-aurora'
    : gradient === 'ember'
      ? 'text-gradient-ember'
      : ''
  const composedClass = ['font-display', gradientClass, className].filter(Boolean).join(' ')

  return (
    <h1
      className={composedClass}
      style={{
        fontSize: sized.fontSize,
        lineHeight: tight ? Math.max(0.92, sized.lineHeight - 0.06) : sized.lineHeight,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h1>
  )
}
