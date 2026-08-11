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
from src.modules.exercise_library.application.use_cases.get_equipment_options import (
    GetEquipmentOptions,
)
from src.modules.exercise_library.infrastructure.repositories.exercise_library_repository_impl import (
    ExerciseLibraryRepositoryImpl,
)
from src.modules.exercise_library.domain.services.youtube_thumbnail import (
    derive_youtube_thumbnail,
)
from .schemas import LibraryExerciseResponse, MuscleGroupsResponse, EquipmentOptionsResponse

exercise_library_router = APIRouter(
    prefix="/api/exercise-library", tags=["exercise-library"]
)


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
            video_url=item.video_url,
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


@exercise_library_router.get("/equipment", response_model=EquipmentOptionsResponse)
async def get_equipment(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get distinct equipment options in the library. Requires auth."""
    repository = ExerciseLibraryRepositoryImpl(db)
    use_case = GetEquipmentOptions(repository)
    equipment = use_case.execute()
    return EquipmentOptionsResponse(equipment_options=equipment)
