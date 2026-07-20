from dataclasses import dataclass
from datetime import datetime

from ...domain.entities.workout_set import WorkoutSet
from ...domain.interfaces.workout_session_repository import WorkoutSessionRepository
from ...domain.interfaces.workout_set_repository import WorkoutSetRepository
from src.modules.exercises.domain.exceptions import (
    ExerciseNotFoundError,
    UnauthorizedExerciseAccessError,
)
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository


@dataclass
class ProgressSet:
    """A single set in an exercise progress view."""

    set_number: int
    weight: float
    reps: int
    notes: str
    estimated_1rm: float
    is_weight_pr: bool
    is_reps_pr: bool
    is_e1rm_pr: bool


@dataclass
class ProgressSessionEntry:
    """A single session's worth of sets for an exercise in progress view."""

    session_id: int
    date: datetime
    sets: list[ProgressSet]
    volume: float  # Σ weight × reps across this session's sets of this exercise
    is_volume_pr: bool


@dataclass
class PersonalRecords:
    """Personal records for an exercise."""

    heaviest_weight: float | None
    heaviest_weight_date: datetime | None
    best_estimated_1rm: float | None
    best_estimated_1rm_date: datetime | None
    best_volume: float | None
    best_volume_date: datetime | None
    most_reps: int | None
    most_reps_date: datetime | None


@dataclass
class ExerciseProgressResult:
    """Complete progress data for an exercise."""

    exercise_id: int
    exercise_name: str
    sessions: list[ProgressSessionEntry]  # chronological ascending (oldest first)
    personal_records: PersonalRecords


class GetExerciseProgress:
    """Use case: retrieve per-exercise progress including history, volume, 1RM, and PRs."""

    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
        exercise_repository: ExerciseRepository,
    ):
        self.session_repository = session_repository
        self.set_repository = set_repository
        self.exercise_repository = exercise_repository

    def execute(self, user_id: int, exercise_id: int) -> ExerciseProgressResult:
        """Get complete progress data for an exercise.

        Args:
            user_id: The user requesting the progress.
            exercise_id: The exercise to retrieve progress for.

        Returns:
            ExerciseProgressResult with chronological sessions, computed PRs, and summary stats.

        Raises:
            ExerciseNotFoundError: If the exercise doesn't exist.
            UnauthorizedExerciseAccessError: If user doesn't own the exercise.
        """
        # 1. Ownership check
        exercise = self.exercise_repository.get_by_id(exercise_id)
        if not exercise:
            raise ExerciseNotFoundError(f"Exercise {exercise_id} not found")
        if exercise.user_id != user_id:
            raise UnauthorizedExerciseAccessError(
                f"User {user_id} does not own exercise {exercise_id}"
            )

        # 2. Get all finished sets for this exercise by this user
        sets = self.set_repository.list_finished_by_user_and_exercise(user_id, exercise_id)

        # 3. Group sets by session (preserving chronological order)
        sessions_map: dict[int, list[WorkoutSet]] = {}
        for s in sets:
            sessions_map.setdefault(s.workout_session_id, []).append(s)

        # 4. Build progress entries with PR computation
        entries = []
        running_max_weight: float | None = None
        running_max_reps: int | None = None
        running_max_e1rm: float | None = None
        running_max_volume: float | None = None

        for session_id, session_sets in sessions_map.items():
            session = self.session_repository.get_by_id(session_id)
            if not session:  # Shouldn't happen but defensive
                continue

            progress_sets = []
            volume = sum(s.weight * s.reps for s in session_sets)

            for s in session_sets:
                # Epley formula: weight × (1 + reps / 30)
                e1rm = round(s.weight * (1 + s.reps / 30), 1)

                # PR flags: only if strictly beats existing running max
                # First-ever data point never flags as PR (running maxes start at None)
                is_weight_pr = running_max_weight is not None and s.weight > running_max_weight
                is_reps_pr = running_max_reps is not None and s.reps > running_max_reps
                is_e1rm_pr = running_max_e1rm is not None and e1rm > running_max_e1rm

                progress_sets.append(
                    ProgressSet(
                        set_number=s.set_number,
                        weight=s.weight,
                        reps=s.reps,
                        notes=s.notes,
                        estimated_1rm=e1rm,
                        is_weight_pr=is_weight_pr,
                        is_reps_pr=is_reps_pr,
                        is_e1rm_pr=is_e1rm_pr,
                    )
                )

                # Update running maxes (using max() with None is handled via 'or 0')
                running_max_weight = max(running_max_weight or 0, s.weight)
                running_max_reps = max(running_max_reps or 0, s.reps)
                running_max_e1rm = max(running_max_e1rm or 0, e1rm)

            # Volume PR (only if strictly beats running max)
            is_volume_pr = running_max_volume is not None and volume > running_max_volume
            running_max_volume = max(running_max_volume or 0, volume)

            entries.append(
                ProgressSessionEntry(
                    session_id=session_id,
                    date=session.started_at,
                    sets=progress_sets,
                    volume=volume,
                    is_volume_pr=is_volume_pr,
                )
            )

        # 5. Build personal records summary
        personal_records = self._build_personal_records(entries)

        return ExerciseProgressResult(
            exercise_id=exercise_id,
            exercise_name=exercise.name,
            sessions=entries,
            personal_records=personal_records,
        )

    def _build_personal_records(
        self, entries: list[ProgressSessionEntry]
    ) -> PersonalRecords:
        """Build personal records summary from chronological entries."""
        heaviest_weight: float | None = None
        heaviest_weight_date: datetime | None = None
        best_e1rm: float | None = None
        best_e1rm_date: datetime | None = None
        best_volume: float | None = None
        best_volume_date: datetime | None = None
        most_reps: int | None = None
        most_reps_date: datetime | None = None

        for entry in entries:
            # Check volume
            if best_volume is None or entry.volume > best_volume:
                best_volume = entry.volume
                best_volume_date = entry.date

            # Check each set in the entry
            for s in entry.sets:
                if heaviest_weight is None or s.weight > heaviest_weight:
                    heaviest_weight = s.weight
                    heaviest_weight_date = entry.date

                if most_reps is None or s.reps > most_reps:
                    most_reps = s.reps
                    most_reps_date = entry.date

                if best_e1rm is None or s.estimated_1rm > best_e1rm:
                    best_e1rm = s.estimated_1rm
                    best_e1rm_date = entry.date

        return PersonalRecords(
            heaviest_weight=heaviest_weight,
            heaviest_weight_date=heaviest_weight_date,
            best_estimated_1rm=best_e1rm,
            best_estimated_1rm_date=best_e1rm_date,
            best_volume=best_volume,
            best_volume_date=best_volume_date,
            most_reps=most_reps,
            most_reps_date=most_reps_date,
        )
