import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { t as translate, type AppLanguage, DEFAULT_LANGUAGE, LANGUAGE_OPTIONS } from '../../../../shared/i18n'

const LANG_KEY = 'wispucci_language'

interface LanguageCtx {
  lang: AppLanguage
  setLang: (l: AppLanguage) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageCtx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY)
      if (stored && ['en', 'ru', 'ro'].includes(stored)) return stored as AppLanguage
    } catch { /* ignore */ }
    return DEFAULT_LANGUAGE
  })

  const setLang = useCallback((l: AppLanguage) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ }
    // Sync with user profile in the active runtime.
    void window.aura?.profile?.get?.()
      .then((profile) => {
        if (!profile) return
        return window.aura.profile.save({ ...profile, language: l })
      })
      .catch(() => undefined)
  }, [])

  // On mount, sync from user profile if available
  useEffect(() => {
    void window.aura?.profile?.get?.()
      .then((profile) => {
        if (profile?.language && ['en', 'ru', 'ro'].includes(profile.language)) {
          setLangState(profile.language as AppLanguage)
          try { localStorage.setItem(LANG_KEY, profile.language) } catch { /* ignore */ }
        }
      })
      .catch(() => { /* ignore */ })
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, lang, params),
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageCtx {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

export { LANGUAGE_OPTIONS }
export type { AppLanguage }
