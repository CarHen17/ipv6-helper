import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanChunkReloadParam } from "./components/ErrorBoundary";

// Apply saved theme before render to avoid flash
const savedTheme = localStorage.getItem('ipv6calc_theme');
if (savedTheme === 'dark' || savedTheme === null) {
  document.documentElement.classList.add('dark');
}

// Remove the chunk-reload marker that ErrorBoundary adds for cache-busting
cleanChunkReloadParam();

createRoot(document.getElementById("root")!).render(<App />);
