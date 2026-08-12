import { describe, it, expect, beforeEach } from 'vitest';
import { getClipboard, setClipboard, clearClipboard, type ClipboardExercise } from './exerciseClipboard';

const sample: ClipboardExercise[] = [
  {
    exercise_id: 1,
    exercise_name: 'Bench Press',
    video_url: null,
    target_sets: 3,
    target_reps: '10',
    target_weight: 135,
    target_duration_seconds: null,
    has_reps: true,
    has_weight: true,
    has_duration: false,
    notes: '',
    set_targets: [],
  },
];

describe('exerciseClipboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty array when nothing has been copied', () => {
    expect(getClipboard()).toEqual([]);
  });

  it('round-trips copied exercises through localStorage', () => {
    setClipboard(sample);
    expect(getClipboard()).toEqual(sample);
  });

  it('clearClipboard empties the clipboard', () => {
    setClipboard(sample);
    clearClipboard();
    expect(getClipboard()).toEqual([]);
  });

  it('falls back to an empty array for malformed JSON in storage', () => {
    localStorage.setItem('exerciseClipboard', '{not valid json');
    expect(getClipboard()).toEqual([]);
  });

  it('falls back to an empty array if storage holds a non-array value', () => {
    localStorage.setItem('exerciseClipboard', JSON.stringify({ not: 'an array' }));
    expect(getClipboard()).toEqual([]);
  });
});
