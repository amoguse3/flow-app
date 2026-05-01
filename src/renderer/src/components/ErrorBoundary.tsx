import { Component, type ReactNode } from 'react'
import { t as translate, DEFAULT_LANGUAGE, type AppLanguage } from '../../../../shared/i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  lang: AppLanguage
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, lang: DEFAULT_LANGUAGE }

  componentDidMount(): void {
    void window.aura?.profile?.get?.()
      .then((profile) => {
        if (!profile?.language || !['en', 'ru', 'ro'].includes(profile.language)) return
        this.setState({ lang: profile.language as AppLanguage })
      })
      .catch(() => undefined)
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      const tr = (key: string, params?: Record<string, string | number>) => translate(key, this.state.lang, params)

      return (
        <div className="h-full flex items-center justify-center" style={{ background: '#080606' }}>
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl max-w-md text-center"
            style={{ background: 'rgba(15,10,10,0.95)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="text-3xl">⚠️</div>
            <h2 className="text-sm font-medium" style={{ color: 'rgba(239,68,68,0.8)' }}>
              {tr('errorBoundary.title')}
            </h2>
            <p className="text-xs" style={{ color: 'rgba(200,160,140,0.4)' }}>
              {this.state.error?.message || tr('errorBoundary.unknown')}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105"
              style={{
                background: 'rgba(217,119,6,0.15)',
                border: '1px solid rgba(217,119,6,0.25)',
                color: '#d97706'
              }}>
              {tr('errorBoundary.retry')}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
