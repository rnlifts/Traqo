// Client-side "clipboard" for copying exercises between plans/days within Plan
// Builder. Backed by localStorage (not the OS clipboard) so copied exercises
// survive navigating to a different plan, which unmounts PlanBuilder entirely.

const STORAGE_KEY = 'exerciseClipboard';

export interface ClipboardSetTarget {
  set_number: number;
  target_reps: string | null;
  target_weight: number | null;
  target_duration_seconds: number | null;
}

export interface ClipboardExercise {
  exercise_id: number;
  exercise_name: string;
  video_url: string | null;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: number | null;
  target_duration_seconds: number | null;
  has_reps: boolean;
  has_weight: boolean;
  has_duration: boolean;
  notes: string;
  set_targets: ClipboardSetTarget[];
}

export function getClipboard(): ClipboardExercise[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setClipboard(exercises: ClipboardExercise[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — copy just
    // won't persist; the calling UI still reflects the in-memory selection.
  }
}

export function clearClipboard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
