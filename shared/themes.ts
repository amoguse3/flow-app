// ─── Theme system ──────────────────────────────────────────────────────────
// Each theme controls: font family, background style, orb tint, accent color.
// User can also override orb-glow, orb-opacity, bg-opacity, custom PNG uploads.

export type ThemeId =
  | 'cosmos'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'retro'
  | 'minimal'
  | 'sakura'

export type BackgroundMode = 'cosmos' | 'solid' | 'gradient' | 'image'

export interface ThemeDef {
  id: ThemeId
  name: string
  emoji: string
  /** Primary font stack used across the app chrome. */
  fontFamily: string
  /** Pixel-display font used for labels/buttons (keep tiny). */
  pixelFont: string
  /** Accent used for button borders, orb highlight, focus glow. */
  accent: string
  /** 0–1 rgba channel for the accent. */
  accentRgb: string
  /** What drives the background layer. */
  background:
    | { mode: 'cosmos' }
    | { mode: 'solid'; color: string }
    | { mode: 'gradient'; css: string }
    | { mode: 'image'; src: string }
  /** Optional orb tint hex used when there's no custom orb PNG. */
  orbTint?: string
  /** Optional text color override for typewriter body. */
  textColor?: string
}

export interface ThemeOverrides {
  /** 0–1. Multiplies orb drop-shadow intensity. 0 = no glow, 1 = default, 1.5 = extra. */
  orbGlow: number
  /** 0–1. Orb opacity. */
  orbOpacity: number
  /** 0–1. Background opacity (dimming the bg). */
  bgOpacity: number
  /** Optional font override (user pick from presets). */
  fontOverride?: string | null
  /** Base64 data URL for a user-uploaded background PNG. */
  customBgDataUrl?: string | null
  /** Base64 data URL for a user-uploaded orb PNG. */
  customOrbDataUrl?: string | null
}

export const DEFAULT_OVERRIDES: ThemeOverrides = {
  orbGlow: 1,
  orbOpacity: 1,
  bgOpacity: 1,
  fontOverride: null,
  customBgDataUrl: null,
  customOrbDataUrl: null,
}

export const FONT_PRESETS: Array<{ id: string; label: string; stack: string }> = [
  { id: 'georgia',  label: 'Georgia',     stack: "Georgia, 'Times New Roman', serif" },
  { id: 'pixel',    label: 'Pixel',       stack: "'Press Start 2P', monospace" },
  { id: 'mono',     label: 'Mono',        stack: "'JetBrains Mono', 'Courier New', monospace" },
  { id: 'sans',     label: 'Sans',        stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'serif',    label: 'Serif',       stack: "'Iowan Old Style', 'Apple Garamond', Baskerville, serif" },
  { id: 'rounded',  label: 'Rotund',      stack: "'Nunito', 'Quicksand', system-ui, sans-serif" },
]

export const THEMES: Record<ThemeId, ThemeDef> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    emoji: '🌌',
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#C8A3FF',
    accentRgb: '200,163,255',
    background: { mode: 'cosmos' },
    orbTint: '#C8A3FF',
    textColor: 'rgba(245,237,225,0.92)',
  },
  sunset: {
    id: 'sunset',
    name: 'Apus',
    emoji: '🌅',
    fontFamily: "'Inter', system-ui, sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#FF8E5A',
    accentRgb: '255,142,90',
    background: {
      mode: 'gradient',
      css: 'linear-gradient(180deg, #1A0A14 0%, #2A0E1B 25%, #5A2620 55%, #B05A3A 85%, #FFB07A 100%)',
    },
    orbTint: '#FFB07A',
    textColor: 'rgba(255,240,225,0.94)',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    fontFamily: "'Inter', system-ui, sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#5DCFFF',
    accentRgb: '93,207,255',
    background: {
      mode: 'gradient',
      css: 'radial-gradient(ellipse at 50% 25%, #0A2E45 0%, #051828 45%, #02080F 100%)',
    },
    orbTint: '#5DCFFF',
    textColor: 'rgba(225,242,255,0.94)',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    fontFamily: "'Inter', system-ui, sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#9DE07A',
    accentRgb: '157,224,122',
    background: {
      mode: 'gradient',
      css: 'radial-gradient(ellipse at 40% 35%, #15281C 0%, #0A1810 55%, #020806 100%)',
    },
    orbTint: '#9DE07A',
    textColor: 'rgba(228,242,224,0.94)',
  },
  retro: {
    id: 'retro',
    name: 'Retro',
    emoji: '🕹️',
    /* Retro is the only theme that *celebrates* the pixel font. */
    fontFamily: "'Press Start 2P', monospace",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#FF6CC9',
    accentRgb: '255,108,201',
    background: {
      mode: 'gradient',
      css: 'linear-gradient(180deg, #0B0320 0%, #1A0540 40%, #3A0F60 70%, #B83A8E 100%)',
    },
    orbTint: '#FF6CC9',
    textColor: 'rgba(255,225,242,0.94)',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    emoji: '◻️',
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#D4D4D8',
    accentRgb: '212,212,216',
    background: { mode: 'solid', color: '#08070C' },
    orbTint: '#E4E4E7',
    textColor: 'rgba(232,232,236,0.94)',
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    emoji: '🌸',
    fontFamily: "'Inter', system-ui, sans-serif",
    pixelFont: "'Press Start 2P', monospace",
    accent: '#FFB6D9',
    accentRgb: '255,182,217',
    background: {
      mode: 'gradient',
      css: 'radial-gradient(ellipse at 40% 25%, #2A0E1F 0%, #18081A 50%, #08020E 100%)',
    },
    orbTint: '#FFB6D9',
    textColor: 'rgba(255,228,242,0.94)',
  },
}

export const THEME_LIST: ThemeDef[] = Object.values(THEMES)

export function getTheme(id: ThemeId | string | null | undefined): ThemeDef {
  if (id && (THEMES as Record<string, ThemeDef>)[id]) {
    return (THEMES as Record<string, ThemeDef>)[id]
  }
  return THEMES.cosmos
}
