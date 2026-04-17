import { Component } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'var(--color-bg)' }}>
          <div className="glass-card max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h2>
            <p className="text-text-muted text-sm mb-6">
              MelodAI hit an unexpected error. Your data is safe.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left mb-6">
                <summary className="text-xs text-text-muted cursor-pointer mb-2">Error details</summary>
                <pre className="text-[10px] text-red-400 bg-surface-overlay rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { this.setState({ error: null, errorInfo: null }) }}
                className="btn-ghost flex-1 flex items-center justify-center gap-2 border border-surface-border"
              >
                <RefreshCw size={14} /> Try again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="btn-primary flex-1"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
