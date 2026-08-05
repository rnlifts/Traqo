import React, { useState } from 'react';
import { sharingApi } from '../../api/sharingApi';
import type { SharedPlanExercise } from '../../api/sharingApi';
import { useToast } from '../../components/Toast';

interface LoggedSet {
  set_id: number;
  set_number: number;
  weight?: number;
  reps?: number;
  duration_seconds?: number;
  notes?: string;
}

interface ExerciseState {
  exercise_id: number;
  weight: string;
  reps: string;
  notes: string;
  loggedSets: LoggedSet[];
  logging: boolean;
}

interface Props {
  token: string;
  sessionId: number;
  exercises: SharedPlanExercise[];
}

export const AnonymousWorkoutLogger: React.FC<Props> = ({
  token,
  sessionId,
  exercises,
}) => {
  const { showToast } = useToast();
  const [exerciseStates, setExerciseStates] = useState<Map<number, ExerciseState>>(
    new Map(
      exercises.map((ex) => [
        ex.exercise_id,
        {
          exercise_id: ex.exercise_id,
          weight: '',
          reps: '',
          notes: '',
          loggedSets: [],
          logging: false,
        },
      ])
    )
  );
  const [finishing, setFinishing] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (completed) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-hover)',
          borderRadius: '8px',
          marginTop: '24px',
        }}
      >
        <h2 style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--success)' }}>
          Workout complete
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--text)', marginBottom: '20px' }}>
          Thanks for logging your workout!
        </p>
      </div>
    );
  }

  async function handleLogSet(exerciseId: number) {
    const state = exerciseStates.get(exerciseId);
    if (!state) return;

    const weight = state.weight ? parseFloat(state.weight) : undefined;
    const reps = state.reps ? parseInt(state.reps, 10) : undefined;

    // Validate: at least one of weight/reps must be provided
    if (!weight && !reps) {
      showToast('Please enter weight or reps', 'error');
      return;
    }

    const newStates = new Map(exerciseStates);
    const newState = { ...state, logging: true };
    newStates.set(exerciseId, newState);
    setExerciseStates(newStates);

    try {
      const response = await sharingApi.addSetViaShare(token, sessionId, {
        exercise_id: exerciseId,
        weight,
        reps,
        notes: state.notes || undefined,
      });

      // Add to logged sets
      const updatedState = { ...newState };
      updatedState.loggedSets.push({
        set_id: response.set_id,
        set_number: response.set_number,
        weight,
        reps,
        notes: state.notes || undefined,
      });
      updatedState.weight = '';
      updatedState.reps = '';
      updatedState.notes = '';
      updatedState.logging = false;

      const finalStates = new Map(newStates);
      finalStates.set(exerciseId, updatedState);
      setExerciseStates(finalStates);

      showToast(`Set ${response.set_number} logged!`, 'success');
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        (err as Error).message ||
        'Failed to log set';
      showToast(errorMsg, 'error');

      const errorStates = new Map(newStates);
      newState.logging = false;
      errorStates.set(exerciseId, newState);
      setExerciseStates(errorStates);
    }
  }

  async function handleFinishWorkout() {
    setFinishing(true);
    try {
      await sharingApi.finishWorkoutViaShare(token, sessionId);
      showToast('Workout finished!', 'success');
      setCompleted(true);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        (err as Error).message ||
        'Failed to finish workout';
      showToast(errorMsg, 'error');
      setFinishing(false);
    }
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Log your sets</h2>

      {exercises.map((exercise) => {
        const state = exerciseStates.get(exercise.exercise_id);
        if (!state) return null;

        return (
          <div
            key={exercise.exercise_id}
            style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: 'var(--bg-hover)',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
              {exercise.exercise_name}
            </h3>

            {/* Input form */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '12px',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div style={{ flex: 1, minWidth: '80px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Weight
                </label>
                <input
                  type="number"
                  placeholder="lbs"
                  value={state.weight}
                  onChange={(e) => {
                    const newStates = new Map(exerciseStates);
                    newStates.set(exercise.exercise_id, {
                      ...state,
                      weight: e.target.value,
                    });
                    setExerciseStates(newStates);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '80px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Reps
                </label>
                <input
                  type="number"
                  placeholder="reps"
                  value={state.reps}
                  onChange={(e) => {
                    const newStates = new Map(exerciseStates);
                    newStates.set(exercise.exercise_id, {
                      ...state,
                      reps: e.target.value,
                    });
                    setExerciseStates(newStates);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: '80px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="notes"
                  value={state.notes}
                  onChange={(e) => {
                    const newStates = new Map(exerciseStates);
                    newStates.set(exercise.exercise_id, {
                      ...state,
                      notes: e.target.value,
                    });
                    setExerciseStates(newStates);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                onClick={() => handleLogSet(exercise.exercise_id)}
                disabled={state.logging}
                className="btn btn-success"
                style={{
                  padding: '8px 16px',
                  cursor: state.logging ? 'not-allowed' : 'pointer',
                  opacity: state.logging ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {state.logging ? 'Logging...' : 'Log set'}
              </button>
            </div>

            {/* Logged sets list */}
            {state.loggedSets.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Logged sets:
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '14px',
                  }}
                >
                  {state.loggedSets.map((set) => (
                    <li
                      key={set.set_id}
                      style={{
                        marginBottom: '4px',
                        color: 'var(--text)',
                      }}
                    >
                      Set {set.set_number}
                      {set.weight && <span> • {set.weight}lbs</span>}
                      {set.reps && <span> • {set.reps}reps</span>}
                      {set.notes && <span> • {set.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}

      {/* Finish button */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          onClick={handleFinishWorkout}
          disabled={finishing}
          className="btn btn-success"
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            cursor: finishing ? 'not-allowed' : 'pointer',
            opacity: finishing ? 0.6 : 1,
          }}
        >
          {finishing ? 'Finishing...' : 'Finish workout'}
        </button>
      </div>
    </div>
  );
};

export default AnonymousWorkoutLogger;
