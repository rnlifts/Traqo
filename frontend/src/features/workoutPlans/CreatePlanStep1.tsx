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
  const [totalUnits, setTotalUnits] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customUnits, setCustomUnits] = useState('');
  const [customUnitType, setCustomUnitType] = useState<'days' | 'weeks'>('days');
  const [error, setError] = useState<string | null>(null);

  const predefinedLengths: Array<{ label: string; type: 'days' | 'weeks'; units: number }> = [
    { label: '1 Day', type: 'days', units: 1 },
    { label: '2 Days', type: 'days', units: 2 },
    { label: '1 Week', type: 'weeks', units: 1 },
    { label: '4 Weeks', type: 'weeks', units: 4 },
  ];

  const isValid = name.trim() !== '' && totalUnits !== null && totalUnits > 0;

  const handleSelectPredefined = (type: 'days' | 'weeks', units: number) => {
    setUnitType(type);
    setTotalUnits(units);
    setShowCustom(false);
    setError(null);
  };

  const handleContinue = () => {
    if (name.trim() === '') {
      setError('Please set up a name to continue.');
      return;
    }

    if (showCustom) {
      // Custom panel is open: validate custom input
      const units = parseInt(customUnits, 10);
      if (!customUnits || isNaN(units) || units < 1 || units > 52) {
        setError('Please enter a valid custom length (1-52).');
        return;
      }
      // Valid custom input: set the length and proceed
      setUnitType(customUnitType);
      setTotalUnits(units);
      setError(null);
      onContinue({ name: name.trim(), unitType: customUnitType, totalUnits: units });
    } else {
      // Custom panel is closed: use predefined logic
      if (totalUnits === null || totalUnits <= 0) {
        setError('Please select a length to continue.');
        return;
      }
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
          <label className="field-label">Length</label>
          <div className="chip-row">
            {predefinedLengths.map((length) => {
              const selected = totalUnits === length.units && unitType === length.type;
              return (
                <button
                  key={`${length.type}-${length.units}`}
                  onClick={() => handleSelectPredefined(length.type, length.units)}
                  className={`chip${selected ? ' selected' : ''}`}
                >
                  {length.label}
                </button>
              );
            })}
            <button
              onClick={() => {
                setShowCustom(!showCustom);
                setError(null);
              }}
              className={`chip${showCustom ? ' selected' : ''}`}
            >
              Custom
            </button>
          </div>

          {showCustom && (
            <div className="custom-row">
              <input
                type="number"
                min={1}
                max={52}
                value={customUnits}
                onChange={(e) => {
                  setCustomUnits(e.target.value);
                  setError(null);
                }}
                placeholder="1-52"
                className="text-input"
              />
              <div className="seg">
                <button
                  className={customUnitType === 'days' ? 'selected' : ''}
                  onClick={() => {
                    setCustomUnitType('days');
                    setError(null);
                  }}
                >
                  Days
                </button>
                <button
                  className={customUnitType === 'weeks' ? 'selected' : ''}
                  onClick={() => {
                    setCustomUnitType('weeks');
                    setError(null);
                  }}
                >
                  Weeks
                </button>
              </div>
            </div>
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
