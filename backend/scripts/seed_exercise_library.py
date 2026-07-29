#!/usr/bin/env python
"""
Seed the exercise library from JSON files in exercise library/ folder.
Run from any directory - resolves paths relative to the repo root.
Re-runnable and idempotent (upserts by name, muscle_group).
"""

import json
import sys
from pathlib import Path

# Windows consoles default to cp1252, which can't encode the checkmark/warning
# glyphs used below — reconfigure stdout to UTF-8 so this runs the same on
# Windows as everywhere else, instead of crashing right before the summary
# (and warnings!) get printed.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Resolve repo root (backend/scripts/seed_exercise_library.py -> backend -> repo root)
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
REPO_ROOT = BACKEND_DIR.parent

sys.path.insert(0, str(BACKEND_DIR))

from src.infrastructure.database import SessionLocal
from src.modules.exercise_library.domain.entities.exercise_library_item import (
    ExerciseLibraryItem,
)
from src.modules.exercise_library.infrastructure.repositories.exercise_library_repository_impl import (
    ExerciseLibraryRepositoryImpl,
)


def seed_library():
    """Load and seed the exercise library from JSON files."""
    library_dir = REPO_ROOT / "exercise library"

    if not library_dir.exists():
        print(f"❌ Library directory not found: {library_dir}")
        return

    db = SessionLocal()
    repo = ExerciseLibraryRepositoryImpl(db)

    summary = {}
    warnings = []

    # Get all .json files
    json_files = sorted(library_dir.glob("*.json"))

    if not json_files:
        print(f"⚠️  No JSON files found in {library_dir}")
        return

    for json_file in json_files:
        muscle_group_name = json_file.stem  # filename without .json

        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            warnings.append(f"⚠️  Failed to parse {json_file.name}: {e}")
            summary[muscle_group_name] = 0
            continue

        # Handle empty files
        if not data or len(data) == 0:
            summary[muscle_group_name] = 0
            continue

        loaded_count = 0

        for item_data in data:
            name = item_data.get("name", "").strip()
            muscle_group = item_data.get("muscle_group", "").strip()
            equipment = item_data.get("equipment")
            video_url = item_data.get("video_url")
            image_url = item_data.get("image_url")

            if not name or not muscle_group:
                warnings.append(
                    f"⚠️  Skipping entry in {json_file.name} with missing name or muscle_group"
                )
                continue

            # Validation: check filename matches muscle_group
            if muscle_group != muscle_group_name:
                warnings.append(
                    f"⚠️  File {json_file.name} contains entry with muscle_group '{muscle_group}' (expected '{muscle_group_name}')"
                )

            # Upsert
            item = ExerciseLibraryItem(
                name=name,
                muscle_group=muscle_group,
                equipment=equipment,
                video_url=video_url,
                image_url=image_url,
            )
            repo.upsert(item)
            loaded_count += 1

        summary[muscle_group_name] = loaded_count

    db.close()

    # Print summary
    print("\n✅ Exercise library seeding complete:")
    for muscle_group, count in summary.items():
        print(f"  {muscle_group}: {count} entries")

    if warnings:
        print("\n⚠️  Warnings:")
        for warning in warnings:
            print(f"  {warning}")
    else:
        print("\n✅ No warnings")


if __name__ == "__main__":
    seed_library()
