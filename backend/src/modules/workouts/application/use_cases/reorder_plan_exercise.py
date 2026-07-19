from ...domain.entities.workout_exercise import WorkoutExercise
from ...domain.interfaces.workout_exercise_repository import WorkoutExerciseRepository


class ReorderPlanExercise:
    """Use case: move an exercise up or down one position in a plan."""

    def __init__(self, exercise_repository: WorkoutExerciseRepository):
        self.exercise_repository = exercise_repository

    def execute(self, workout_exercise_id: int, direction: str) -> WorkoutExercise:
        """Move an exercise up or down, swapping with the adjacent exercise.

        Args:
            workout_exercise_id: the exercise to move
            direction: "up" or "down"

        Returns:
            The updated workout_exercise (after swap)
        """
        exercise = self.exercise_repository.get_by_id(workout_exercise_id)
        if not exercise:
            raise ValueError(f"Workout exercise {workout_exercise_id} not found")

        if direction == "up":
            target_order = exercise.order_number - 1
            if target_order < 1:
                raise ValueError("Cannot move exercise up: already at top")
        elif direction == "down":
            target_order = exercise.order_number + 1
        else:
            raise ValueError(f"Invalid direction: {direction}")

        # Find the exercise currently at the target position
        exercises_in_plan = self.exercise_repository.list_by_plan(exercise.workout_plan_id)
        neighbor = None
        for e in exercises_in_plan:
            if e.order_number == target_order:
                neighbor = e
                break

        if not neighbor:
            raise ValueError(f"No exercise at position {target_order} in this plan")

        # Swap order_number values using a temporary sentinel (-999) to avoid UNIQUE constraint violation
        # Step 1: Move the neighbor to the sentinel
        self.exercise_repository.update_order(neighbor.id, -999)
        # Step 2: Move the exercise to the neighbor's original position
        self.exercise_repository.update_order(workout_exercise_id, target_order)
        # Step 3: Move the neighbor to the exercise's original position
        self.exercise_repository.update_order(neighbor.id, exercise.order_number)

        # Return the updated exercise
        return self.exercise_repository.get_by_id(workout_exercise_id)
