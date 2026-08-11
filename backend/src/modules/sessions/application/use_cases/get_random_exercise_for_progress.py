"""Use case: pick a random previously-logged exercise for the Dashboard's progress preview."""

import random
from dataclasses import dataclass

from ...domain.interfaces.workout_set_repository import WorkoutSetRepository
from src.modules.exercises.domain.interfaces.exercise_repository import ExerciseRepository


@dataclass
class RandomExercisePick:
    """A randomly-chosen exercise the user has logged before."""

    exercise_id: int
    exercise_name: str


class GetRandomExerciseForProgress:
    """Use case: pick one exercise at random from the user's logged history.

    A different exercise may come back on every call by design — the Dashboard's
    progress preview is meant to surface variety across visits, not always show the
    same lift.
    """

    def __init__(
        self,
        set_repository: WorkoutSetRepository,
        exercise_repository: ExerciseRepository,
    ):
        self.set_repository = set_repository
        self.exercise_repository = exercise_repository

    def execute(self, user_id: int) -> RandomExercisePick | None:
        """Pick a random logged exercise for the user.

        Returns:
            A random exercise the user has finished sets for, or None if they've
            never logged anything yet — a normal state, not an error.
        """
        exercise_ids = self.set_repository.list_distinct_exercise_ids_by_user(user_id)
        if not exercise_ids:
            return None

        # Skip any exercise that's since been deleted rather than erroring out —
        # try a few times before giving up so one stale id doesn't blank the card.
        candidates = exercise_ids[:]
        random.shuffle(candidates)
        for exercise_id in candidates:
            exercise = self.exercise_repository.get_by_id(exercise_id)
            if exercise is not None:
                return RandomExercisePick(exercise_id=exercise.id, exercise_name=exercise.name)

        return None
