from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.infrastructure.database import get_db
from src.infrastructure.security.oauth2 import get_current_user_id
from src.modules.exercise_library.application.use_cases.search_exercises import (
    SearchExercises,
)
from src.modules.exercise_library.application.use_cases.get_muscle_groups import (
    GetMuscleGroups,
)
from src.modules.exercise_library.infrastructure.repositories.exercise_library_repository_impl import (
    ExerciseLibraryRepositoryImpl,
)
from .schemas import LibraryExerciseResponse, MuscleGroupsResponse

exercise_library_router = APIRouter(
    prefix="/api/exercise-library", tags=["exercise-library"]
)


def derive_youtube_thumbnail(video_url: str | None) -> str | None:
    """Derive YouTube thumbnail URL from video_url. Returns None if url is None or unparseable."""
    if not video_url:
        return None

    video_id = None

    if "youtube.com/watch" in video_url:
        try:
            idx = video_url.find("v=")
            if idx != -1:
                video_id = video_url[idx + 2 : idx + 13]
        except Exception:
            pass
    elif "youtu.be/" in video_url:
        try:
            idx = video_url.find("youtu.be/")
            if idx != -1:
                video_id = video_url[idx + 9 : idx + 20]
        except Exception:
            pass

    if video_id:
        return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    return None


@exercise_library_router.get("", response_model=list[LibraryExerciseResponse])
async def search_library(
    q: str | None = Query(None),
    muscle_group: str | None = Query(None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Search the exercise library with optional query and muscle_group filter. Requires auth."""
    repository = ExerciseLibraryRepositoryImpl(db)
    use_case = SearchExercises(repository)
    results = use_case.execute(q=q, muscle_group=muscle_group)

    return [
        LibraryExerciseResponse(
            id=item.id,
            name=item.name,
            muscle_group=item.muscle_group,
            equipment=item.equipment,
            thumbnail_url=item.image_url or derive_youtube_thumbnail(item.video_url),
        )
        for item in results
    ]


@exercise_library_router.get("/muscle-groups", response_model=MuscleGroupsResponse)
async def get_muscle_groups(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get distinct muscle groups in the library. Requires auth."""
    repository = ExerciseLibraryRepositoryImpl(db)
    use_case = GetMuscleGroups(repository)
    groups = use_case.execute()
    return MuscleGroupsResponse(muscle_groups=groups)
