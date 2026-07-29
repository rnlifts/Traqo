import { useState } from 'react';

interface PlanDraft {
  name: string;
  unitType: 'days' | 'weeks';
  totalUnits: number;
}

interface CreatePlanStep1Props {
  onContinue: (draft: PlanDraft) => void;
  onCancel: () => void;
}

export const CreatePlanStep1 = ({ onContinue, onCancel }: CreatePlanStep1Props) => {
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState<'days' | 'weeks'>('days');
  const [totalUnits, setTotalUnits] = useState<number>(1); // Default to 1 day
  const [showCustomWeeks, setShowCustomWeeks] = useState(false);
  const [customWeeks, setCustomWeeks] = useState('');
  const [periodizationMode, setPeriodizationMode] = useState(false); // true = weeks mode, false = days mode
  const [error, setError] = useState<string | null>(null);

  const isValid = name.trim() !== '' && totalUnits !== null && totalUnits > 0;

  const handleSelectDays = (days: number) => {
    setUnitType('days');
    setTotalUnits(days);
    setError(null);
  };

  const handleSelectWeeks = (weeks: number) => {
    setUnitType('weeks');
    setTotalUnits(weeks);
    setShowCustomWeeks(false);
    setCustomWeeks('');
    setError(null);
  };

  const handleTogglePeriodization = (enabled: boolean) => {
    if (enabled) {
      setPeriodizationMode(true);
      setUnitType('weeks');
      setTotalUnits(0); // force an explicit weeks selection — don't inherit a leftover day count
      setShowCustomWeeks(false);
      setCustomWeeks('');
    } else {
      setPeriodizationMode(false);
      setUnitType('days');
      setTotalUnits(1);
      setShowCustomWeeks(false);
      setCustomWeeks('');
    }
    setError(null);
  };

  const handleContinue = () => {
    if (name.trim() === '') {
      setError('Please set up a name to continue.');
      return;
    }

    if (periodizationMode && showCustomWeeks) {
      // Custom weeks panel is open: validate custom input
      const weeks = parseInt(customWeeks, 10);
      if (!customWeeks || isNaN(weeks) || weeks < 1 || weeks > 52) {
        setError('Please enter a valid custom length (1-52).');
        return;
      }
      // Valid custom input: proceed
      setError(null);
      onContinue({ name: name.trim(), unitType: 'weeks', totalUnits: weeks });
    } else if (totalUnits === null || totalUnits <= 0) {
      setError('Please select a length to continue.');
      return;
    } else {
      // Predefined selection
      setError(null);
      onContinue({ name: name.trim(), unitType, totalUnits });
    }
  };

  return (
    <div className="page-container">
      <p className="kicker">New plan</p>
      <h1 className="page-title">Set it up</h1>

      <div className="panel" style={{ maxWidth: '560px' }}>
        {error && <div className="error-message">{error}</div>}
        <label className="field-label" htmlFor="planName">
          Plan name
        </label>
        <input
          id="planName"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Off-season strength block"
          className="text-input"
        />

        <div style={{ marginTop: '24px' }}>
          <div>
            <h3 className="field-label" style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
              Workout Schedule
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text)', fontWeight: 'normal' }}>
              How many days do you plan to work out each week?
            </p>
          </div>

          {!periodizationMode && (
            <>
              <div className="chip-row" style={{ marginBottom: '16px' }}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const selected = unitType === 'days' && totalUnits === day;
                  return (
                    <button
                      key={`day-${day}`}
                      onClick={() => handleSelectDays(day)}
                      className={`chip${selected ? ' selected' : ''}`}
                    >
                      {day} Day{day > 1 ? 's' : ''}
                    </button>
                  );
                })}
              </div>

              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text)', fontStyle: 'italic' }}>
                This workout schedule repeats weekly.
              </p>

              <div
                onClick={() => !periodizationMode && handleTogglePeriodization(true)}
                style={{
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface)',
                  marginBottom: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface)';
                }}
              >
                <input
                  type="checkbox"
                  checked={periodizationMode}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    handleTogglePeriodization(e.target.checked);
                  }}
                  style={{
                    cursor: 'pointer',
                    width: '18px',
                    height: '18px',
                    flexShrink: 0,
                  }}
                  aria-label="Create a multi-week training plan"
                />
                <div>
                  <label
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    Create a multi-week training plan
                  </label>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text)', lineHeight: '1.4' }}>
                    Plan different workouts for each week.
                  </p>
                </div>
              </div>
            </>
          )}

          {periodizationMode && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                  Multi-week Training (Periodization)
                </h3>
              </div>

              <div className="chip-row" style={{ marginBottom: '12px' }}>
                {[
                  { label: '1 Week', weeks: 1 },
                  { label: '4 Weeks', weeks: 4 },
                ].map((option) => {
                  const selected = unitType === 'weeks' && totalUnits === option.weeks && !showCustomWeeks;
                  return (
                    <button
                      key={`weeks-${option.weeks}`}
                      onClick={() => handleSelectWeeks(option.weeks)}
                      className={`chip${selected ? ' selected' : ''}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setShowCustomWeeks(!showCustomWeeks);
                    setCustomWeeks('');
                    setError(null);
                  }}
                  className={`chip${showCustomWeeks ? ' selected' : ''}`}
                >
                  Custom
                </button>
              </div>

              {showCustomWeeks && (
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={customWeeks}
                    onChange={(e) => {
                      setCustomWeeks(e.target.value);
                      setError(null);
                    }}
                    placeholder="1-52"
                    className="text-input"
                    style={{ maxWidth: '120px' }}
                  />
                </div>
              )}

              <button
                onClick={() => handleTogglePeriodization(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--link)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  padding: 0,
                  textAlign: 'left',
                  marginBottom: '0',
                }}
              >
                ← Use single-week schedule instead
              </button>
            </>
          )}
        </div>

        <div className="step-actions">
          <button onClick={onCancel} className="btn-link">
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={false}
            className={`btn btn-primary${!isValid ? ' soft-disabled' : ''}`}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
};
