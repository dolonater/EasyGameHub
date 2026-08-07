import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { reportError } from "./loader";

interface Props {
  pluginId: string;
  children: ReactNode;
}

interface State {
  error: string | null;
}

/// Contain plugin render errors so a broken plugin cannot crash the app.
export default class PluginErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(e: unknown): State {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    void reportError(this.props.pluginId, error);
    console.error(`[plugin:${this.props.pluginId}] render error:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-2 text-xs text-red-500 border border-red-500/30 rounded">
          Plugin render error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
