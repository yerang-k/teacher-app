import React from "react";

interface State {
  hasError: boolean;
  error?: Error;
}

interface Props {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("앱 에러:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center p-6">
          <div className="max-w-md space-y-3 text-center">
            <h1 className="text-2xl font-bold">문제가 발생했습니다</h1>
            <p className="text-sm text-muted-foreground">
              앱에서 오류가 발생했습니다. 새로고침해도 같은 문제가 계속되면 개발자에게 문의해주세요.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-muted p-2 rounded overflow-auto">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded bg-primary text-primary-foreground"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
