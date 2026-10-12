const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 8;

const hits = new Map<string, { count: number; until: number }>();

export function loginBlocked(key: string, now = Date.now()) {
  const row = hits.get(key);
  if (!row || row.until <= now) return false;
  return row.count >= LIMIT;
}

export function loginFailed(key: string, now = Date.now()) {
  const row = hits.get(key);
  if (!row || row.until <= now) {
    hits.set(key, { count: 1, until: now + WINDOW_MS });
    return;
  }
  row.count += 1;
}

export function resetLoginLimit() {
  hits.clear();
}
