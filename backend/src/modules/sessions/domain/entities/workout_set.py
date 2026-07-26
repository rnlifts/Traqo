class WorkoutSet:
    """Domain entity representing a single exercise set logged during a workout session."""

    def __init__(
        self,
        workout_session_id: int,
        exercise_id: int,
        set_number: int,
        weight: float | None = None,
        reps: int | None = None,
        duration_seconds: int | None = None,
        notes: str = "",
        id: int | None = None,
        workout_exercise_id: int | None = None,
    ):
        self.id = id
        self.workout_session_id = workout_session_id
        self.exercise_id = exercise_id
        self.workout_exercise_id = workout_exercise_id
        self.set_number = set_number
        self.weight = weight
        self.reps = reps
        self.duration_seconds = duration_seconds
        self.notes = notes
