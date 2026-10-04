import type { AppState } from "./types";

const KEY = "tefu.investment.user.v1";
const SESSION = "tefu.session";

export function freshState(): AppState {
  return {
    users: [],
    currentUserId: null,
    currentSessionId: null,
    pending2faUserId: null,
    passwordResetUserId: null,
    challenges: [],
    fees: [],
    transactions: [],
    deposits: [],
    withdrawals: [],
    holdings: [],
    distributions: [],
    acceptances: [],
    documents: [],
    notifications: [],
    tickets: [],
    sessions: [],
    loginAttempts: {},
  };
}

export function loadState() {
  const blank = freshState();
  let state = blank;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.users)) state = { ...blank, ...parsed };
    }
  } catch {
    state = blank;
  }
  const sid = sessionStorage.getItem(SESSION);
  const session = sid ? state.sessions.find((item) => item.id === sid && item.expiresAt > Date.now()) : undefined;
  if (!session) {
    state.currentUserId = null;
    state.currentSessionId = null;
  } else {
    state.currentSessionId = session.id;
    state.currentUserId = session.userId;
  }
  return state;
}

export function persist(state: AppState) {
  const save = (value: AppState) => localStorage.setItem(KEY, JSON.stringify(value));
  try {
    save(state);
  } catch {
    const slim = structuredClone(state);
    for (const doc of slim.documents) doc.dataUrl = null;
    for (const user of slim.users) user.profile.photo = null;
    save(slim);
  }
}

export function syncSession(state: AppState) {
  if (state.currentSessionId) sessionStorage.setItem(SESSION, state.currentSessionId);
  else sessionStorage.removeItem(SESSION);
}
