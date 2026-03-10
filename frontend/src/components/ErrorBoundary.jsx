import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
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
      return (
        <div className="bg-zinc-900 rounded-2xl border border-red-900/60 p-8 text-center">
          <AlertTriangle className="text-red-400 mx-auto mb-3" size={36} />
          <p className="text-sm text-zinc-300 mb-4">
            {this.props.message || '일시적인 문제가 발생했습니다. 다시 시도해주세요.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
