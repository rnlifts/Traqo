from fastapi import FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config.settings import settings

from src.modules.auth.domain.exceptions import InvalidCredentialsError
from src.modules.exercises.domain.exceptions import (
    DuplicateExerciseNameError,
    ExerciseInUseError,
    ExerciseNotFoundError,
    UnauthorizedExerciseAccessError,
)
from src.modules.sessions.domain.exceptions import (
    SessionAlreadyFinishedError,
    UnauthorizedWorkoutSessionAccessError,
    WorkoutSessionNotFoundError,
)
from src.modules.workouts.domain.exceptions import (
    DuplicateWeekdayInPlanError,
    ExerciseNotOwnedError,
    PlanDayHasSessionsError,
    PlanDayNotFoundError,
    UnauthorizedPlanDayAccessError,
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanHasSessionsError,
    WorkoutPlanNotFoundError,
    WeekHasSessionsError,
    InvalidWeekModeError,
    TotalUnitsMismatchError,
    LinkedWeekWithDaysError,
    InvalidPlanStructureError,
)

app = FastAPI(title="Traqo API", version="1.0.0")

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from src.infrastructure.rate_limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers for domain exceptions
@app.exception_handler(WorkoutPlanNotFoundError)
async def workout_plan_not_found_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "Plan not found"},
    )


@app.exception_handler(UnauthorizedWorkoutPlanAccessError)
async def unauthorized_workout_plan_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": "You do not own this plan"},
    )


@app.exception_handler(WorkoutPlanHasSessionsError)
async def workout_plan_has_sessions_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": "Cannot delete a plan with recorded workout history"},
    )


@app.exception_handler(ExerciseNotFoundError)
async def exercise_not_found_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "Exercise not found"},
    )


@app.exception_handler(UnauthorizedExerciseAccessError)
async def unauthorized_exercise_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": "You do not own this exercise"},
    )


@app.exception_handler(ExerciseInUseError)
async def exercise_in_use_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": "This exercise is used in one or more workout plans — remove it from those plans first."},
    )


@app.exception_handler(DuplicateExerciseNameError)
async def duplicate_exercise_name_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": str(exc)},
    )


@app.exception_handler(ExerciseNotOwnedError)
async def exercise_not_owned_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": str(exc)},
    )


@app.exception_handler(WorkoutSessionNotFoundError)
async def workout_session_not_found_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "Session not found"},
    )


@app.exception_handler(UnauthorizedWorkoutSessionAccessError)
async def unauthorized_workout_session_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": "You do not own this session"},
    )


@app.exception_handler(SessionAlreadyFinishedError)
async def session_already_finished_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": "This session has already been finished"},
    )


@app.exception_handler(PlanDayNotFoundError)
async def plan_day_not_found_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "Day not found"},
    )


@app.exception_handler(UnauthorizedPlanDayAccessError)
async def unauthorized_plan_day_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"error": "You do not own this day"},
    )


@app.exception_handler(DuplicateWeekdayInPlanError)
async def duplicate_weekday_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": str(exc)},
    )


@app.exception_handler(PlanDayHasSessionsError)
async def plan_day_has_sessions_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": "This day has workout history and can't be deleted"},
    )


@app.exception_handler(WeekHasSessionsError)
async def week_has_sessions_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"error": str(exc)},
    )


@app.exception_handler(InvalidWeekModeError)
async def invalid_week_mode_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": str(exc)},
    )


@app.exception_handler(TotalUnitsMismatchError)
async def total_units_mismatch_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": str(exc)},
    )


@app.exception_handler(LinkedWeekWithDaysError)
async def linked_week_with_days_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": str(exc)},
    )


@app.exception_handler(InvalidPlanStructureError)
async def invalid_plan_structure_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": str(exc)},
    )


@app.exception_handler(InvalidCredentialsError)
async def invalid_credentials_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"error": "Invalid username or password"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": f"Validation error: {exc.errors()[0]['msg']}"},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"},
    )


# Health check endpoint
@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Register routers (imported after exception handlers to ensure they're set up first)
from src.modules.auth.presentation.routes import auth_router
from src.modules.exercises.presentation.routes import exercises_router
from src.modules.sessions.presentation.routes import (
    sessions_router,
    get_workout_history_handler,
    get_exercise_progress_handler,
)
from src.modules.sessions.presentation.schemas import (
    WorkoutHistoryEntryResponse,
    ExerciseProgressResponse,
)
from src.modules.workouts.presentation.routes import workouts_router

app.include_router(auth_router)
app.include_router(exercises_router)
app.include_router(workouts_router)
app.include_router(sessions_router)

# Register workout history endpoint directly to get correct path
app.add_api_route(
    "/api/workout-history",
    get_workout_history_handler,
    methods=["GET"],
    response_model=list[WorkoutHistoryEntryResponse],
)

# Register exercise progress endpoint directly
app.add_api_route(
    "/api/exercises/{exercise_id}/progress",
    get_exercise_progress_handler,
    methods=["GET"],
    response_model=ExerciseProgressResponse,
)
