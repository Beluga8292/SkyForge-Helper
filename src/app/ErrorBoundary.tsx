import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { DEVELOPER_TOOLS_ENABLED } from "@/version";
import { translate } from "@/locales";
import { getSettings } from "@/stores/settings";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      "[SkyForge Helper] Unhandled UI error",
      error,
      info.componentStack,
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    const language = getSettings().language;

    return (
      <div className="app-backdrop flex min-h-screen items-center justify-center p-6">
        <div className="panel w-full max-w-md p-7 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-red/25 bg-red/10 text-red">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-fg">
            {translate(language, "errors.unknown")}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
            {translate(language, "errors.recover")}
          </p>
          {DEVELOPER_TOOLS_ENABLED && (
            <pre className="mt-4 max-h-28 overflow-auto rounded-lg border border-line bg-bg-elevated p-3 text-left font-mono text-[11px] text-red/80">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-violet px-4 text-sm font-medium text-white"
          >
            <RotateCcw className="size-4" />
            {translate(language, "common.reload")}
          </button>
        </div>
      </div>
    );
  }
}
