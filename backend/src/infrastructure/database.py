from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from src.config.settings import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Import all models to register them with Base.metadata
# This must happen after Base is created but before any engine operations
from src.modules.auth.infrastructure.models.user_model import UserModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel
from src.modules.workouts.infrastructure.models.plan_week_model import PlanWeekModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from src.modules.sessions.infrastructure.models.workout_session_model import WorkoutSessionModel
from src.modules.sessions.infrastructure.models.workout_set_model import WorkoutSetModel


def get_db() -> Session:
    """Dependency injection for database sessions.

    Each request gets its own session, closed after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
