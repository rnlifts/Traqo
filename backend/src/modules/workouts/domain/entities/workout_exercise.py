class WorkoutExercise:
    """An exercise linked to a plan day at a specific order position."""

    def __init__(
        self,
        plan_day_id: int,
        exercise_id: int,
        order_number: int,
        id: int | None = None,
        target_sets: int | None = None,
        target_reps: int | None = None,
        target_weight: float | None = None,
        notes: str = "",
    ):
        self.id = id
        self.plan_day_id = plan_day_id
        self.exercise_id = exercise_id
        self.order_number = order_number
        self.target_sets = target_sets
        self.target_reps = target_reps
        self.target_weight = target_weight
        self.notes = notes
