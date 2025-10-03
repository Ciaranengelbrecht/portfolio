import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully.
 * Prevents the entire app from crashing when a component throws an error.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    this.setState({
      error,
      errorInfo,
    });

    // Here you could also log to an error reporting service
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
            </div>

            <p className="text-slate-300 mb-6 leading-relaxed">
              The app encountered an unexpected error. Don't worry - your data is safe. 
              Try refreshing the page or resetting the component.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors">
                  Error Details (Development Only)
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-mono text-red-400 break-all">
                    {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <div className="text-xs font-mono text-slate-500 max-h-40 overflow-y-auto">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-emerald-600/20"
              >
                Refresh Page
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 active:scale-95"
              >
                Try Again
              </button>
            </div>

            <p className="mt-6 text-xs text-slate-500 text-center">
              If this problem persists, please try clearing your browser cache
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
