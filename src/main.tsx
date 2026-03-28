import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanChunkReloadParam } from "./components/ErrorBoundary";

// Apply saved theme before render to avoid flash
const savedTheme = localStorage.getItem('ipv6calc_theme');
if (savedTheme === 'dark' || savedTheme === null) {
  document.documentElement.classList.add('dark');
}

// Successful load — reset the asset-reload retry counter so future real
// errors get their full quota of retries, and clean any cache-bust params.
try { sessionStorage.removeItem('_assetReloads'); } catch {}
cleanChunkReloadParam();

// Hide the last-resort fallback div (it only appears on failed loads).
const loadErrEl = document.getElementById('app-load-error');
if (loadErrEl) loadErrEl.style.display = 'none';

createRoot(document.getElementById("root")!).render(<App />);
