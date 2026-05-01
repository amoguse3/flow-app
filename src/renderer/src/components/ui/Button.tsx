import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Optional leading icon node (rendered to the left of the label). */
  leading?: ReactNode
  /** Optional trailing icon node (e.g. an arrow). */
  trailing?: ReactNode
  /** Make the button fill its container width. */
  block?: boolean
}

const SIZE_STYLE: Record<Size, CSSProperties> = {
  sm: { padding: '8px 14px', fontSize: 13, borderRadius: 12, gap: 6 },
  md: { padding: '11px 18px', fontSize: 14, borderRadius: 14, gap: 8 },
  lg: { padding: '14px 22px', fontSize: 15, borderRadius: 16, gap: 10 },
}

/**
 * Single button primitive with embossed shine for primary actions.
 * - `primary` is the only variant with the accent gradient + shine sweep.
 * - `ghost` for secondary actions.
 * - `danger` for destructive actions (red tint).
 */
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', leading, trailing, block = false, className, style, children, ...rest },
  ref,
) {
  const base =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
        ? 'btn-danger'
        : 'btn-ghost'

  const composedClass = [base, className].filter(Boolean).join(' ')

  const composedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: block ? '100%' : undefined,
    ...SIZE_STYLE[size],
    ...(variant === 'danger'
      ? {
          background: 'rgba(255, 92, 92, 0.14)',
          border: '1px solid rgba(255, 92, 92, 0.32)',
          color: 'rgb(255, 168, 168)',
        }
      : null),
    ...style,
  }

  return (
    <button ref={ref} className={composedClass} style={composedStyle} {...rest}>
      {leading ? <span aria-hidden="true">{leading}</span> : null}
      <span>{children}</span>
      {trailing ? <span aria-hidden="true">{trailing}</span> : null}
    </button>
  )
})

export default Button
