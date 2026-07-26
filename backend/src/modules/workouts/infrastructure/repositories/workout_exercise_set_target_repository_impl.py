from sqlalchemy.orm import Session

from src.modules.workouts.domain.entities.workout_exercise_set_target import WorkoutExerciseSetTarget
from src.modules.workouts.domain.interfaces.workout_exercise_set_target_repository import (
    WorkoutExerciseSetTargetRepository,
)
from src.modules.workouts.infrastructure.models.workout_exercise_set_target_model import (
    WorkoutExerciseSetTargetModel,
)


class WorkoutExerciseSetTargetRepositoryImpl(WorkoutExerciseSetTargetRepository):
    def __init__(self, session: Session):
        """Initialize repository with a database session."""
        self.session = session

    def add(self, set_target: WorkoutExerciseSetTarget) -> WorkoutExerciseSetTarget:
        model = WorkoutExerciseSetTargetModel(
            workout_exercise_id=set_target.workout_exercise_id,
            set_number=set_target.set_number,
            target_reps=set_target.target_reps,
            target_weight=set_target.target_weight,
            target_duration_seconds=set_target.target_duration_seconds,
        )
        self.session.add(model)
        self.session.commit()
        return model.to_domain()

    def get_by_id(self, set_target_id: int) -> WorkoutExerciseSetTarget | None:
        """Retrieve a set_target by id. Returns None if not found."""
        model = self.session.query(WorkoutExerciseSetTargetModel).filter_by(id=set_target_id).first()
        return model.to_domain() if model else None

    def get_by_workout_exercise_and_set_number(
        self, workout_exercise_id: int, set_number: int
    ) -> WorkoutExerciseSetTarget | None:
        """Retrieve a set_target by workout_exercise_id and set_number. Returns None if not found."""
        model = (
            self.session.query(WorkoutExerciseSetTargetModel)
            .filter_by(workout_exercise_id=workout_exercise_id, set_number=set_number)
            .first()
        )
        return model.to_domain() if model else None

    def list_by_workout_exercise(self, workout_exercise_id: int) -> list[WorkoutExerciseSetTarget]:
        """Get all per-set targets for a workout_exercise, ordered by set_number. Returns empty list if none exist."""
        models = (
            self.session.query(WorkoutExerciseSetTargetModel)
            .filter_by(workout_exercise_id=workout_exercise_id)
            .order_by(WorkoutExerciseSetTargetModel.set_number)
            .all()
        )
        return [m.to_domain() for m in models]

    def delete(self, set_target_id: int) -> None:
        """Delete a set_target by id."""
        self.session.query(WorkoutExerciseSetTargetModel).filter_by(id=set_target_id).delete()
        self.session.commit()

    def delete_by_workout_exercise(self, workout_exercise_id: int) -> None:
        """Delete all set_targets for a workout_exercise."""
        self.session.query(WorkoutExerciseSetTargetModel).filter_by(workout_exercise_id=workout_exercise_id).delete()
        self.session.commit()

    def update(self, set_target: WorkoutExerciseSetTarget) -> WorkoutExerciseSetTarget:
        """Update an existing set_target. Returns the updated entity."""
        model = self.session.query(WorkoutExerciseSetTargetModel).filter_by(id=set_target.id).first()
        if model:
            model.target_reps = set_target.target_reps
            model.target_weight = set_target.target_weight
            model.target_duration_seconds = set_target.target_duration_seconds
            self.session.commit()
            return model.to_domain()
        raise ValueError(f"WorkoutExerciseSetTarget with id {set_target.id} not found")

    def replace_all_for_exercise(self, workout_exercise_id: int, set_targets: list[WorkoutExerciseSetTarget]) -> list[WorkoutExerciseSetTarget]:
        """Atomically replace all set targets for a workout_exercise.

        Deletes all existing targets for the exercise, then inserts the new list.
        This operation is atomic — either all changes succeed or none do.

        Args:
            workout_exercise_id: The exercise to replace targets for.
            set_targets: List of new targets (can be empty to clear all).

        Returns:
            List of the newly created targets.
        """
        try:
            # Delete all existing targets for this exercise
            self.session.query(WorkoutExerciseSetTargetModel).filter_by(
                workout_exercise_id=workout_exercise_id
            ).delete()

            # Insert all new targets
            new_models = []
            for st in set_targets:
                model = WorkoutExerciseSetTargetModel(
                    workout_exercise_id=st.workout_exercise_id,
                    set_number=st.set_number,
                    target_reps=st.target_reps,
                    target_weight=st.target_weight,
                    target_duration_seconds=st.target_duration_seconds,
                )
                self.session.add(model)
                new_models.append(model)

            self.session.commit()
            return [m.to_domain() for m in new_models]
        except Exception:
            self.session.rollback()
            raise
