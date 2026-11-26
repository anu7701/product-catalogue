import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback.tsx';

/** Last-resort boundary around the whole app (ARCHITECTURE §8.2). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Visible to developers in the browser console; nothing technical is shown to customers.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}
