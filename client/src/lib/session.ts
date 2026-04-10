const SESSION_KEY = "chi_session_id";

function initSession(): string {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored && stored.length >= 8) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export const sessionId = initSession();
