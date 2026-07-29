from src.modules.exercise_library.domain.entities.exercise_library_item import (
    ExerciseLibraryItem,
)
from src.modules.exercise_library.domain.interfaces.exercise_library_repository import (
    ExerciseLibraryRepository,
)


def score_exercise_match(query_words: list[str], item_name: str) -> int:
    """
    Score how many query words appear in (or contain) one of the item's name words.

    Uses substring containment rather than exact word equality, so a query word
    like "pull" or "down" still matches a compound name word like "Pulldown"
    (real seeded data uses "Pulldown" as one word, not "Pull Down" as two) —
    exact-match-only would score zero against real data for exactly this case.
    Pure function for testability.
    """
    name_words = item_name.lower().split()
    score = 0
    for query_word in query_words:
        for name_word in name_words:
            # Substring matching on very short words (e.g. "t", "a") produces
            # noisy false positives — almost any word "contains" a single
            # letter. Require an exact match for short words, and only allow
            # substring containment once both sides are long enough to be
            # meaningful (e.g. "pull" inside "pulldown").
            if len(query_word) < 3 or len(name_word) < 3:
                if query_word == name_word:
                    score += 1
                    break
            elif query_word in name_word or name_word in query_word:
                score += 1
                break
    return score


class SearchExercises:
    """Search the exercise library with token-overlap fuzzy matching."""

    def __init__(self, repository: ExerciseLibraryRepository):
        self.repository = repository

    def execute(
        self, q: str | None = None, muscle_group: str | None = None
    ) -> list[ExerciseLibraryItem]:
        """
        Search library entries by fuzzy word match.

        If q is provided, split into words and rank by word overlap.
        Exclude entries with zero matching words.
        If q is absent, return all (optionally filtered by muscle_group), ordered by name.
        """
        all_items = self.repository.search(muscle_group=muscle_group)

        if not q or not q.strip():
            return all_items

        query_words = q.lower().split()
        scored = [
            (item, score_exercise_match(query_words, item.name))
            for item in all_items
        ]
        filtered = [(item, score) for item, score in scored if score > 0]
        sorted_results = sorted(filtered, key=lambda x: x[1], reverse=True)

        return [item for item, _ in sorted_results]
