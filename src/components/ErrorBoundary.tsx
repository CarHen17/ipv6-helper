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

const CHUNK_RELOAD_KEY = '_chunkReload';

/** Returns true if we already attempted a chunk-error reload this session. */
function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
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

    // If we've already tried a reload this session, don't loop — show error UI
    return { hasError: true, error, isChunkError: isChunk && !alreadyReloaded() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(_: Props, prev: State) {
    if (this.state.isChunkError && !prev.isChunkError) {
      // Mark that we've attempted a chunk reload so we don't loop.
      // Use sessionStorage (survives location.replace in the same tab) instead
      // of a URL param — URL params can be cached by CDNs and served stale.
      try { sessionStorage.setItem(CHUNK_RELOAD_KEY, '1'); } catch {}
      // Add unique timestamp → CDN treats it as a fresh request for index.html.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('_v', Date.now().toString(36));
        url.searchParams.delete('_crld');
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

/** Call once at app startup to strip cache-bust params from the URL bar. */
export function cleanChunkReloadParam() {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.has('_crld')) { url.searchParams.delete('_crld'); changed = true; }
    if (url.searchParams.has('_v'))    { url.searchParams.delete('_v');    changed = true; }
    if (changed) window.history.replaceState(null, '', url.toString());
    // Clear the chunk-reload flag now that the app loaded successfully
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // ignore
  }
}
