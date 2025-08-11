import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { ErrorMessage } from './ErrorMessage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      return <div>{fallback ?? <ErrorMessage />}</div>;
    }

    return children;
  }
}

export default ErrorBoundary;
