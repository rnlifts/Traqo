import React, { useState, useEffect } from 'react';
import { secondsToHMS, hmsToSeconds } from '../utils/duration';

interface DurationInputProps {
  /** Total seconds (can be null for empty state) */
  value: number | null;
  /** Callback when duration changes */
  onChange: (totalSeconds: number | null) => void;
  /** Callback when remove (✕) is clicked */
  onRemove?: () => void;
}

/**
 * Duration input component with hours, minutes, seconds fields.
 * Renders three number inputs separated by colons with labels beneath.
 * Converts between total seconds and HMS parts internally.
 */
export const DurationInput: React.FC<DurationInputProps> = ({
  value,
  onChange,
  onRemove,
}) => {
  // Track raw string inputs to allow empty intermediate states during editing
  const [hStr, setHStr] = useState('');
  const [mStr, setMStr] = useState('');
  const [sStr, setSStr] = useState('');

  // Initialize string states from the value prop when it changes
  useEffect(() => {
    const { h, m, s } = secondsToHMS(value);
    setHStr(h === 0 && value === null ? '' : h.toString());
    setMStr(m === 0 && value === null ? '' : m.toString());
    setSStr(s === 0 && value === null ? '' : s.toString());
  }, [value]);

  const handleFieldChange = (field: 'h' | 'm' | 's', strValue: string) => {
    // Update the raw string state (allows empty intermediate state)
    const newHStr = field === 'h' ? strValue : hStr;
    const newMStr = field === 'm' ? strValue : mStr;
    const newSStr = field === 's' ? strValue : sStr;

    if (field === 'h') setHStr(strValue);
    if (field === 'm') setMStr(strValue);
    if (field === 's') setSStr(strValue);

    // Parse to numbers, treating empty as 0 for calculation
    const h = newHStr === '' ? 0 : parseInt(newHStr, 10) || 0;
    const m = newMStr === '' ? 0 : parseInt(newMStr, 10) || 0;
    const s = newSStr === '' ? 0 : parseInt(newSStr, 10) || 0;

    // Only call onChange if at least one field has a non-zero value or all are empty
    const hasAnyValue = h > 0 || m > 0 || s > 0;
    if (hasAnyValue) {
      const totalSeconds = hmsToSeconds(h, m, s);
      onChange(totalSeconds);
    } else if (newHStr === '' && newMStr === '' && newSStr === '') {
      // All fields empty → call onChange(0)
      onChange(0);
    }
  };

  return (
    <div className="duration-box">
      <div className="duration-inputs">
        <input
          type="number"
          min="0"
          value={hStr}
          onChange={(e) => handleFieldChange('h', e.target.value)}
          placeholder="0"
          className="duration-input"
        />
        <span className="duration-separator">:</span>

        <input
          type="number"
          min="0"
          value={mStr}
          onChange={(e) => handleFieldChange('m', e.target.value)}
          placeholder="0"
          className="duration-input"
        />
        <span className="duration-separator">:</span>

        <input
          type="number"
          min="0"
          value={sStr}
          onChange={(e) => handleFieldChange('s', e.target.value)}
          placeholder="0"
          className="duration-input"
        />

        {onRemove && (
          <button
            className="duration-remove"
            onClick={onRemove}
            title="Remove duration"
            aria-label="Remove duration"
          >
            ✕
          </button>
        )}
      </div>

      <div className="duration-labels">
        <label>hr</label>
        <label>min</label>
        <label>sec</label>
      </div>
    </div>
  );
};
