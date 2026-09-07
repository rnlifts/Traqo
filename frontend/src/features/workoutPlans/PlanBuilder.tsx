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
import { TrashIcon, InfoIcon, ChevronDownIcon, NoteIcon, CopyIcon } from '../../components/icons';
import { ExerciseLibrarySidebar, type SelectedExerciseInfo } from '../exerciseLibrary/ExerciseLibrarySidebar';
import { ExercisePreviewPanel } from '../../components/ExercisePreviewPanel';
import { Modal } from '../../components/Modal';
import { getYoutubeThumbnailUrl } from '../../utils/youtube';
import { useLanguage } from '../../contexts/LanguageContext';
import { getClipboard, setClipboard, clearClipboard, type ClipboardExercise } from '../../utils/exerciseClipboard';

interface PlanDraft {
  name: string;
  unitType: 'days' | 'weeks';
  totalUnits: number;
}

interface Exercise {
  id: number;
  name: string;
  logging_type: string;
  video_url?: string | null;
  muscle_group?: string | null;
  equipment?: string | null;
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
  const { t } = useLanguage();

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
  // Per-day custom nickname (e.g. "Chest Day"), shown alongside the existing
  // "Day 1" label rather than replacing it. Only editable once the plan
  // already exists (matches the plan-name rename affordance's own
  // !props.isCreateMode gating) -- the create-plan payload doesn't carry
  // this field, so allowing it pre-save would silently drop it.
  const [isEditingDayCustomName, setIsEditingDayCustomName] = useState(false);
  const [dayCustomNameInput, setDayCustomNameInput] = useState('');

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

  // Copy/paste exercises: select mode + the current localStorage clipboard contents.
  // The clipboard itself lives outside React state (see utils/exerciseClipboard) so it
  // survives navigating to a different plan; clipboardExercises just mirrors it locally
  // so the "Paste N" button re-renders after a copy/paste/clear.
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<number>>(new Set());
  const [clipboardExercises, setClipboardExercises] = useState<ClipboardExercise[]>(() => getClipboard());
  const [pasting, setPasting] = useState(false);

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
      showToast(t.planBuilder.dayAdded, 'success');
    } catch (err: any) {
      setError(err.response?.data?.error || t.planBuilder.addDayFailed);
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
      setError(t.planBuilder.nameRequired);
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
          custom_name: day.custom_name || null,
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
              custom_name: day.custom_name || null,
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
      showToast(t.planBuilder.createdSuccess, 'success');
      navigate('/workout-plans');
    } catch (err: any) {
      setError(err.response?.data?.error || (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePlanName() {
    if (!props.isCreateMode && planId && renamePlanName.trim()) {
      const previousName = draftName;
      // Optimistic: update UI immediately
      setDraftName(renamePlanName);
      setIsRenamingPlan(false);
      // Fire API call in background
      updateWorkoutPlan(planId, renamePlanName).catch((err) => {
        // On failure: revert and show error
        setDraftName(previousName);
        setIsRenamingPlan(true);
        setError((err as Error).message);
      });
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
      // Edit mode - optimistic update: patch local state immediately
      const previousRestState = currentDay.is_rest || false;
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
      // Fire API call in background
      updateDay(planId, currentDay.id, { is_rest: newRestState }).catch((err) => {
        // On failure: revert to previous state
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) =>
              d.id === currentDay.id ? { ...d, is_rest: previousRestState } : d
            )
          );
        } else {
          setDraftWeeks((prev) =>
            prev.map((week, wIdx) => {
              if (wIdx === activeWeekIndex) {
                return {
                  ...week,
                  days: week.days.map((d) =>
                    d.id === currentDay.id ? { ...d, is_rest: previousRestState } : d
                  ),
                };
              }
              return week;
            })
          );
        }
        setError((err as Error).message);
      });
    }
  }

  async function handleUpdateDayCustomName() {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    const trimmed = dayCustomNameInput.trim();
    const previousCustomName = currentDay.custom_name;

    // Optimistic: patch local state immediately, same pattern as is_rest.
    if (draftUnitType === 'days') {
      setDraftDays((prev) =>
        prev.map((d) => (d.id === currentDay.id ? { ...d, custom_name: trimmed || null } : d))
      );
    } else {
      setDraftWeeks((prev) =>
        prev.map((week, wIdx) => {
          if (wIdx === activeWeekIndex) {
            return {
              ...week,
              days: week.days.map((d) =>
                d.id === currentDay.id ? { ...d, custom_name: trimmed || null } : d
              ),
            };
          }
          return week;
        })
      );
    }
    setIsEditingDayCustomName(false);

    // Create mode: the plan doesn't exist yet, so there's nothing to PATCH --
    // the value just lives in draft state until the create-plan payload
    // (which now includes custom_name) saves it along with everything else.
    if (props.isCreateMode || !planId) return;

    updateDay(planId, currentDay.id, { custom_name: trimmed }).catch((err) => {
      // On failure: revert to previous state
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) => (d.id === currentDay.id ? { ...d, custom_name: previousCustomName } : d))
        );
      } else {
        setDraftWeeks((prev) =>
          prev.map((week, wIdx) => {
            if (wIdx === activeWeekIndex) {
              return {
                ...week,
                days: week.days.map((d) =>
                  d.id === currentDay.id ? { ...d, custom_name: previousCustomName } : d
                ),
              };
            }
            return week;
          })
        );
      }
      setError((err as Error).message);
    });
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
    if (!name.trim()) throw new Error(t.planBuilder.exerciseNameRequired);

    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) throw new Error(t.planBuilder.noActiveDay);

    // Find or create exercise
    const existingExercise = availableExercises.find(
      (ex) => ex.name.toLowerCase() === name.toLowerCase()
    );

    let exerciseId: number;
    if (existingExercise) {
      exerciseId = existingExercise.id;
      // Backfill metadata if the existing exercise (e.g. one created earlier from a
      // bare typed name) is missing video/muscle group/equipment that this selection
      // has. Without this, re-picking the real library exercise silently keeps reusing
      // the metadata-less row and its video never shows up once added to a plan.
      const missingVideo = !existingExercise.video_url && !!exerciseInfo.video_url;
      const missingMuscleGroup = !existingExercise.muscle_group && !!exerciseInfo.muscle_group;
      const missingEquipment = !existingExercise.equipment && !!exerciseInfo.equipment;
      if (missingVideo || missingMuscleGroup || missingEquipment) {
        const updated = await exercisesApi.update(existingExercise.id, {
          name: existingExercise.name,
          video_url: exerciseInfo.video_url ?? existingExercise.video_url,
          muscle_group: exerciseInfo.muscle_group ?? existingExercise.muscle_group,
          equipment: exerciseInfo.equipment ?? existingExercise.equipment,
        });
        setAvailableExercises(
          availableExercises.map((ex) => (ex.id === existingExercise.id ? updated : ex))
        );
      }
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
      // Edit mode - optimistic: add with temporary ID immediately, reconcile when API responds
      const tempId = -(Date.now() + Math.random());
      const tempExercise: WorkoutExercise = {
        id: tempId,
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

      // Add to local state immediately with temp ID
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? { ...d, exercises: [...d.exercises, tempExercise] }
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
                    ? { ...d, exercises: [...d.exercises, tempExercise] }
                    : d
                ),
              };
            }
            return week;
          })
        );
      }
      setExpandedExerciseIds((prev) => new Set(prev).add(tempId));

      // Fire API call in background
      addExerciseToDay(planId, currentDay.id, exerciseId, sets, reps, weight, durationSeconds, hasReps, hasWeight, hasDuration)
        .then((created) => {
          // POST /days/{day_id}/exercises intentionally returns a lean response with no
          // exercise_name/video_url — carry over the values we already know locally
          // instead of letting them regress to the "Exercise {id}" fallback.
          const reconciled: WorkoutExercise = { ...created, exercise_name: name, video_url: exerciseInfo.video_url || null };
          // Reconcile temp ID with real ID
          if (draftUnitType === 'days') {
            setDraftDays((prev) =>
              prev.map((d) =>
                d.id === currentDay.id
                  ? {
                      ...d,
                      exercises: d.exercises.map((ex) =>
                        ex.id === tempId ? reconciled : ex
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
                              ex.id === tempId ? reconciled : ex
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
          setExpandedExerciseIds((prev) => {
            const next = new Set(prev);
            next.delete(tempId);
            next.add(created.id);
            return next;
          });
        })
        .catch((err) => {
          // On failure: remove the optimistically-added exercise
          if (draftUnitType === 'days') {
            setDraftDays((prev) =>
              prev.map((d) =>
                d.id === currentDay.id
                  ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== tempId) }
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
                        ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== tempId) }
                        : d
                    ),
                  };
                }
                return week;
              })
            );
          }
          setExpandedExerciseIds((prev) => {
            const next = new Set(prev);
            next.delete(tempId);
            return next;
          });
          setError((err as Error).message);
        });
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
      showToast(t.planBuilder.quickAddToast(exerciseInfo.name, draftUnitType === 'days' ? 'day' : 'week'), 'success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      pendingAddsRef.current.delete(key);
    }
  }

  // ---- Copy / paste exercises ----

  function toggleSelectMode() {
    setIsSelectMode((prev) => {
      if (prev) setSelectedExerciseIds(new Set());
      return !prev;
    });
  }

  function toggleExerciseSelected(exerciseId: number) {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  }

  // Full-fidelity serialization: everything needed to recreate this exercise
  // elsewhere — exercise identity + video, sets/reps/weight/duration, which
  // fields are tracked, notes, and any per-set custom targets. Deliberately
  // excludes id/plan_day_id/order_number, which only mean something in the
  // exercise's current location.
  function toClipboardExercise(ex: WorkoutExercise): ClipboardExercise {
    return {
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name || t.planBuilder.exerciseFallback(ex.exercise_id),
      video_url: ex.video_url || null,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight,
      target_duration_seconds: ex.target_duration_seconds,
      has_reps: ex.has_reps,
      has_weight: ex.has_weight,
      has_duration: ex.has_duration,
      notes: ex.notes || '',
      set_targets: ex.set_targets.map((st) => ({
        set_number: st.set_number,
        target_reps: st.target_reps,
        target_weight: st.target_weight,
        target_duration_seconds: st.target_duration_seconds,
      })),
    };
  }

  function handleCopySingle(ex: WorkoutExercise) {
    const toCopy = [toClipboardExercise(ex)];
    setClipboard(toCopy);
    setClipboardExercises(toCopy);
    showToast(t.planBuilder.exercisesCopiedToast(1), 'success');
  }

  function handleCopySelected() {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay) return;

    const toCopy = currentDay.exercises
      .filter((ex) => selectedExerciseIds.has(ex.id))
      .map(toClipboardExercise);

    if (toCopy.length === 0) return;

    setClipboard(toCopy);
    setClipboardExercises(toCopy);
    setIsSelectMode(false);
    setSelectedExerciseIds(new Set());
    showToast(t.planBuilder.exercisesCopiedToast(toCopy.length), 'success');
  }

  function handleClearClipboard() {
    clearClipboard();
    setClipboardExercises([]);
  }

  async function handlePasteClipboard() {
    const days = getActiveDays();
    const currentDay = days[activeDayIndex];
    if (!currentDay || clipboardExercises.length === 0 || pasting) return;

    setPasting(true);
    try {
      if (props.isCreateMode) {
        // Draft mode: no backend plan yet, just append full exercise objects locally.
        let nextTempId = -(Date.now());
        const pasted: WorkoutExercise[] = clipboardExercises.map((item) => ({
          id: nextTempId--,
          plan_day_id: currentDay.id,
          exercise_id: item.exercise_id,
          order_number: 0, // recomputed on save; display order follows array order
          target_sets: item.target_sets,
          target_reps: item.target_reps,
          target_weight: item.target_weight,
          target_duration_seconds: item.target_duration_seconds,
          has_reps: item.has_reps,
          has_weight: item.has_weight,
          has_duration: item.has_duration,
          set_targets: item.set_targets,
          notes: item.notes,
          exercise_name: item.exercise_name,
          video_url: item.video_url,
        }));

        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) => (d.id === currentDay.id ? { ...d, exercises: [...d.exercises, ...pasted] } : d))
          );
        } else {
          setDraftWeeks((prev) =>
            prev.map((week, wIdx) =>
              wIdx === activeWeekIndex
                ? { ...week, days: week.days.map((d) => (d.id === currentDay.id ? { ...d, exercises: [...d.exercises, ...pasted] } : d)) }
                : week
            )
          );
        }
      } else if (planId) {
        // Edit mode: create each exercise on the backend sequentially (so order_number
        // stays predictable), then follow up with notes / custom set-targets if the
        // copied exercise had any.
        for (const item of clipboardExercises) {
          const created = await addExerciseToDay(
            planId,
            currentDay.id,
            item.exercise_id,
            item.target_sets ?? undefined,
            item.target_reps ?? undefined,
            item.target_weight ?? undefined,
            item.target_duration_seconds ?? undefined,
            item.has_reps,
            item.has_weight,
            item.has_duration
          );

          // addExerciseToDay (and updateExerciseInDay) intentionally return a lean
          // response with no exercise_name/video_url — carry over the values from
          // the clipboard item instead of letting them regress to the "Exercise {id}"
          // fallback.
          let finalExercise: WorkoutExercise = { ...created, exercise_name: item.exercise_name, video_url: item.video_url };
          if (item.notes) {
            const updated = await updateExerciseInDay(planId, currentDay.id, created.id, { notes: item.notes });
            finalExercise = { ...finalExercise, ...updated, exercise_name: item.exercise_name, video_url: item.video_url };
          }
          if (item.set_targets.length > 0) {
            await replaceSetTargets(planId, currentDay.id, created.id, item.set_targets);
            finalExercise = { ...finalExercise, set_targets: item.set_targets };
          }

          if (draftUnitType === 'days') {
            setDraftDays((prev) =>
              prev.map((d) => (d.id === currentDay.id ? { ...d, exercises: [...d.exercises, finalExercise] } : d))
            );
          } else {
            setDraftWeeks((prev) =>
              prev.map((week, wIdx) =>
                wIdx === activeWeekIndex
                  ? { ...week, days: week.days.map((d) => (d.id === currentDay.id ? { ...d, exercises: [...d.exercises, finalExercise] } : d)) }
                  : week
              )
            );
          }
        }
      }

      showToast(t.planBuilder.exercisesPastedToast(clipboardExercises.length), 'success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPasting(false);
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
      // Edit mode - optimistic: update immediately
      // Capture previous values for rollback
      const exercise = currentDay.exercises.find((ex) => ex.id === exerciseId);
      if (!exercise) return;
      const previousValue = exercise[field as keyof WorkoutExercise];

      const updates: any = {};
      if (field === 'sets') updates.target_sets = value;
      if (field === 'reps') updates.target_reps = value;
      if (field === 'weight') updates.target_weight = value;
      if (field === 'target_duration_seconds') updates.target_duration_seconds = value;
      if (field === 'has_reps') updates.has_reps = value;
      if (field === 'has_weight') updates.has_weight = value;
      if (field === 'has_duration') updates.has_duration = value;
      if (field === 'notes') updates.notes = value;

      // Update local state immediately
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

      // Fire API call in background
      updateExerciseInDay(planId, currentDay.id, exerciseId, updates).catch((err) => {
        // On failure: revert the specific field
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) =>
              d.id === currentDay.id
                ? {
                    ...d,
                    exercises: d.exercises.map((ex) =>
                      ex.id === exerciseId ? { ...ex, [field]: previousValue } : ex
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
                            ex.id === exerciseId ? { ...ex, [field]: previousValue } : ex
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
        setError((err as Error).message);
      });
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
      // Edit mode - optimistic: remove immediately
      // Capture the exercise for rollback
      const exerciseToRemove = currentDay.exercises.find((ex) => ex.id === exerciseId);
      if (!exerciseToRemove) return;
      const exerciseIndex = currentDay.exercises.indexOf(exerciseToRemove);

      // Remove from local state immediately
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

      // Fire API call in background
      removeExerciseFromDay(planId, currentDay.id, exerciseId).catch((err) => {
        // On failure: re-insert the exercise at its original position
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) => {
              if (d.id === currentDay.id) {
                const newExercises = [...d.exercises];
                newExercises.splice(exerciseIndex, 0, exerciseToRemove);
                return { ...d, exercises: newExercises };
              }
              return d;
            })
          );
        } else {
          setDraftWeeks((prev) =>
            prev.map((week, wIdx) => {
              if (wIdx === activeWeekIndex) {
                return {
                  ...week,
                  days: week.days.map((d) => {
                    if (d.id === currentDay.id) {
                      const newExercises = [...d.exercises];
                      newExercises.splice(exerciseIndex, 0, exerciseToRemove);
                      return { ...d, exercises: newExercises };
                    }
                    return d;
                  }),
                };
              }
              return week;
            })
          );
        }
        setError((err as Error).message);
      });
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
      // Edit mode: optimistic update immediately, debounce API call
      // Capture previous sets for rollback
      const previousSets = [...currentSets];

      // Update local state immediately
      if (draftUnitType === 'days') {
        setDraftDays((prev) =>
          prev.map((d) =>
            d.id === currentDay.id
              ? {
                  ...d,
                  exercises: d.exercises.map((e) => {
                    if (e.id === exerciseId) {
                      const exerciseUpdates: any = { target_sets: updatedSets.length };
                      if (setNumber === 1) {
                        if (field === 'reps') exerciseUpdates.target_reps = updatedSet.target_reps;
                        if (field === 'weight') exerciseUpdates.target_weight = updatedSet.target_weight;
                        if (field === 'duration') exerciseUpdates.target_duration_seconds = updatedSet.target_duration_seconds;
                      }
                      return { ...e, set_targets: updatedSets, ...exerciseUpdates };
                    }
                    return e;
                  }),
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
                        exercises: d.exercises.map((e) => {
                          if (e.id === exerciseId) {
                            const exerciseUpdates: any = { target_sets: updatedSets.length };
                            if (setNumber === 1) {
                              if (field === 'reps') exerciseUpdates.target_reps = updatedSet.target_reps;
                              if (field === 'weight') exerciseUpdates.target_weight = updatedSet.target_weight;
                              if (field === 'duration') exerciseUpdates.target_duration_seconds = updatedSet.target_duration_seconds;
                            }
                            return { ...e, set_targets: updatedSets, ...exerciseUpdates };
                          }
                          return e;
                        }),
                      }
                    : d
                ),
              };
            }
            return week;
          })
        );
      }

      // Debounce the API call
      const timeoutId = autoSaveTimeoutsRef.current.get(exerciseId);
      if (timeoutId) clearTimeout(timeoutId);

      const newTimeoutId = setTimeout(async () => {
        try {
          const exerciseUpdates: any = { target_sets: updatedSets.length };
          if (setNumber === 1) {
            if (field === 'reps') exerciseUpdates.target_reps = updatedSet.target_reps;
            if (field === 'weight') exerciseUpdates.target_weight = updatedSet.target_weight;
            if (field === 'duration') exerciseUpdates.target_duration_seconds = updatedSet.target_duration_seconds;
          }
          await Promise.all([
            replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
            updateExerciseInDay(planId, currentDay.id, exerciseId, exerciseUpdates),
          ]);
        } catch (err) {
          // On failure: revert to previous sets
          if (draftUnitType === 'days') {
            setDraftDays((prev) =>
              prev.map((d) =>
                d.id === currentDay.id
                  ? {
                      ...d,
                      exercises: d.exercises.map((e) =>
                        e.id === exerciseId ? { ...e, set_targets: previousSets, target_sets: previousSets.length } : e
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
                              e.id === exerciseId ? { ...e, set_targets: previousSets, target_sets: previousSets.length } : e
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
      // Edit mode - optimistic: add set immediately
      // Capture previous sets for rollback
      const previousSets = [...currentSets];

      // Update local state immediately
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

      // Fire API call in background
      Promise.all([
        replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
        updateExerciseInDay(planId, currentDay.id, exerciseId, { target_sets: updatedSets.length }),
      ]).catch((err) => {
        // On failure: revert to previous sets
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) =>
              d.id === currentDay.id
                ? {
                    ...d,
                    exercises: d.exercises.map((e) =>
                      e.id === exerciseId ? { ...e, set_targets: previousSets, target_sets: previousSets.length } : e
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
                            e.id === exerciseId ? { ...e, set_targets: previousSets, target_sets: previousSets.length } : e
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
        setError((err as Error).message);
      });
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
      // Edit mode - optimistic: remove set immediately
      // Capture previous sets for rollback
      const previousSets = [...currentSets];

      // Update local state immediately
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

      // Fire API call in background
      Promise.all([
        replaceSetTargets(planId, currentDay.id, exerciseId, updatedSets),
        updateExerciseInDay(planId, currentDay.id, exerciseId, { target_sets: updatedSets.length }),
      ]).catch((err) => {
        // On failure: revert to previous sets
        if (draftUnitType === 'days') {
          setDraftDays((prev) =>
            prev.map((d) =>
              d.id === currentDay.id
                ? {
                    ...d,
                    exercises: d.exercises.map((e) =>
                      e.id === exerciseId ? { ...e, set_targets: previousSets, target_sets: previousSets.length } : e
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
                            e.id === exerciseId ? { ...e, set_targets: previousSets, target_sets: previousSets.length } : e
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
        setError((err as Error).message);
      });
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
        showToast(t.planBuilder.weekCustomized, 'success');
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
        showToast(t.planBuilder.weekReverted, 'success');
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
          setError(err.response?.data?.error || t.planBuilder.cannotRevertWeek);
        } else {
          setError((err as Error).message);
        }
      }
    }
  }

  if (loading) return (
    <>
      <div className="loading">{t.planBuilder.loading}</div>
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
              {t.planBuilder.back}
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
                  color: 'var(--danger)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0 0 0 12px',
                }}
                aria-label={t.planBuilder.dismissError}
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
                  {t.planBuilder.save}
                </button>
                <button
                  onClick={() => {
                    setRenamePlanName(draftName);
                    setIsRenamingPlan(false);
                  }}
                  className="btn btn-secondary"
                >
                  {t.planBuilder.cancel}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>{draftName}</h2>
                {!props.isCreateMode && (
                  <button onClick={() => setIsRenamingPlan(true)} className="btn">
                    {t.planBuilder.rename}
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
          <label className="field-label">{t.planBuilder.weeksLabel}</label>
          <div className="week-selector-row">
            {draftWeeks.map((week, idx) => (
              <div key={week.week_number} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setActiveWeekIndex(idx)}
                  className={`week-node${idx === activeWeekIndex ? ' active' : week.mode === 'custom' ? ' completed' : ''}`}
                  aria-label={t.planBuilder.weekNodeAriaLabel(week.week_number, week.mode, idx === activeWeekIndex)}
                  title={t.planBuilder.weekNodeTitle(week.week_number, week.mode)}
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
                  {t.planBuilder.linkedWeekBanner(
                    draftWeeks[activeWeekIndex].week_number,
                    getEffectiveDaysForWeek(draftWeeks, activeWeekIndex).length > 0
                      ? draftWeeks.findIndex(w => w.days === getEffectiveDaysForWeek(draftWeeks, activeWeekIndex)) + 1
                      : 1
                  )}
                </p>
                <button onClick={handleCustomizeWeek} className="btn btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  {t.planBuilder.customizeThisWeek}
                </button>
              </>
            )}
            {draftWeeks[activeWeekIndex].mode === 'custom' && (
              <>
                <p>{t.planBuilder.customWeekBanner(draftWeeks[activeWeekIndex].week_number)}</p>
                <button onClick={handleMatchPreviousWeek} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  {t.planBuilder.matchPreviousWeek}
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
                onClick={() => {
                  setActiveDayIndex(idx);
                  setIsEditingDayCustomName(false);
                }}
                className={`day-tab${idx === activeDayIndex ? ' active' : ''}`}
              >
                {day.label}
              </button>
            ))}
          </div>

          {/* Day nickname (e.g. "Chest Day") -- shown alongside the "Day N"
              tab above, not replacing it. Available in create mode too: the
              value lives in draft state and is included in the create-plan
              payload on save. */}
          {currentDay && (
            <div style={{ marginBottom: '16px' }}>
              {isEditingDayCustomName ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={dayCustomNameInput}
                    onChange={(e) => setDayCustomNameInput(e.target.value)}
                    placeholder={t.planBuilder.dayNicknamePlaceholder}
                    className="input-field"
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button onClick={handleUpdateDayCustomName} className="btn btn-primary">
                    {t.planBuilder.save}
                  </button>
                  <button
                    onClick={() => setIsEditingDayCustomName(false)}
                    className="btn btn-secondary"
                  >
                    {t.planBuilder.cancel}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {currentDay.custom_name && (
                    <span style={{ fontSize: '14px', color: 'var(--text)', fontStyle: 'italic' }}>
                      {currentDay.custom_name}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setDayCustomNameInput(currentDay.custom_name || '');
                      setIsEditingDayCustomName(true);
                    }}
                    className="btn"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    {currentDay.custom_name ? t.planBuilder.editDayNickname : t.planBuilder.addDayNickname}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rest Toggle */}
          {currentDay && (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>{t.planBuilder.restDayLabel}</label>
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
                {currentDay.is_rest ? t.planBuilder.yes : t.planBuilder.no}
              </button>
              {isLinkedWeek && (
                <span style={{ fontSize: '12px', color: 'var(--text)', fontStyle: 'italic' }}>
                  {t.planBuilder.linkedDayNotice}
                </span>
              )}
            </div>
          )}

          {/* Exercise Grid */}
          {currentDay && !currentDay.is_rest && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <div className="exercise-section-label" style={{ marginBottom: 0 }}>{t.planBuilder.exercisesLabel}</div>

                  {currentDay.exercises.length > 0 && !isLinkedWeek && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {isSelectMode ? (
                        <>
                          <button
                            onClick={handleCopySelected}
                            disabled={selectedExerciseIds.size === 0}
                            className="btn btn-primary"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            {t.planBuilder.copyButton}
                          </button>
                          <button onClick={toggleSelectMode} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                            {t.planBuilder.cancel}
                          </button>
                        </>
                      ) : (
                        <button onClick={toggleSelectMode} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                          {t.planBuilder.selectExercises}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!isSelectMode && clipboardExercises.length > 0 && !isLinkedWeek && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      marginBottom: '12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-hover)',
                      fontSize: '13px',
                    }}
                  >
                    <span>{t.planBuilder.clipboardStatus(clipboardExercises.length)}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handlePasteClipboard}
                        disabled={pasting}
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        {pasting ? t.planBuilder.pasting : t.planBuilder.pasteHere(clipboardExercises.length)}
                      </button>
                      <button
                        onClick={handleClearClipboard}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                        aria-label={t.planBuilder.clearClipboard}
                        title={t.planBuilder.clearClipboard}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                {currentDay.exercises.map((ex, idx) => {
                  const sets = getSetsList(ex);
                  const isExpanded = expandedExerciseIds.has(ex.id);
                  const summaryText = [
                    t.planBuilder.setsCount(sets.length),
                    ex.has_reps && ex.target_reps ? t.planBuilder.repsCount(ex.target_reps) : null,
                    ex.has_weight && ex.target_weight ? t.planBuilder.lbsWeight(ex.target_weight) : null,
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
                          if (isSelectMode) {
                            toggleExerciseSelected(ex.id);
                            return;
                          }
                          handlePreviewExercise({
                            name: ex.exercise_name || t.planBuilder.exerciseFallback(ex.exercise_id),
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
                        {isSelectMode && (
                          <input
                            type="checkbox"
                            checked={selectedExerciseIds.has(ex.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleExerciseSelected(ex.id)}
                            aria-label={t.planBuilder.selectExerciseAriaLabel(ex.exercise_name || t.planBuilder.exerciseFallback(ex.exercise_id))}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                          />
                        )}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {getYoutubeThumbnailUrl(ex.video_url) ? (
                            <img
                              src={getYoutubeThumbnailUrl(ex.video_url)!}
                              alt={ex.exercise_name || t.planBuilder.exerciseFallback(ex.exercise_id)}
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
                            {ex.exercise_name || t.planBuilder.exerciseFallback(ex.exercise_id)}
                          </div>
                          {!isExpanded && (
                            <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '2px' }}>
                              {summaryText}
                            </div>
                          )}
                        </div>

                        {!isSelectMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySingle(ex);
                            }}
                            className="row-delete-btn"
                            disabled={isLinkedWeek}
                            title={t.planBuilder.copyButton}
                            aria-label={t.planBuilder.copyExerciseAriaLabel(ex.exercise_name || t.planBuilder.exerciseFallback(ex.exercise_id))}
                          >
                            <CopyIcon size={15} />
                          </button>
                        )}

                        {!isSelectMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ isOpen: true, type: 'exercise', dayId: currentDay.id, exerciseId: ex.id });
                            }}
                            className="row-delete-btn"
                            disabled={isLinkedWeek}
                            title={t.planBuilder.removeExercise}
                            aria-label={t.planBuilder.removeExercise}
                          >
                            <TrashIcon size={15} />
                          </button>
                        )}

                        {!isSelectMode && (
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
                            aria-label={isExpanded ? t.planBuilder.collapseExercise(ex.exercise_name || t.workoutPreview.exerciseFallback) : t.planBuilder.expandExercise(ex.exercise_name || t.workoutPreview.exerciseFallback)}
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
                        )}
                      </div>

                      {/* Expanded body */}
                      {isExpanded && !isSelectMode && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '12px' }}>
                          {/* Exercise-level field toggles */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                            {ex.has_reps ? (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_reps', false)}
                                disabled={isLinkedWeek}
                                title={t.planBuilder.removeRepsTracking}
                                style={toggleChipStyle}
                              >
                                {t.planBuilder.repsChipRemove}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_reps', true)}
                                className="field-restore-chip"
                                disabled={isLinkedWeek}
                              >
                                {t.planBuilder.repsChipAdd}
                              </button>
                            )}
                            {ex.has_weight ? (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_weight', false)}
                                disabled={isLinkedWeek}
                                title={t.planBuilder.removeWeightTracking}
                                style={toggleChipStyle}
                              >
                                {t.planBuilder.weightChipRemove}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_weight', true)}
                                className="field-restore-chip"
                                disabled={isLinkedWeek}
                              >
                                {t.planBuilder.weightChipAdd}
                              </button>
                            )}
                            {ex.has_duration ? (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_duration', false)}
                                disabled={isLinkedWeek}
                                title={t.planBuilder.removeDurationTracking}
                                style={toggleChipStyle}
                              >
                                {t.planBuilder.durationChipRemove}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateExercise(ex.id, 'has_duration', true)}
                                className="field-restore-chip"
                                disabled={isLinkedWeek}
                              >
                                {t.planBuilder.durationChipAdd}
                              </button>
                            )}
                            <span
                              title={t.planBuilder.durationTooltip}
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
                              placeholder={t.planBuilder.notesPlaceholder}
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
                                      {t.planBuilder.repsLabel}
                                    </span>
                                    <input
                                      type="text"
                                      value={set.target_reps || ''}
                                      onChange={(e) => handleUpdateSet(ex.id, set.set_number, 'reps', e.target.value)}
                                      placeholder={t.planBuilder.repsPlaceholder}
                                      className="input-field"
                                      disabled={isLinkedWeek}
                                      style={{ width: '130px', fontSize: '13px' }}
                                    />
                                  </div>
                                )}
                                {ex.has_weight && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
                                      {t.planBuilder.weightLabel}
                                    </span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={set.target_weight || ''}
                                      onChange={(e) => handleUpdateSet(ex.id, set.set_number, 'weight', e.target.value ? Number(e.target.value) : null)}
                                      placeholder={t.planBuilder.weightPlaceholder}
                                      className="input-field"
                                      disabled={isLinkedWeek}
                                      style={{ width: '90px', fontSize: '13px' }}
                                    />
                                  </div>
                                )}
                                {ex.has_duration && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
                                      {t.planBuilder.durationLabel}
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
                                    title={t.planBuilder.removeSet(set.set_number)}
                                    aria-label={t.planBuilder.removeSet(set.set_number)}
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
                            {t.planBuilder.addSet}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Exercise Hint */}
              <div style={{ marginBottom: '12px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-h)' }}>
                {isMobile ? t.planBuilder.mobileHint : t.planBuilder.desktopHint}
              </div>
            </>
          )}

          {currentDay?.is_rest && (
            <div style={{ padding: '16px', backgroundColor: 'var(--code-bg)', borderRadius: '4px', textAlign: 'center', marginBottom: '12px' }}>
              <p style={{ margin: 0, color: 'var(--text)', fontSize: '14px' }}>
                {t.planBuilder.restDayNotice}
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
          {t.planBuilder.addExercise}
        </button>
      )}

      {!props.isCreateMode && isQuickStart && (
        <button
          onClick={handleAddDay}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '12px', marginTop: '12px' }}
        >
          {t.planBuilder.addDay}
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
          {saving ? t.planBuilder.saving : t.planBuilder.savePlan}
        </button>
      ) : (
        <button
          onClick={() => navigate('/workout-plans')}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', marginTop: '20px' }}
        >
          {t.planBuilder.done}
        </button>
      )}

      {/* Exercise Picker Modal (mobile only) */}
      {isMobile && (
        <Modal
          isOpen={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          title={t.planBuilder.addExerciseModalTitle}
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
          title={selectedPreview?.name || t.planBuilder.exercisePreviewModalTitle}
          fullScreen={true}
          hideCloseButton={true}
        >
          <div style={{ padding: '12px 16px', paddingTop: '0' }}>
            <ExercisePreviewPanel selected={selectedPreview} fullWidth={true} />
            <button
              onClick={() => setShowPreviewModal(false)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
            >
              {t.exercisePreview.backButton}
            </button>
          </div>
        </Modal>
      )}

      {/* Back Confirm Dialog (create mode only) */}
      <ConfirmDialog
        isOpen={showBackConfirm}
        title={t.planBuilder.leavePlanCreation}
        message={t.planBuilder.leavePlanMessage}
        confirmText={t.planBuilder.goBack}
        cancelText={t.planBuilder.stay}
        isDangerous={true}
        onConfirm={() => navigate('/workout-plans')}
        onCancel={() => setShowBackConfirm(false)}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.type === 'exercise' ? t.planBuilder.removeExerciseTitle : t.planBuilder.deleteDayTitle}
        message={deleteConfirm.type === 'exercise' ? t.planBuilder.removeExerciseMessage : t.planBuilder.deleteDayMessage}
        confirmText={t.planBuilder.delete}
        cancelText={t.planBuilder.cancel}
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
        title={t.planBuilder.savePlanQuestion}
        message={t.planBuilder.savePlanMessage}
        confirmText={t.planBuilder.save}
        cancelText={t.planBuilder.keepEditing}
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
