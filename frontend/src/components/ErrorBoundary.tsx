import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Catches render faults so a bug in one screen shows a readable page rather
 * than a blank document. Data errors are handled per-screen by ErrorState;
 * this is only for the unexpected.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard crashed:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <Card className="max-w-xl gap-4 p-8">
          <h1 className="text-2xl font-semibold tracking-tight">The dashboard hit an unexpected error</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            This is a bug in the interface rather than a problem with your data. The full stack trace is in the
            browser console.
          </p>
          <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4">
            <p className="text-sm font-medium text-destructive">{error.name}</p>
            <p className="mt-1 break-words text-sm text-destructive/90">{error.message}</p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
