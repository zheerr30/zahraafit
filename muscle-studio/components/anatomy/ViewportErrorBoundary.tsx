"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { IconWarning } from "@/components/ui/icons";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

/** Contains WebGL / Three.js render errors so the rest of the editor keeps working. */
export class ViewportErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[muscle-studio] viewport crashed", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-line bg-panel p-6 text-center">
          <IconWarning className="mx-auto mb-3 text-warn" size={28} />
          <h2 className="text-base font-semibold">The 3D viewport stopped working</h2>
          <p className="mt-2 text-sm text-muted">{this.state.error.message}</p>
          <p className="mt-2 text-xs text-muted">
            Your project data is safe. Restart the viewport, or reload the page if the problem persists.
          </p>
          <Button variant="primary" className="mt-4" onClick={this.reset}>
            Restart viewport
          </Button>
        </div>
      </div>
    );
  }
}
