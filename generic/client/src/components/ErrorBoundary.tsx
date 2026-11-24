import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@databricks/appkit-ui/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error details:', errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background p-4">
          <Card className="max-w-2xl mx-auto mt-8">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="text-destructive">
                Application Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold mb-2">Error Message:</h2>
                  <pre className="bg-muted p-3 rounded text-sm overflow-auto">{this.state.error?.toString()}</pre>
                </div>
                {this.state.errorInfo && (
                  <div>
                    <h2 className="font-semibold mb-2">Component Stack:</h2>
                    <pre className="bg-muted p-3 rounded text-sm overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
                {this.state.error?.stack && (
                  <div>
                    <h2 className="font-semibold mb-2">Stack Trace:</h2>
                    <pre className="bg-muted p-3 rounded text-sm overflow-auto max-h-96">{this.state.error.stack}</pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
