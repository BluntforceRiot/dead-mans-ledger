export interface HighScoreEntry {
  initials: string;
  score: number;
  journey: number;
  date: string;
}

export const HIGH_SCORE_KEY = 'dead-mans-ledger.highScores.v1';

export function getHighScores(): HighScoreEntry[] {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as HighScoreEntry[];
    return parsed
      .filter((entry) => entry.initials && Number.isFinite(entry.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function saveHighScore(entry: HighScoreEntry) {
  const next = [...getHighScores(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
  window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(next));
  return next;
}

export function clearHighScores() {
  window.localStorage.removeItem(HIGH_SCORE_KEY);
}
