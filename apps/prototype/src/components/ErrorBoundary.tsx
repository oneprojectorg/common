import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * PROTOTYPE ONLY.
 *
 * Stands in for the app's boundary, minus the analytics reporting — a prototype
 * has nowhere to report to. It still exists so one broken subtree can't take the
 * whole page down mid-demo, which is the part that matters here.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The console is the only sink a single-file prototype has.
    console.error('Prototype: a subtree failed to render', error, info);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
