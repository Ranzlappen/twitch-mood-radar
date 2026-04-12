// localStorage wrapper with consistent error handling
export function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function loadRaw(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : (fallback ?? null);
  } catch { return fallback ?? null; }
}

export function saveRaw(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}
