class WorkoutSet:
    """Domain entity representing a single exercise set logged during a workout session."""

    def __init__(
        self,
        workout_session_id: int,
        exercise_id: int,
        set_number: int,
        weight: float,
        reps: int,
        notes: str = "",
        id: int | None = None,
    ):
        self.id = id
        self.workout_session_id = workout_session_id
        self.exercise_id = exercise_id
        self.set_number = set_number
        self.weight = weight
        self.reps = reps
        self.notes = notes
