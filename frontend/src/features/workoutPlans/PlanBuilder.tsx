import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import {
  buildPlan,
  updateDay,
  addExerciseToDay,
  updateExerciseInDay,
  removeExerciseFromDay,
  customizeWeek,
  matchPreviousWeek,
  updateWorkoutPlan,
  replaceSetTargets,
  workoutPlansApi,
  type WorkoutPlanDetail,
  type PlanDay,
  type PlanWeek,
  type WorkoutExercise,
} from '../../api/workoutPlansApi';
import { exercisesApi } from '../../api/exercisesApi';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { DurationInput } from '../../components/DurationInput';
import { TrashIcon, InfoIcon } from '../../components/icons';
import { ExerciseLibrarySidebar } from '../exerciseLibrary/ExerciseLibrarySidebar';

interface PlanDraft {
  name: string;
  unitType: 'days' | 'weeks';
  totalUnits: number;
}

interface Exercise {
  id: number;
  name: string;
  logging_type: string;
}

interface EditPlanBuilderProps {
  planId: number;
  isCreateMode: false;
}

interface CreatePlanBuilderProps {
  draft: PlanDraft;
  isCreateMode: true;
}

type PlanBuilderProps = EditPlanBuilderProps | CreatePlanBuilderProps;

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Helper function to get effective days for a week (walk backward through linked weeks)
function getEffectiveDaysForWeek(weeks: PlanWeek[], weekIndex: number): PlanDay[] {
  let j = weekIndex;
  while (j >= 0 && weeks[j].mode === 'linked') {
    j--;
  }
  return j >= 0 ? weeks[j].days : [];
}

export const PlanBuilder = (props: PlanBuilderProps) => {
  const navigate = useNavigate();
  const { Toast, showToast } = useToast();

  // State for both create and edit modes
  const [loading, setLoading] = useState(props.isCreateMode ? false : true);
  const [error, setError] = useState('');
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  // For edit mode, track the actual plan
  const planId = props.isCreateMode ? null : (props as EditPlanBuilderProps).planId;

  // Draft state (for create mode OR when editing in-memory for weeks resolution)
  const [draftDays, setDraftDays] = useState<PlanDay[]>([]);
  const [draftWeeks, setDraftWeeks] = useState<PlanWeek[]>([]);
  const [draftName, setDraftName] = useState(props.isCreateMode ? props.draft.name : '');
  const [draftUnitType, setDraftUnitType] = useState<'days' | 'weeks'>(
    props.isCreateMode ? props.draft.unitType : 'days'
  );
  const [draftTotalUnits, setDraftTotalUnits] = useState(
    props.isCreateMode ? props.draft.totalUnits : 0
  );

  // UI state
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isRenamingPlan, setIsRenamingPlan] = useState(false);
  const [renamePlanName, setRenamePlanName] = useState(draftName);

  // Track whether at least one exercise has been added (for hint text)
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isQuickStart, setIsQuickStart] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'day' | 'exercise';
    dayId?: number;
    exerciseId?: number;
  }>({ isOpen: false, type: 'day' });

  // Per-set override UI state
  const [varyBySetRows, setVaryBySetRows] = useState<Set<number>>(new Set());
  const [perSetEditsByExerciseId, setPerSetEditsByExerciseId] = useState<
    Map<number, Array<{ set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds: number | null }>>
  >(new Map());
  const [savingSetTargets, setSavingSetTargets] = useState<Set<number>>(new Set());
  const [savedSetTargets, setSavedSetTargets] = useState<Set<number>>(new Set());

  // Load data for edit mode
  useEffect(() => {
    if (!props.isCreateMode) {
      loadPlanForEdit();
    } else {
      // Initialize draft for create mode
      initializeDraft();
      loadExercises();
    }
  }, []);

  async function loadPlanForEdit() {
    try {
      setLoading(true);
      const response = await client.get<WorkoutPlanDetail>(`/workout-plans/${planId}`);
      const data = response.data;

      setDraftName(data.plan.name);
      setRenamePlanName(data.plan.name);
      setDraftUnitType((data.plan.unit_type as 'days' | 'weeks') || 'days');
      setDraftTotalUnits(data.plan.total_units || 0);
      setIsQuickStart(!!data.plan.is_quick_start);

      if (data.plan.unit_type === 'weeks' && data.weeks) {
        setDraftWeeks(data.weeks);
      } else if (data.days) {
        setDraftDays(data.days);
      }

      setError('');
      await loadExercises();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function initializeDraft() {
    if (!props.isCreateMode) return;

    const { unitType, totalUnits } = props.draft;

    if (unitType === 'days') {
      // Create empty days
      const days: PlanDay[] = [];
      for (let i = 1; i <= totalUnits; i++) {
        days.push({
          id: -(i + 1000), // Temporary negative IDs for new days
          label: `Day ${i}`,
          order_position: i,
          is_rest: false,
          exercises: [],
        });
      }
      setDraftDays(days);
    } else {
      // Create weeks with week 1 as base
      const weeks: PlanWeek[] = [];
      for (let w = 1; w <= totalUnits; w++) {
        const week: PlanWeek = {
          week_number: w,
          mode: w === 1 ? 'base' : 'linked',
          resolved_week_number: w === 1 ? 1 : 1, // All start resolved to week 1
          days: w === 1 ? createWeekDays() : [],
        };
        weeks.push(week);
      }
      setDraftWeeks(weeks);
    }
  }

  async function handleAddDay() {
    if (!planId) return;
    try {
      const newDay = await workoutPlansApi.createDay(planId, `Day ${draftDays.length + 1}`);
      setDraftDays([...draftDays, { ...newDay, exercises: newDay.exercises ?? [] }]);
      showToast('Day added!', 'success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add day');
    }
  }

  function createWeekDays(): PlanDay[] {
    return WEEK_LABELS.map((label, idx) => ({
      id: -(idx + 100), // Temporary negative IDs
      label,
      order_position: idx + 1,
      is_rest: false,
      exercises: [],
    }));
  }

  async function loadExercises() {
    try {
      const data = await exercisesApi.list();
      setAvailableExercises(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Get the currently active days (either from draft or effective from weeks)
  function getActiveDays(): PlanDay[] {
    if (draftUnitType === 'days') {
      return draftDays;
    } else {
      // For weeks, get effective days for the active week
      if (draftWeeks.length === 0) return [];
      return getEffectiveDaysForWeek(draftWeeks, activeWeekIndex);
    }
  }

  async function handleSavePlan() {
    if (!props.isCreateMode) {
      // Edit mode doesn't need a save button - all changes are immediate
      navigate('/workout-plans');
      return;
    }

    if (!draftName.trim()) {
      setError('Plan name is required');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: draftName,
        unit_type: draftUnitType,
        total_units: draftTotalUnits,
      };

      if (draftUnitType === 'days') {
        payload.days = draftDays.map((day) => ({
          label: day.label,
          is_rest: day.is_rest || false,
          order_position: day.order_position,
          exercises: day.exercises.map((ex) => ({
            exercise_id: ex.exercise_id,
            target_sets: ex.target_sets,
            target_reps: ex.target_reps,
            target_weight: ex.target_weight,
            target_duration_seconds: ex.target_duration_seconds,
            has_reps: ex.has_reps,
            has_weight: ex.has_weight,
            has_duration: ex.has_duration,
            notes: ex.notes || '',
            set_targets: perSetEditsByExerciseId.get(ex.id) || [],
          })),
        }));
      } else {
        payload.weeks = draftWeeks.map((week) => {
          const weekPayload: any = {
            week_number: week.week_number,
            mode: week.mode,
          };
          if (week.mode !== 'linked') {
            weekPayload.days = week.days.map((day) => ({
              label: day.label,
              is_rest: day.is_rest || false,
              order_position: day.order_position,
              exercises: day.exercises.map((ex) => ({
                exercise_id: ex.exercise_id,
                target_sets: ex.target_sets,
                target_reps: ex.target_reps,
                target_weight: ex.target_weight,
                target_duration_seconds: ex.target_duration_seconds,
                has_reps: ex.has_reps,
                has_weight: ex.has_weight,
                has_duration: ex.has_duration,
                notes: ex.notes || '',
                set_targets: perSetEditsByExerciseId.get(ex.id) || [],
              })),
            }));
          }
          return weekPayload;
        });
      }

      await buildPlan(payload);
      showToast('Plan created successfully!', 'success');
      navigate('/workout-plans');
    } catch (err: any) {
      setError(err.response?.data?.error || (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePlanName() {
    if (!props.isCreateMode && planId && renamePlanName.trim()) {
      try {
        await updateWorkoutPlan(planId, renamePlanName);
        setDraftName(renamePlanName);
        setIsRenamingPlan(false);
        showToast('Plan name updated!', 'success');
        await loadPlanForEdit();
      } catch (err) {
        setError((err as Error).message);
      }
    } else {
      setDraftName(renamePlanName);
      setIsRenamingPlan(false);
    }
  }

  async function handleToggleRestDay() {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    const newRestState = !(currentDay.is_rest || false);

    if (props.isCreateMode) {
      // Edit in-memory draft
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id ? { ...d, is_rest: newRestState } : d
          )
        );
      } else {
        setDraftWeeks((prev) =>
          prev.map((week, wIdx) => {
            if (wIdx === activeWeekIndex) {
              return {
                ...week,
                days: week.days.map((d) =>
                  d.id === currentDay.id ? { ...d, is_rest: newRestState } : d
                ),
              };
            }
            return week;
          })
        );
      }
    } else if (planId) {
      // Edit mode - call API immediately
      try {
        await updateDay(planId, currentDay.id, { is_rest: newRestState });
        showToast('Day updated!', 'success');
        await loadPlanForEdit();
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  // Core logic: find-or-create exercise and add to current day
  // Shared by both form submission and sidebar quick-add
  async function addExerciseToCurrentDay(
    name: string,
    targetSetsValue: string | null,
    targetRepsValue: string | null,
    targetWeightValue: string | null,
    targetDurationValue: number | null,
    hasReps: boolean,
    hasWeight: boolean,
    hasDuration: boolean,
    notesValue: string,
  ) {
    if (!name.trim()) throw new Error('Exercise name required');

    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) throw new Error('No active day');

    // Find or create exercise
    const existingExercise = availableExercises.find(
      (ex) => ex.name.toLowerCase() === name.toLowerCase()
    );

    let exerciseId: number;
    if (existingExercise) {
      exerciseId = existingExercise.id;
    } else {
      const newExercise = await exercisesApi.create({ name });
      exerciseId = newExercise.id;
      setAvailableExercises([...availableExercises, newExercise]);
    }

    const sets = targetSetsValue ? Number(targetSetsValue) : undefined;
    const reps = hasReps && targetRepsValue ? targetRepsValue : undefined;
    const weight = hasWeight && targetWeightValue ? Number(targetWeightValue) : undefined;
    const durationSeconds = hasDuration && targetDurationValue ? targetDurationValue : undefined;

    if (props.isCreateMode) {
      // Add to draft
      const newExercise: WorkoutExercise = {
        id: -(Date.now() + Math.random()),
        plan_day_id: currentDay.id,
        exercise_id: exerciseId,
        order_number: (currentDay.exercises.length || 0) + 1,
        target_sets: sets || null,
        target_reps: reps || null,
        target_weight: weight || null,
        target_duration_seconds: durationSeconds || null,
        has_reps: hasReps,
        has_weight: hasWeight,
        has_duration: hasDuration,
        set_targets: [],
        notes: notesValue || '',
        exercise_name: name,
      };

      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? { ...d, exercises: [...d.exercises, newExercise] }
              : d
          )
        );
      } else {
        setDraftWeeks((prev) =>
          prev.map((week, wIdx) => {
            if (wIdx === activeWeekIndex) {
              return {
                ...week,
                days: week.days.map((d) =>
                  d.id === currentDay.id
                    ? { ...d, exercises: [...d.exercises, newExercise] }
                    : d
                ),
              };
            }
            return week;
          })
        );
      }
    } else if (planId) {
      // Edit mode - call API
      await addExerciseToDay(planId, currentDay.id, exerciseId, sets, reps, weight, durationSeconds, hasReps, hasWeight, hasDuration);
      showToast('Exercise added!', 'success');
      await loadPlanForEdit();
    }
  }

  // Quick-add from sidebar: add exercise immediately with default targets
  async function handleQuickAddExercise(name: string) {
    try {
      await addExerciseToCurrentDay(
        name,
        null, // targetSets: empty
        null, // targetReps: empty
        null, // targetWeight: empty
        null, // targetDuration: empty
        true, // has_reps: default to true
        true, // has_weight: default to true
        false, // has_duration: default to false
        '' // notes: empty
      );
      showToast(`${name} added to ${draftUnitType === 'days' ? 'day' : 'week'}!`, 'success');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleExerciseCreated(exercise: Exercise) {
    // Add newly created exercise to availableExercises cache
    // so that subsequent adds don't trigger a duplicate creation
    setAvailableExercises((prev) => {
      const exists = prev.some((ex) => ex.id === exercise.id);
      return exists ? prev : [...prev, exercise];
    });
  }

  async function handleUpdateExercise(exerciseId: number, field: string, value: any) {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    if (props.isCreateMode) {
      // Update draft
      const updateField: any = {};
      if (field === 'sets') updateField.target_sets = value;
      if (field === 'reps') updateField.target_reps = value;
      if (field === 'weight') updateField.target_weight = value;
      if (field === 'target_duration_seconds') updateField.target_duration_seconds = value;
      if (field === 'has_reps') updateField.has_reps = value;
      if (field === 'has_weight') updateField.has_weight = value;
      if (field === 'has_duration') updateField.has_duration = value;
      if (field === 'notes') updateField.notes = value;

      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? {
                  ...d,
                  exercises: d.exercises.map((ex) =>
                    ex.id === exerciseId ? { ...ex, ...updateField } : ex
                  ),
                }
              : d
          )
        );
      } else {
        setDraftWeeks((prev) =>
          prev.map((week, wIdx) => {
            if (wIdx === activeWeekIndex) {
              return {
                ...week,
                days: week.days.map((d) =>
                  d.id === currentDay.id
                    ? {
                        ...d,
                        exercises: d.exercises.map((ex) =>
                          ex.id === exerciseId ? { ...ex, ...updateField } : ex
                        ),
                      }
                    : d
                ),
              };
            }
            return week;
          })
        );
      }
    } else if (planId) {
      // Edit mode - call API immediately
      try {
        const updates: any = {};
        if (field === 'sets') updates.target_sets = value;
        if (field === 'reps') updates.target_reps = value;
        if (field === 'weight') updates.target_weight = value;
        if (field === 'target_duration_seconds') updates.target_duration_seconds = value;
        if (field === 'has_reps') updates.has_reps = value;
        if (field === 'has_weight') updates.has_weight = value;
        if (field === 'has_duration') updates.has_duration = value;
        if (field === 'notes') updates.notes = value;

        await updateExerciseInDay(planId, currentDay.id, exerciseId, updates);
        await loadPlanForEdit();
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  async function handleRemoveExercise(exerciseId: number) {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    if (props.isCreateMode) {
      // Remove from draft
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== exerciseId) }
              : d
          )
        );
      } else {
        setDraftWeeks((prev) =>
          prev.map((week, wIdx) => {
            if (wIdx === activeWeekIndex) {
              return {
                ...week,
                days: week.days.map((d) =>
                  d.id === currentDay.id
                    ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== exerciseId) }
                    : d
                ),
              };
            }
            return week;
          })
        );
      }
      setDeleteConfirm({ isOpen: false, type: 'exercise' });
    } else if (planId) {
      try {
        await removeExerciseFromDay(planId, currentDay.id, exerciseId);
        showToast('Exercise removed!', 'success');
        await loadPlanForEdit();
        setDeleteConfirm({ isOpen: false, type: 'exercise' });
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  async function handleCustomizeWeek() {
    if (props.isCreateMode) {
      // Customize in draft - deep copy effective days
      const effectiveDays = getEffectiveDaysForWeek(draftWeeks, activeWeekIndex);
      const copiedDays = effectiveDays.map((day) => ({
        ...day,
        id: -(Date.now() + Math.random()),
        exercises: day.exercises.map((ex) => ({
          ...ex,
          id: -(Date.now() + Math.random()),
        })),
      }));

      setDraftWeeks((prev) =>
        prev.map((week, idx) => {
          if (idx === activeWeekIndex) {
            return {
              ...week,
              mode: 'custom' as const,
              days: copiedDays,
            };
          }
          return week;
        })
      );
    } else if (planId) {
      try {
        await customizeWeek(planId, draftWeeks[activeWeekIndex].week_number);
        showToast('Week customized!', 'success');
        await loadPlanForEdit();
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  async function handleMatchPreviousWeek() {
    if (props.isCreateMode) {
      // Match previous in draft
      setDraftWeeks((prev) =>
        prev.map((week, idx) => {
          if (idx === activeWeekIndex) {
            return {
              ...week,
              mode: 'linked' as const,
              days: [],
            };
          }
          return week;
        })
      );
    } else if (planId) {
      try {
        await matchPreviousWeek(planId, draftWeeks[activeWeekIndex].week_number);
        showToast('Week reverted!', 'success');
        await loadPlanForEdit();
      } catch (err: any) {
        if (err.response?.status === 409) {
          setError(err.response?.data?.error || 'Cannot revert this week');
        } else {
          setError((err as Error).message);
        }
      }
    }
  }

  if (loading) return (
    <>
      <div className="loading">Loading plan builder...</div>
      {Toast}
    </>
  );

  const activeDays = getActiveDays();
  const currentDay = activeDays[activeDayIndex];
  const isLinkedWeek = draftUnitType === 'weeks' && draftWeeks[activeWeekIndex]?.mode === 'linked';

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Main Content */}
      <div className="page-container" style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => {
            if (props.isCreateMode) {
              setShowBackConfirm(true);
            } else {
              navigate('/workout-plans');
            }
          }}
          className="btn btn-secondary"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}
          className="error-message"
        >
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#721c24',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 0 0 12px',
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Plan Name */}
      <div style={{ marginBottom: '20px' }}>
        {isRenamingPlan ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={renamePlanName}
              onChange={(e) => setRenamePlanName(e.target.value)}
              className="input-field"
              style={{ flex: 1 }}
            />
            <button onClick={handleUpdatePlanName} className="btn btn-primary">
              Save
            </button>
            <button
              onClick={() => {
                setRenamePlanName(draftName);
                setIsRenamingPlan(false);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{draftName}</h2>
            {!props.isCreateMode && (
              <button onClick={() => setIsRenamingPlan(true)} className="btn">
                Rename
              </button>
            )}
          </div>
        )}
      </div>

      {/* Week Rail (for weeks-type plans) */}
      {draftUnitType === 'weeks' && draftWeeks.length > 1 && (
        <div className="panel" style={{ marginBottom: '20px' }}>
          <label className="field-label">Weeks</label>
          <div className="week-selector-row">
            {draftWeeks.map((week, idx) => (
              <div key={week.week_number} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setActiveWeekIndex(idx)}
                  className={`week-node${idx === activeWeekIndex ? ' active' : week.mode === 'custom' ? ' completed' : ''}`}
                  aria-label={`Week ${week.week_number}, ${week.mode}${idx === activeWeekIndex ? ', active' : ''}`}
                  title={`Week ${week.week_number} (${week.mode})`}
                >
                  {week.week_number}
                </button>
                {idx < draftWeeks.length - 1 && (
                  <div
                    className={`week-connector${draftWeeks[idx + 1].mode === 'custom' ? ' custom' : ''}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Status Banner */}
          <div className="info-card" style={{ marginTop: '16px' }}>
            {draftWeeks[activeWeekIndex].mode === 'linked' && (
              <>
                <p>
                  Week {draftWeeks[activeWeekIndex].week_number} is linked to Week {getEffectiveDaysForWeek(draftWeeks, activeWeekIndex).length > 0 ? draftWeeks.findIndex(w => w.days === getEffectiveDaysForWeek(draftWeeks, activeWeekIndex)) + 1 : '1'}. Editing that week updates this week too.
                </p>
                <button onClick={handleCustomizeWeek} className="btn btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  Customize this week
                </button>
              </>
            )}
            {draftWeeks[activeWeekIndex].mode === 'custom' && (
              <>
                <p>Week {draftWeeks[activeWeekIndex].week_number} is customized — it has its own days, separate from the chain.</p>
                <button onClick={handleMatchPreviousWeek} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  Match previous week
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Day Tabs */}
      {activeDays.length > 0 && (
        <>
          <div className="day-tabs">
            {activeDays.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => setActiveDayIndex(idx)}
                className={`day-tab${idx === activeDayIndex ? ' active' : ''}`}
              >
                {day.label}
              </button>
            ))}
          </div>

          {/* Rest Toggle */}
          {currentDay && (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Rest day:</label>
              <button
                onClick={handleToggleRestDay}
                disabled={isLinkedWeek}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: currentDay.is_rest ? 'var(--success)' : 'var(--border)',
                  color: currentDay.is_rest ? 'white' : 'var(--text-h)',
                  cursor: isLinkedWeek ? 'not-allowed' : 'pointer',
                  opacity: isLinkedWeek ? 0.6 : 1,
                  fontSize: '12px',
                }}
                className="btn"
              >
                {currentDay.is_rest ? 'Yes' : 'No'}
              </button>
              {isLinkedWeek && (
                <span style={{ fontSize: '12px', color: 'var(--text)', fontStyle: 'italic' }}>
                  This day is linked. Customize the week to edit it directly.
                </span>
              )}
            </div>
          )}

          {/* Exercise Grid */}
          {currentDay && !currentDay.is_rest && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <div className="exercise-section-label">Exercises</div>

                {currentDay.exercises.map((ex, idx) => {
                  const isVaryBySetMode = varyBySetRows.has(ex.id);
                  const perSetEdits = perSetEditsByExerciseId.get(ex.id) || (ex.set_targets || []);
                  const numSets = ex.target_sets || 1;

                  return (
                    <div key={ex.id}>
                      <div
                        className="exercise-row"
                        style={{
                          opacity: isLinkedWeek ? 0.6 : 1,
                          pointerEvents: isLinkedWeek ? 'none' : 'auto',
                        }}
                      >
                        <div className="field-cell field-cell-name">
                          <span className="cell-label">Name</span>
                          <div className="cell-static-value">
                            {idx + 1}. {ex.exercise_name || `Exercise ${ex.exercise_id}`}
                          </div>
                        </div>
                        <div className="field-cell">
                          <span className="cell-label">Sets</span>
                          <input
                            type="number"
                            value={ex.target_sets || ''}
                            onChange={(e) => handleUpdateExercise(ex.id, 'sets', e.target.value ? Number(e.target.value) : null)}
                            placeholder="Sets"
                            className="input-field"
                            disabled={isLinkedWeek}
                            style={{ width: '50px' }}
                          />
                        </div>
                        {ex.has_reps ? (
                          <div className="field-cell">
                            <span className="cell-label">Reps</span>
                            <div className="field-with-badge">
                              <input
                                type="text"
                                value={ex.target_reps || ''}
                                onChange={(e) => {
                                  const newValue = e.target.value || null;
                                  handleUpdateExercise(ex.id, 'reps', newValue);
                                  // Sync Set 1 in the vary-by-set panel if it's open
                                  if (isVaryBySetMode && perSetEditsByExerciseId.has(ex.id)) {
                                    setPerSetEditsByExerciseId((prev) => {
                                      const updated = new Map(prev);
                                      const edits = updated.get(ex.id) || [];
                                      updated.set(ex.id, edits.map((s) =>
                                        s.set_number === 1 ? { ...s, target_reps: newValue } : s
                                      ));
                                      return updated;
                                    });
                                  }
                                }}
                                placeholder="e.g. 10 or 10-12"
                                className="input-field"
                                disabled={isLinkedWeek}
                                style={{ width: '140px' }}
                              />
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_reps', false)}
                                className="field-remove-badge"
                                disabled={isLinkedWeek}
                                title="Cross out reps"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="field-cell">
                            <span className="cell-label">Reps</span>
                            <button
                              onClick={() => handleUpdateExercise(ex.id, 'has_reps', true)}
                              className="field-restore-chip"
                              disabled={isLinkedWeek}
                            >
                              + Reps
                            </button>
                          </div>
                        )}
                        {ex.has_weight ? (
                          <div className="field-cell">
                            <span className="cell-label">Weight</span>
                            <div className="field-with-badge">
                              <input
                                type="number"
                                step="0.5"
                                value={ex.target_weight || ''}
                                onChange={(e) => {
                                  const newValue = e.target.value ? Number(e.target.value) : null;
                                  handleUpdateExercise(ex.id, 'weight', newValue);
                                  // Sync Set 1 in the vary-by-set panel if it's open
                                  if (isVaryBySetMode && perSetEditsByExerciseId.has(ex.id)) {
                                    setPerSetEditsByExerciseId((prev) => {
                                      const updated = new Map(prev);
                                      const edits = updated.get(ex.id) || [];
                                      updated.set(ex.id, edits.map((s) =>
                                        s.set_number === 1 ? { ...s, target_weight: newValue } : s
                                      ));
                                      return updated;
                                    });
                                  }
                                }}
                                placeholder="Weight"
                                className="input-field"
                                disabled={isLinkedWeek}
                                style={{ width: '75px' }}
                              />
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_weight', false)}
                                className="field-remove-badge"
                                disabled={isLinkedWeek}
                                title="Cross out weight"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="field-cell">
                            <span className="cell-label">Weight</span>
                            <button
                              onClick={() => handleUpdateExercise(ex.id, 'has_weight', true)}
                              className="field-restore-chip"
                              disabled={isLinkedWeek}
                            >
                              + Weight
                            </button>
                          </div>
                        )}
                        {ex.has_duration ? (
                          <div className="field-cell">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="cell-label">Duration</span>
                              <span title="Target time to sustain this exercise (e.g. treadmill, plank) — not how long the set took." style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}>
                                <InfoIcon style={{ width: '14px', height: '14px' }} />
                              </span>
                            </div>
                            <DurationInput
                              value={ex.target_duration_seconds || null}
                              onChange={(value) => {
                                const newValue = value || null;
                                handleUpdateExercise(ex.id, 'target_duration_seconds', newValue);
                                // Sync Set 1 in the vary-by-set panel if it's open
                                if (isVaryBySetMode && perSetEditsByExerciseId.has(ex.id)) {
                                  setPerSetEditsByExerciseId((prev) => {
                                    const updated = new Map(prev);
                                    const edits = updated.get(ex.id) || [];
                                    updated.set(ex.id, edits.map((s) =>
                                      s.set_number === 1 ? { ...s, target_duration_seconds: newValue } : s
                                    ));
                                    return updated;
                                  });
                                }
                              }}
                              onRemove={() => handleUpdateExercise(ex.id, 'has_duration', false)}
                            />
                          </div>
                        ) : (
                          <div className="field-cell">
                            <span className="cell-label">Duration</span>
                            <button
                              onClick={() => handleUpdateExercise(ex.id, 'has_duration', true)}
                              className="field-restore-chip"
                              disabled={isLinkedWeek}
                            >
                              + Duration
                            </button>
                          </div>
                        )}
                        <div className="field-cell field-cell-notes">
                          <span className="cell-label">Notes</span>
                          <input
                            type="text"
                            value={ex.notes || ''}
                            onChange={(e) => handleUpdateExercise(ex.id, 'notes', e.target.value)}
                            placeholder="Notes"
                            className="input-field"
                            disabled={isLinkedWeek}
                          />
                        </div>
                        <div className="row-actions">
                          <button
                            onClick={() => {
                              const newVaryBySet = !isVaryBySetMode;
                              if (newVaryBySet) {
                                setVaryBySetRows((prev) => new Set([...prev, ex.id]));
                                if (!perSetEditsByExerciseId.has(ex.id)) {
                                  // Start with backend set_targets or create empty array for this exercise's sets
                                  const baseEdits = ex.set_targets && ex.set_targets.length > 0
                                    ? ex.set_targets
                                    : Array.from({ length: numSets }, (_, i) => ({
                                        set_number: i + 1,
                                        target_reps: null,
                                        target_weight: null,
                                        target_duration_seconds: null,
                                      }));

                                  // Map over to seed Set 1 if it has no real override yet
                                  const initialEdits = baseEdits.map((setTarget) => {
                                    // For Set 1, if all fields are null, seed from main row
                                    if (setTarget.set_number === 1 && setTarget.target_reps === null && setTarget.target_weight === null && setTarget.target_duration_seconds === null) {
                                      return {
                                        ...setTarget,
                                        target_reps: ex.target_reps,
                                        target_weight: ex.target_weight,
                                        target_duration_seconds: ex.target_duration_seconds,
                                      };
                                    }
                                    // For Set 1 with real overrides, or Sets 2+, keep as-is
                                    return setTarget;
                                  });

                                  setPerSetEditsByExerciseId((prev) => new Map(prev).set(ex.id, initialEdits));
                                }
                              } else {
                                setVaryBySetRows((prev) => {
                                  const updated = new Set(prev);
                                  updated.delete(ex.id);
                                  return updated;
                                });
                              }
                            }}
                            className={`btn vary-by-set-btn ${isVaryBySetMode ? 'btn-primary' : ''}`}
                            disabled={isLinkedWeek}
                            title="Edit per-set overrides"
                            style={{ fontSize: '12px', padding: '8px 12px' }}
                          >
                            Vary by set
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, type: 'exercise', dayId: currentDay.id, exerciseId: ex.id })}
                            className="row-delete-btn"
                            disabled={isLinkedWeek}
                            title="Remove exercise"
                            aria-label="Remove exercise"
                          >
                            <TrashIcon size={15} />
                          </button>
                        </div>
                      </div>

                      {isVaryBySetMode && (
                        <div className="set-detail-panel">
                          <div className="set-detail-panel-title">Per-Set Overrides</div>
                          {Array.from({ length: numSets }, (_, i) => {
                            const setNum = i + 1;
                            const currentSetEdit = perSetEdits.find((s) => s.set_number === setNum) || { set_number: setNum, target_reps: null, target_weight: null, target_duration_seconds: null };
                            return (
                              <div key={setNum} className="set-line">
                                <span>Set {setNum}</span>
                                {ex.has_reps && (
                                  <input
                                    type="text"
                                    value={currentSetEdit.target_reps || ''}
                                    onChange={(e) => {
                                      const newValue = e.target.value || null;
                                      const updated = perSetEdits.map((s) =>
                                        s.set_number === setNum ? { ...s, target_reps: newValue } : s
                                      );
                                      setPerSetEditsByExerciseId((prev) => new Map(prev).set(ex.id, updated));
                                      // Sync Set 1 to the main row
                                      if (setNum === 1) {
                                        handleUpdateExercise(ex.id, 'reps', newValue);
                                      }
                                    }}
                                    placeholder="Reps (e.g. 10-12)"
                                    className="input-field"
                                  />
                                )}
                                {ex.has_weight && (
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={currentSetEdit.target_weight || ''}
                                    onChange={(e) => {
                                      const newValue = e.target.value ? Number(e.target.value) : null;
                                      const updated = perSetEdits.map((s) =>
                                        s.set_number === setNum ? { ...s, target_weight: newValue } : s
                                      );
                                      setPerSetEditsByExerciseId((prev) => new Map(prev).set(ex.id, updated));
                                      // Sync Set 1 to the main row
                                      if (setNum === 1) {
                                        handleUpdateExercise(ex.id, 'weight', newValue);
                                      }
                                    }}
                                    placeholder="Weight"
                                    className="input-field"
                                  />
                                )}
                                {ex.has_duration && (
                                  <DurationInput
                                    value={currentSetEdit.target_duration_seconds || null}
                                    onChange={(value) => {
                                      const newValue = value || null;
                                      const updated = perSetEdits.map((s) =>
                                        s.set_number === setNum ? { ...s, target_duration_seconds: newValue } : s
                                      );
                                      setPerSetEditsByExerciseId((prev) => new Map(prev).set(ex.id, updated));
                                      // Sync Set 1 to the main row
                                      if (setNum === 1) {
                                        handleUpdateExercise(ex.id, 'target_duration_seconds', newValue);
                                      }
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                          <button
                            onClick={async () => {
                              if (props.isCreateMode && !isLinkedWeek) {
                                // Draft-only: edits already in perSetEditsByExerciseId
                                setSavingSetTargets((prev) => new Set([...prev, ex.id]));
                                await new Promise(r => setTimeout(r, 300)); // Brief save animation
                                setSavingSetTargets((prev) => {
                                  const updated = new Set(prev);
                                  updated.delete(ex.id);
                                  return updated;
                                });
                                setSavedSetTargets((prev) => new Set([...prev, ex.id]));
                                await new Promise(r => setTimeout(r, 700));
                                setVaryBySetRows((prev) => {
                                  const updated = new Set(prev);
                                  updated.delete(ex.id);
                                  return updated;
                                });
                                setSavedSetTargets((prev) => {
                                  const updated = new Set(prev);
                                  updated.delete(ex.id);
                                  return updated;
                                });
                              } else if (planId && !isLinkedWeek) {
                                setSavingSetTargets((prev) => new Set([...prev, ex.id]));
                                try {
                                  const perSetEdits = perSetEditsByExerciseId.get(ex.id) || [];
                                  await replaceSetTargets(planId, currentDay.id, ex.id, perSetEdits);
                                  // Show "Saved" state
                                  setSavingSetTargets((prev) => {
                                    const updated = new Set(prev);
                                    updated.delete(ex.id);
                                    return updated;
                                  });
                                  setSavedSetTargets((prev) => new Set([...prev, ex.id]));
                                  // Wait for user to register the state change
                                  await new Promise(r => setTimeout(r, 700));
                                  // Then collapse panel and reload
                                  setVaryBySetRows((prev) => {
                                    const updated = new Set(prev);
                                    updated.delete(ex.id);
                                    return updated;
                                  });
                                  await loadPlanForEdit();
                                  // Clean up saved state
                                  setSavedSetTargets((prev) => {
                                    const updated = new Set(prev);
                                    updated.delete(ex.id);
                                    return updated;
                                  });
                                } catch (err) {
                                  setError((err as Error).message);
                                  // Clean up both states on error
                                  setSavingSetTargets((prev) => {
                                    const updated = new Set(prev);
                                    updated.delete(ex.id);
                                    return updated;
                                  });
                                  setSavedSetTargets((prev) => {
                                    const updated = new Set(prev);
                                    updated.delete(ex.id);
                                    return updated;
                                  });
                                }
                              }
                            }}
                            className={`btn set-save-button ${savedSetTargets.has(ex.id) ? 'btn-secondary' : 'btn-primary'}`}
                            disabled={isLinkedWeek || savingSetTargets.has(ex.id) || savedSetTargets.has(ex.id)}
                          >
                            {savingSetTargets.has(ex.id) ? 'Saving...' : savedSetTargets.has(ex.id) ? '✓ Saved' : 'Save set targets'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Exercise Form */}
              <div style={{ marginBottom: '12px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-h)' }}>
                Add exercises using the panel on the right →
              </div>
            </>
          )}

          {currentDay?.is_rest && (
            <div style={{ padding: '16px', backgroundColor: 'var(--code-bg)', borderRadius: '4px', textAlign: 'center', marginBottom: '12px' }}>
              <p style={{ margin: 0, color: 'var(--text)', fontSize: '14px' }}>
                Rest day / No exercises scheduled
              </p>
            </div>
          )}
        </>
      )}

      {!props.isCreateMode && isQuickStart && (
        <button
          onClick={handleAddDay}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '12px', marginTop: '12px' }}
        >
          + Add Day
        </button>
      )}

      {/* Save Button (create mode) or Close Button (edit mode) */}
      {props.isCreateMode ? (
        <button
          onClick={() => setShowSaveConfirm(true)}
          disabled={saving}
          className="btn btn-success"
          style={{ width: '100%', padding: '12px', marginTop: '20px' }}
        >
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
      ) : (
        <button
          onClick={() => navigate('/workout-plans')}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', marginTop: '20px' }}
        >
          Done
        </button>
      )}

      {/* Back Confirm Dialog (create mode only) */}
      <ConfirmDialog
        isOpen={showBackConfirm}
        title="Leave plan creation?"
        message="Are you sure you want to go back? Your progress won't be saved."
        confirmText="Go back"
        cancelText="Stay"
        isDangerous={true}
        onConfirm={() => navigate('/workout-plans')}
        onCancel={() => setShowBackConfirm(false)}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.type === 'exercise' ? 'Remove Exercise' : 'Delete Day'}
        message={deleteConfirm.type === 'exercise' ? 'Are you sure you want to remove this exercise?' : 'Are you sure you want to delete this day?'}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={() => {
          if (deleteConfirm.type === 'exercise' && deleteConfirm.exerciseId) {
            handleRemoveExercise(deleteConfirm.exerciseId);
          }
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, type: 'day' })}
      />

      {/* Save Confirm Dialog (create mode only) */}
      <ConfirmDialog
        isOpen={showSaveConfirm}
        title="Save this plan?"
        message="Even if it's not finished yet, it'll be saved. You can edit it anytime."
        confirmText="Save"
        cancelText="Keep editing"
        onConfirm={() => {
          setShowSaveConfirm(false);
          handleSavePlan();
        }}
        onCancel={() => setShowSaveConfirm(false)}
      />

      {Toast}
      </div>

      {/* Exercise Library Sidebar */}
      <div style={{ width: '320px', maxWidth: '30vw', display: 'flex', flexDirection: 'column' }}>
        <ExerciseLibrarySidebar onSelectExercise={handleQuickAddExercise} onExerciseCreated={handleExerciseCreated} />
      </div>
    </div>
  );
};
