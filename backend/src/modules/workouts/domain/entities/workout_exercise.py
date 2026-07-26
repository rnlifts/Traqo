class WorkoutExercise:
    """An exercise linked to a plan day at a specific order position."""

    def __init__(
        self,
        plan_day_id: int,
        exercise_id: int,
        order_number: int,
        id: int | None = None,
        target_sets: int | None = None,
        target_reps: str | None = None,
        target_weight: float | None = None,
        notes: str = "",
        has_reps: bool = True,
        has_weight: bool = True,
        has_duration: bool = False,
        target_duration_seconds: int | None = None,
    ):
        self.id = id
        self.plan_day_id = plan_day_id
        self.exercise_id = exercise_id
        self.order_number = order_number
        self.target_sets = target_sets
        self.target_reps = target_reps
        self.target_weight = target_weight
        self.notes = notes
        self.has_reps = has_reps
        self.has_weight = has_weight
        self.has_duration = has_duration
        self.target_duration_seconds = target_duration_seconds
