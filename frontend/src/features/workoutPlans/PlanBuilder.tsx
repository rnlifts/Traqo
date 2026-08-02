import { useState, useEffect, useRef } from 'react';
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
import { TrashIcon, InfoIcon, ChevronDownIcon, NoteIcon } from '../../components/icons';
import { ExerciseLibrarySidebar, type SelectedExerciseInfo } from '../exerciseLibrary/ExerciseLibrarySidebar';
import { ExercisePreviewPanel } from '../../components/ExercisePreviewPanel';
import { Modal } from '../../components/Modal';
import { getYoutubeThumbnailUrl } from '../../utils/youtube';

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

// Chip button for "remove this field from tracking" (Reps ✕ / Weight ✕ / Duration ✕).
// Plain inline styles — .field-remove-badge is absolutely positioned for a different
// layout (a corner badge overlapping an input) and breaks when used as a normal chip.
const toggleChipStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  color: 'var(--text-h)',
  padding: '0 10px',
  borderRadius: '8px',
  fontSize: '12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  height: '38px',
};

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

  // Exercise preview panel state
  const [selectedPreview, setSelectedPreview] = useState<{ name: string; video_url: string | null } | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Guards against a rapid double-tap on "+ Add" firing two create requests
  // for the same exercise before the first one's response updates the cache.
  const pendingAddsRef = useRef<Set<string>>(new Set());

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobile(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Exercise picker modal state (mobile only)
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  // Preview modal state (mobile only)
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Set list UI state - which set is expanded per exercise (pure UI state, not derived from backend)
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<number>>(new Set());

  // Auto-save debounce refs
  const autoSaveTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Tracks which (exercise, set, field) values are still "inherited" from an earlier set
  // and therefore eligible to be overwritten by a future cascade — vs. independently typed
  // by the user (or loaded from an existing plan), which are never auto-overwritten.
  // Keyed as `${exerciseId}:${setNumber}:${field}`. Reset per plan load (not persisted).
  const inheritedSetFieldsRef = useRef<Set<string>>(new Set());

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
            set_targets: ex.set_targets || [],
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
                set_targets: ex.set_targets || [],
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
      // Edit mode - patch local state
      try {
        await updateDay(planId, currentDay.id, { is_rest: newRestState });
        showToast('Day updated!', 'success');
        // Patch local state instead of reloading
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
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  // Core logic: find-or-create exercise and add to current day
  // Shared by both form submission and sidebar quick-add
  async function addExerciseToCurrentDay(
    exerciseInfo: SelectedExerciseInfo,
    targetSetsValue: string | null,
    targetRepsValue: string | null,
    targetWeightValue: string | null,
    targetDurationValue: number | null,
    hasReps: boolean,
    hasWeight: boolean,
    hasDuration: boolean,
    notesValue: string,
  ) {
    const name = exerciseInfo.name;
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
      // This is a library exercise being added to a plan for the first time
      // Mark it as not custom (is_custom: false) so it doesn't pollute the Custom Exercises tab
      // Pass through video_url, muscle_group, and equipment from the library exercise
      const newExercise = await exercisesApi.create({
        name,
        video_url: exerciseInfo.video_url,
        muscle_group: exerciseInfo.muscle_group,
        equipment: exerciseInfo.equipment,
        is_custom: false,
      });
      exerciseId = newExercise.id;
      setAvailableExercises([...availableExercises, newExercise]);
    }

    const sets = targetSetsValue ? Number(targetSetsValue) : 1;
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
        video_url: exerciseInfo.video_url || null,
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
      setExpandedExerciseIds((prev) => new Set(prev).add(newExercise.id));
    } else if (planId) {
      // Edit mode - patch local state
      const created = await addExerciseToDay(planId, currentDay.id, exerciseId, sets, reps, weight, durationSeconds, hasReps, hasWeight, hasDuration);
      setExpandedExerciseIds((prev) => new Set(prev).add(created.id));
      showToast('Exercise added!', 'success');
      // Patch local state instead of reloading
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? { ...d, exercises: [...d.exercises, created] }
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
                    ? { ...d, exercises: [...d.exercises, created] }
                    : d
                ),
              };
            }
            return week;
          })
        );
      }
    }
  }

  // Quick-add from sidebar: add exercise immediately with default targets
  async function handleQuickAddExercise(exerciseInfo: SelectedExerciseInfo) {
    const key = exerciseInfo.name.toLowerCase();
    if (pendingAddsRef.current.has(key)) return; // ignore rapid double-tap on the same exercise
    pendingAddsRef.current.add(key);
    try {
      await addExerciseToCurrentDay(
        exerciseInfo,
        null, // targetSets: empty
        null, // targetReps: empty
        null, // targetWeight: empty
        null, // targetDuration: empty
        true, // has_reps: default to true
        true, // has_weight: default to true
        false, // has_duration: default to false
        '' // notes: empty
      );
      showToast(`${exerciseInfo.name} added to ${draftUnitType === 'days' ? 'day' : 'week'}!`, 'success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      pendingAddsRef.current.delete(key);
    }
  }

  // Handle exercise preview selection from sidebar or day list
  function handlePreviewExercise(exerciseInfo: SelectedExerciseInfo) {
    setSelectedPreview({
      name: exerciseInfo.name,
      video_url: exerciseInfo.video_url || null,
    });
    if (isMobile) {
      setShowPreviewModal(true);
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
      // Edit mode - patch local state
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
        // Patch local state instead of reloading
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) =>
              d.id === currentDay.id
                ? {
                    ...d,
                    exercises: d.exercises.map((ex) =>
                      ex.id === exerciseId ? { ...ex, ...updates } : ex
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
                            ex.id === exerciseId ? { ...ex, ...updates } : ex
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
        // Patch local state instead of reloading
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
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  // Derive sets for an exercise from backend set_targets or synthesize Set 1
  function getSetsList(ex: WorkoutExercise): Array<{ set_number: number; target_reps: string | null; target_weight: number | null; target_duration_seconds: number | null }> {
    if (ex.set_targets && ex.set_targets.length > 0) {
      return ex.set_targets;
    }
    // Synthesize Set 1 from main row fields
    return [{
      set_number: 1,
      target_reps: ex.target_reps || null,
      target_weight: ex.target_weight || null,
      target_duration_seconds: ex.target_duration_seconds || null,
    }];
  }

  // Update a set's value (reps, weight, duration)
  async function handleUpdateSet(exerciseId: number, setNumber: number, field: string, value: any) {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    const ex = currentDay.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const currentSets = getSetsList(ex);
    const setIndex = currentSets.findIndex((s) => s.set_number === setNumber);
    if (setIndex === -1) return;

    const updatedSet = { ...currentSets[setIndex] };
    if (field === 'reps') updatedSet.target_reps = value || null;
    if (field === 'weight') updatedSet.target_weight = value || null;
    if (field === 'duration') updatedSet.target_duration_seconds = value || null;

    const updatedSets = [...currentSets];
    updatedSets[setIndex] = updatedSet;

    // This set's value was just typed directly by the user — it's independent now,
    // never auto-overwritten by a future cascade from an earlier set.
    inheritedSetFieldsRef.current.delete(`${exerciseId}:${setNumber}:${field}`);

    // Cascade the new value forward to subsequent sets, but only ones that are still
    // empty or still "inherited" (never independently edited). Stop at the first set
    // that has its own independently-set value — the chain is broken there.
    let cascadeValue: any =
      field === 'reps' ? updatedSet.target_reps
      : field === 'weight' ? updatedSet.target_weight
      : updatedSet.target_duration_seconds;

    for (let i = setIndex + 1; i < updatedSets.length; i++) {
      const nextSet = updatedSets[i];
      const nextKey = `${exerciseId}:${nextSet.set_number}:${field}`;
      const nextValue =
        field === 'reps' ? nextSet.target_reps
        : field === 'weight' ? nextSet.target_weight
        : nextSet.target_duration_seconds;
      const isEligible = nextValue === null || inheritedSetFieldsRef.current.has(nextKey);
      if (!isEligible) break;

      const cascadedSet = { ...nextSet };
      if (field === 'reps') cascadedSet.target_reps = cascadeValue;
      if (field === 'weight') cascadedSet.target_weight = cascadeValue;
      if (field === 'duration') cascadedSet.target_duration_seconds = cascadeValue;
      updatedSets[i] = cascadedSet;
      inheritedSetFieldsRef.current.add(nextKey);
    }

    // Update draft in create mode
    if (props.isCreateMode) {
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? {
                  ...d,
                  exercises: d.exercises.map((e) =>
                    e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
                        exercises: d.exercises.map((e) =>
                          e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
      // Edit mode: single debounced write combining both set_targets and exercise fields
      const timeoutId = autoSaveTimeoutsRef.current.get(exerciseId);
      if (timeoutId) clearTimeout(timeoutId);

      const newTimeoutId = setTimeout(async () => {
        try {
          const exerciseUpdates: any = { target_sets: updatedSets.length };
          // For Set 1, also update the exercise-level field
          if (setNumber === 1) {
            if (field === 'reps') exerciseUpdates.target_reps = updatedSet.target_reps;
            if (field === 'weight') exerciseUpdates.target_weight = updatedSet.target_weight;
            if (field === 'duration') exerciseUpdates.target_duration_seconds = updatedSet.target_duration_seconds;
          }
          await Promise.all([
            replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
            updateExerciseInDay(planId, currentDay.id, exerciseId, exerciseUpdates),
          ]);
          // Patch local state instead of reloading (values already known)
          if (draftUnitType === 'days') {
            setDraftDays((prev) =>
              prev.map((d) =>
                d.id === currentDay.id
                  ? {
                      ...d,
                      exercises: d.exercises.map((e) =>
                        e.id === exerciseId ? { ...e, set_targets: updatedSets, ...exerciseUpdates } : e
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
                            exercises: d.exercises.map((e) =>
                              e.id === exerciseId ? { ...e, set_targets: updatedSets, ...exerciseUpdates } : e
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
        } catch (err) {
          setError((err as Error).message);
        }
      }, 500);

      autoSaveTimeoutsRef.current.set(exerciseId, newTimeoutId);
    }
  }

  // Add a new set to an exercise
  async function handleAddSet(exerciseId: number) {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    const ex = currentDay.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const currentSets = getSetsList(ex);
    const lastSet = currentSets[currentSets.length - 1];
    const newSet = {
      set_number: lastSet.set_number + 1,
      target_reps: lastSet.target_reps,
      target_weight: lastSet.target_weight,
      target_duration_seconds: lastSet.target_duration_seconds,
    };

    // The new set is a one-time copy, not independently typed — keep it cascade-eligible
    // so a later edit to an earlier set can still flow into it.
    (['reps', 'weight', 'duration'] as const).forEach((field) => {
      inheritedSetFieldsRef.current.add(`${exerciseId}:${newSet.set_number}:${field}`);
    });

    const updatedSets = [...currentSets, newSet];

    // Update draft in create mode
    if (props.isCreateMode) {
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? {
                  ...d,
                  exercises: d.exercises.map((e) =>
                    e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
                        exercises: d.exercises.map((e) =>
                          e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
      // Edit mode: patch local state
      try {
        await Promise.all([
          replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
          updateExerciseInDay(planId, currentDay.id, exerciseId, { target_sets: updatedSets.length }),
        ]);
        // Patch local state instead of reloading (values already known)
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) =>
              d.id === currentDay.id
                ? {
                    ...d,
                    exercises: d.exercises.map((e) =>
                      e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
                          exercises: d.exercises.map((e) =>
                            e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }

  // Remove a set from an exercise
  async function handleRemoveSet(exerciseId: number, setNumber: number) {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    const ex = currentDay.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const currentSets = getSetsList(ex);
    if (currentSets.length <= 1) return; // Can't remove the last set

    const updatedSets = currentSets
      .filter((s) => s.set_number !== setNumber)
      .map((s, idx) => ({
        ...s,
        set_number: idx + 1,
      }));

    // Removing a set renumbers everything after it, which would make the cascade
    // "inherited" tracking (keyed by set_number) point at the wrong sets. Clear it for
    // this exercise — safe default, remaining sets are simply treated as independent
    // until the user edits one again.
    for (const key of Array.from(inheritedSetFieldsRef.current)) {
      if (key.startsWith(`${exerciseId}:`)) {
        inheritedSetFieldsRef.current.delete(key);
      }
    }

    // Update draft in create mode
    if (props.isCreateMode) {
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? {
                  ...d,
                  exercises: d.exercises.map((e) =>
                    e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
                        exercises: d.exercises.map((e) =>
                          e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
      // Edit mode: patch local state
      try {
        await Promise.all([
          replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
          updateExerciseInDay(planId, currentDay.id, exerciseId, { target_sets: updatedSets.length }),
        ]);
        // Patch local state instead of reloading (values already known)
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) =>
              d.id === currentDay.id
                ? {
                    ...d,
                    exercises: d.exercises.map((e) =>
                      e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
                          exercises: d.exercises.map((e) =>
                            e.id === exerciseId ? { ...e, set_targets: updatedSets, target_sets: updatedSets.length } : e
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
        // Backend creates new day/exercise IDs during customization.
        // API response doesn't include full nested data, so reload to get correct IDs.
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
        // Patch local state: set mode='linked' and days=[]
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
    <div style={{ display: 'flex', height: '100vh', flexDirection: isMobile ? 'column' : 'row' }}>
      {/* Main Content */}
      <div ref={pageContainerRef} className="page-container" style={{ flex: 1, overflowY: 'auto' }}>
      {/* Top Header with Back Button, Plan Name, and Preview Panel (desktop only) */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'flex-start' }}>
        {/* Left Column: Back Button and Plan Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
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
        </div>

        {/* Right Column: Exercise Preview Panel (desktop only) */}
        {!isMobile && (
          <div style={{ flexShrink: 0 }}>
            <ExercisePreviewPanel selected={selectedPreview} fullWidth={false} />
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
                  const sets = getSetsList(ex);
                  const isExpanded = expandedExerciseIds.has(ex.id);
                  const summaryText = [
                    `${sets.length} set${sets.length === 1 ? '' : 's'}`,
                    ex.has_reps && ex.target_reps ? `${ex.target_reps} reps` : null,
                    ex.has_weight && ex.target_weight ? `${ex.target_weight} lbs` : null,
                    ex.has_duration && ex.target_duration_seconds
                      ? `${Math.floor(ex.target_duration_seconds / 60)}:${String(ex.target_duration_seconds % 60).padStart(2, '0')}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div
                      key={ex.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        marginBottom: '12px',
                        overflow: 'hidden',
                        opacity: isLinkedWeek ? 0.6 : 1,
                      }}
                    >
                      {/* Header: thumbnail, name, collapsed summary, remove, expand toggle */}
                      <div
                        onClick={() => {
                          handlePreviewExercise({
                            name: ex.exercise_name || `Exercise ${ex.exercise_id}`,
                            video_url: ex.video_url || null,
                          });
                          if (isMobile) {
                            setShowPreviewModal(true);
                          } else {
                            try {
                              pageContainerRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
                            } catch {
                              // Scroll may not be available in test environment
                            }
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          cursor: isLinkedWeek ? 'default' : 'pointer',
                          pointerEvents: isLinkedWeek ? 'none' : 'auto',
                        }}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {getYoutubeThumbnailUrl(ex.video_url) ? (
                            <img
                              src={getYoutubeThumbnailUrl(ex.video_url)!}
                              alt={ex.exercise_name || `Exercise ${ex.exercise_id}`}
                              style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-h)',
                                fontSize: '20px',
                              }}
                            >
                              🏋️
                            </div>
                          )}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '-4px',
                              left: '-4px',
                              backgroundColor: 'var(--accent)',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {idx + 1}
                          </span>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '14px',
                              color: 'var(--text-h)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ex.exercise_name || `Exercise ${ex.exercise_id}`}
                          </div>
                          {!isExpanded && (
                            <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '2px' }}>
                              {summaryText}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ isOpen: true, type: 'exercise', dayId: currentDay.id, exerciseId: ex.id });
                          }}
                          className="row-delete-btn"
                          disabled={isLinkedWeek}
                          title="Remove exercise"
                          aria-label="Remove exercise"
                        >
                          <TrashIcon size={15} />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedExerciseIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(ex.id)) {
                                next.delete(ex.id);
                              } else {
                                next.add(ex.id);
                              }
                              return next;
                            });
                          }}
                          disabled={isLinkedWeek}
                          aria-label={isExpanded ? `Collapse ${ex.exercise_name || 'exercise'}` : `Expand ${ex.exercise_name || 'exercise'}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-h)',
                            padding: '4px',
                            display: 'flex',
                            flexShrink: 0,
                            transition: 'transform 0.15s',
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                          }}
                        >
                          <ChevronDownIcon size={18} />
                        </button>
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '12px' }}>
                          {/* Exercise-level field toggles */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                            {ex.has_reps ? (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_reps', false)}
                                disabled={isLinkedWeek}
                                title="Remove reps tracking"
                                style={toggleChipStyle}
                              >
                                Reps ✕
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_reps', true)}
                                className="field-restore-chip"
                                disabled={isLinkedWeek}
                              >
                                + Reps
                              </button>
                            )}
                            {ex.has_weight ? (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_weight', false)}
                                disabled={isLinkedWeek}
                                title="Remove weight tracking"
                                style={toggleChipStyle}
                              >
                                Weight ✕
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_weight', true)}
                                className="field-restore-chip"
                                disabled={isLinkedWeek}
                              >
                                + Weight
                              </button>
                            )}
                            {ex.has_duration ? (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_duration', false)}
                                disabled={isLinkedWeek}
                                title="Remove duration tracking"
                                style={toggleChipStyle}
                              >
                                Duration ✕
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_duration', true)}
                                className="field-restore-chip"
                                disabled={isLinkedWeek}
                              >
                                + Duration
                              </button>
                            )}
                            <span
                              title="Target time to sustain this exercise (e.g. treadmill, plank) — not how long the set took."
                              style={{ cursor: 'help', display: 'flex', alignItems: 'center', color: 'var(--text-h)' }}
                            >
                              <InfoIcon style={{ width: '14px', height: '14px' }} />
                            </span>
                          </div>

                          {/* Notes (exercise-level, not per-set) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-h)', marginBottom: '12px' }}>
                            <NoteIcon size={14} style={{ flexShrink: 0 }} />
                            <input
                              type="text"
                              value={ex.notes || ''}
                              onChange={(e) => handleUpdateExercise(ex.id, 'notes', e.target.value)}
                              placeholder="Notes"
                              className="input-field"
                              disabled={isLinkedWeek}
                              style={{ flex: 1 }}
                            />
                          </div>

                          {/* Sets — all shown fully, no per-set collapse */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sets.map((set) => (
                              <div
                                key={set.set_number}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '10px',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--surface)',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    backgroundColor: 'var(--accent-soft)',
                                    color: 'var(--accent)',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {set.set_number}
                                </span>
                                {ex.has_reps && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
                                      Reps
                                    </span>
                                    <input
                                      type="text"
                                      value={set.target_reps || ''}
                                      onChange={(e) => handleUpdateSet(ex.id, set.set_number, 'reps', e.target.value)}
                                      placeholder="e.g. 10 or 10-12"
                                      className="input-field"
                                      disabled={isLinkedWeek}
                                      style={{ width: '130px', fontSize: '13px' }}
                                    />
                                  </div>
                                )}
                                {ex.has_weight && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
                                      Weight
                                    </span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={set.target_weight || ''}
                                      onChange={(e) => handleUpdateSet(ex.id, set.set_number, 'weight', e.target.value ? Number(e.target.value) : null)}
                                      placeholder="Weight"
                                      className="input-field"
                                      disabled={isLinkedWeek}
                                      style={{ width: '90px', fontSize: '13px' }}
                                    />
                                  </div>
                                )}
                                {ex.has_duration && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
                                      Duration
                                    </span>
                                    <DurationInput
                                      value={set.target_duration_seconds || null}
                                      onChange={(value) => handleUpdateSet(ex.id, set.set_number, 'duration', value)}
                                    />
                                  </div>
                                )}
                                {sets.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveSet(ex.id, set.set_number)}
                                    className="row-delete-btn"
                                    disabled={isLinkedWeek}
                                    title={`Remove Set ${set.set_number}`}
                                    aria-label={`Remove Set ${set.set_number}`}
                                    style={{ marginLeft: 'auto', flexShrink: 0 }}
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add Set Button */}
                          <button
                            onClick={() => handleAddSet(ex.id)}
                            disabled={isLinkedWeek}
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              padding: '10px',
                              marginTop: '8px',
                              width: '100%',
                              background: 'transparent',
                              border: '1px dashed var(--border)',
                              borderRadius: '8px',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                            }}
                          >
                            + Add Set
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Exercise Hint */}
              <div style={{ marginBottom: '12px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-h)' }}>
                {isMobile ? 'Tap "+ Add Exercise" to browse and add exercises' : 'Add exercises using the panel on the right →'}
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

      {/* Mobile Exercise Picker Button */}
      {isMobile && (
        <button
          onClick={() => setShowExercisePicker(true)}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '20px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          + Add Exercise
        </button>
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

      {/* Exercise Picker Modal (mobile only) */}
      {isMobile && (
        <Modal
          isOpen={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          title="Add Exercise"
          fullScreen={true}
        >
          <div style={{ padding: '12px 16px', paddingTop: '0' }}>
            <ExerciseLibrarySidebar onSelectExercise={handleQuickAddExercise} onExerciseCreated={handleExerciseCreated} onPreviewExercise={handlePreviewExercise} />
          </div>
        </Modal>
      )}

      {/* Preview Modal (mobile only) */}
      {isMobile && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title={selectedPreview?.name || 'Exercise Preview'}
          fullScreen={true}
        >
          <div style={{ padding: '12px 16px', paddingTop: '0' }}>
            <ExercisePreviewPanel selected={selectedPreview} fullWidth={true} />
          </div>
        </Modal>
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

      {/* Exercise Library Sidebar (desktop only) */}
      {!isMobile && (
        <div style={{ width: '320px', maxWidth: '30vw', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <ExerciseLibrarySidebar onSelectExercise={handleQuickAddExercise} onExerciseCreated={handleExerciseCreated} onPreviewExercise={handlePreviewExercise} />
        </div>
      )}
    </div>
  );
};
