from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.security.oauth2 import get_current_user_id
from ..application.use_cases.create_exercise import CreateExercise
from ..application.use_cases.delete_exercise import DeleteExercise
from ..application.use_cases.list_exercises import ListExercises
from ..infrastructure.repositories.exercise_repository_impl import ExerciseRepositoryImpl
from .schemas import CreateExerciseRequest, ExerciseResponse

exercises_router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@exercises_router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    req: CreateExerciseRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new exercise for the authenticated user."""
    exercise_repository = ExerciseRepositoryImpl(db)
    use_case = CreateExercise(exercise_repository)
    exercise = use_case.execute(user_id, req.name, category=req.category, logging_type=req.logging_type)
    return ExerciseResponse(id=exercise.id, name=exercise.name, category=exercise.category, logging_type=exercise.logging_type)


@exercises_router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all exercises for the authenticated user."""
    exercise_repository = ExerciseRepositoryImpl(db)
    use_case = ListExercises(exercise_repository)
    exercises = use_case.execute(user_id)
    return [ExerciseResponse(id=e.id, name=e.name, category=e.category, logging_type=e.logging_type) for e in exercises]


@exercises_router.delete("/{exercise_id}", status_code=status.HTTP_200_OK)
async def delete_exercise(
    exercise_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete an exercise (only the owner can delete it)."""
    exercise_repository = ExerciseRepositoryImpl(db)
    use_case = DeleteExercise(exercise_repository)
    use_case.execute(exercise_id, user_id)
    return {"message": "Exercise deleted"}
