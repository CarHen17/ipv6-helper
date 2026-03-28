import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/** Query param added to the URL before a chunk-error reload, so we don't loop. */
const CHUNK_RELOAD_PARAM = '_crld';

function alreadyReloaded(): boolean {
  try {
    return new URL(window.location.href).searchParams.has(CHUNK_RELOAD_PARAM);
  } catch {
    return false;
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunk =
      error.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error.message) ||
      /failed to fetch dynamically imported module/i.test(error.message);

    // If we've already tried a reload, don't loop — just show the error UI
    return { hasError: true, error, isChunkError: isChunk && !alreadyReloaded() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(_: Props, prev: State) {
    if (this.state.isChunkError && !prev.isChunkError) {
      // Use a cache-busting URL so the browser fetches a fresh index.html,
      // bypassing any CDN/browser cache that still has the old chunk hashes.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set(CHUNK_RELOAD_PARAM, '1');
        window.location.replace(url.toString());
      } catch {
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-secondary/50 rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" size="sm" onClick={this.handleReset} className="gap-2">
                <RotateCcw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
              <Button size="sm" onClick={() => window.location.reload()} className="gap-2">
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Call once at app startup to strip the chunk-reload marker from the URL. */
export function cleanChunkReloadParam() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(CHUNK_RELOAD_PARAM)) {
      url.searchParams.delete(CHUNK_RELOAD_PARAM);
      window.history.replaceState(null, '', url.toString());
    }
  } catch {
    // ignore
  }
}
