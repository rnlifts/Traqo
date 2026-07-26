class WorkoutExerciseSetTarget:
    """Per-set target overrides for a workout exercise (target reps/weight for specific set numbers)."""

    def __init__(
        self,
        workout_exercise_id: int,
        set_number: int,
        id: int | None = None,
        target_reps: str | None = None,
        target_weight: float | None = None,
        target_duration_seconds: int | None = None,
    ):
        self.id = id
        self.workout_exercise_id = workout_exercise_id
        self.set_number = set_number
        self.target_reps = target_reps
        self.target_weight = target_weight
        self.target_duration_seconds = target_duration_seconds
