import React from 'react';
import { captureException } from '../utils/sentry';
import { forceRecoverFromStaleDeploy, isChunkLoadError } from '../utils/chunkError';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
  }

  handleReload = async () => {
    const chunkError = isChunkLoadError(this.state.error);
    if (chunkError) {
      this.setState({ recovering: true });
      const started = await forceRecoverFromStaleDeploy();
      if (!started) {
        this.setState({ recovering: false });
      }
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null, recovering: false });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const chunkError = isChunkLoadError(this.state.error);
      const recovering = this.state.recovering;
      const isDark = typeof document !== 'undefined'
        && document.documentElement.classList.contains('dark');

      return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">{chunkError ? '🔄' : '😕'}</div>
            <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {chunkError ? 'Update available' : 'Something went wrong'}
            </h1>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {chunkError
                ? (recovering
                  ? 'Clearing cache and loading the latest version…'
                  : 'CrwdCtrl was updated. Refresh to load the latest version.')
                : 'We\'re sorry, but something unexpected happened. Please try again.'}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40">
                <p className="text-red-400 text-sm font-mono">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-4 justify-center flex-wrap">
              <button
                type="button"
                onClick={this.handleGoHome}
                className={`px-6 py-3 rounded-lg transition ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                Go Home
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                disabled={recovering}
                className="px-6 py-3 bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 text-black font-semibold rounded-lg transition disabled:opacity-60"
              >
                {recovering ? 'Updating…' : (chunkError ? 'Refresh App' : 'Try Again')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
