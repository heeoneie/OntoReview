import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LangContext } from '../contexts/LangContext';

export default class ErrorBoundary extends Component {
  static contextType = LangContext;

  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const { t } = this.context;
      return (
        <div className="bg-zinc-900 rounded-2xl border border-amber-900/60 p-8 text-center">
          <AlertTriangle className="text-amber-400 mx-auto mb-3" size={36} />
          <p className="text-sm text-zinc-300 mb-4">
            {t('error.message')}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            {t('error.retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
