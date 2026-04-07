'use client'

import React from 'react'

type WidgetErrorBoundaryProps = {
  children: React.ReactNode
  title?: string
}

type WidgetErrorBoundaryState = {
  hasError: boolean
}

export class WidgetErrorBoundary extends React.Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('Widget render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="sc min-h-[180px] flex items-center justify-center text-center">
          <p className="text-[12px] text-[#f87171]">
            {this.props.title ?? 'Widget'} failed to render.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

export default WidgetErrorBoundary
