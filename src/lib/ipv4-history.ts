export interface IPv4HistoryEntry {
  cidr: string;
  subnetPrefix: number;
  count: number;
  timestamp: number;
}

export const IPV4_HISTORY_KEY = 'ipv4calc_history';
export const MAX_IPV4_HISTORY = 15;

export function loadIPv4History(): IPv4HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(IPV4_HISTORY_KEY) || '[]'); } catch { return []; }
}

export function saveIPv4History(h: IPv4HistoryEntry[]) {
  try { localStorage.setItem(IPV4_HISTORY_KEY, JSON.stringify(h)); } catch { /* quota */ }
}
