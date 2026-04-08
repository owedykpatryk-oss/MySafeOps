const STORAGE_KEY = "mysafeops_auth_lockout_v1";
const FAILURE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;

function safeParse(json) {
  try {
    const parsed = JSON.parse(json || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readStore() {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeStore(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getAuthLockoutState(email, now = Date.now()) {
  const key = normalizeEmail(email);
  if (!key) {
    return {
      isLocked: false,
      remainingMs: 0,
      failures: 0,
      attemptsLeft: MAX_FAILURES,
    };
  }

  const store = readStore();
  const entry = store[key] || {};
  const failures = Array.isArray(entry.failures)
    ? entry.failures.filter((ts) => Number(ts) > now - FAILURE_WINDOW_MS)
    : [];
  const lockUntil = Number(entry.lockUntil || 0);
  const remainingMs = Math.max(0, lockUntil - now);
  const isLocked = remainingMs > 0;

  if (failures.length !== (entry.failures || []).length || lockUntil !== entry.lockUntil) {
    store[key] = { failures, lockUntil };
    writeStore(store);
  }

  return {
    isLocked,
    remainingMs,
    failures: failures.length,
    attemptsLeft: Math.max(0, MAX_FAILURES - failures.length),
  };
}

export function recordAuthFailure(email, now = Date.now()) {
  const key = normalizeEmail(email);
  if (!key) return getAuthLockoutState("", now);

  const store = readStore();
  const prev = store[key] || {};
  const failures = Array.isArray(prev.failures)
    ? prev.failures.filter((ts) => Number(ts) > now - FAILURE_WINDOW_MS)
    : [];
  failures.push(now);

  const shouldLock = failures.length >= MAX_FAILURES;
  const lockUntil = shouldLock ? now + LOCKOUT_MS : Number(prev.lockUntil || 0);
  store[key] = { failures, lockUntil };
  writeStore(store);
  return getAuthLockoutState(key, now);
}

export function clearAuthFailures(email) {
  const key = normalizeEmail(email);
  if (!key) return;
  const store = readStore();
  delete store[key];
  writeStore(store);
}

export function formatLockoutRemaining(ms) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

