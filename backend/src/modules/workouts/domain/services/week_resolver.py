"""Pure function for resolving a week's effective content through the link chain.

This is the server-side implementation of the algorithm from spec §1.4/§4.4:
Walk backward from week_number to the nearest preceding non-linked (base or custom) week.

The function is framework-free and operates only on already-fetched domain objects,
making it trivially testable and reusable across multiple use cases.
"""

from ..entities.plan_day import PlanDay
from ..entities.plan_week import PlanWeek


def resolve_effective_week(week_number: int, weeks: list[PlanWeek], days_by_week: dict[int, list[PlanDay]]) -> dict:
    """
    Resolve a week's effective (non-linked) content by walking backward through the link chain.

    This is the exact algorithm from spec §1.4:
    ```
    function getEffectiveDays(weekIdx){
      let j = weekIdx;
      while(draft.weeks[j].mode === 'linked') j--;
      return draft.weeks[j].days;
    }
    ```
    In 1-indexed terms, operating on persisted domain objects.

    Args:
        week_number: The week to resolve (1-indexed). Must be >= 1.
        weeks: All weeks for the plan, sorted by week_number.
        days_by_week: Map of PlanWeek.id -> list[PlanDay] for that week.
                      For linked weeks, the list should be empty; for base/custom weeks,
                      it contains their actual PlanDay rows.

    Returns:
        dict with keys:
            - 'resolved_week_number': int (the week whose content is effective)
            - 'mode': str (the mode of the originally-requested week: 'base'|'linked'|'custom')
            - 'days': list[PlanDay] (the effective days from the target week)

    Raises:
        ValueError: If week_number is not found or if no base week exists (invalid state).
    """
    if week_number < 1:
        raise ValueError(f"week_number must be >= 1, got {week_number}")

    # Find the requested week
    current_week = None
    for w in weeks:
        if w.week_number == week_number:
            current_week = w
            break

    if not current_week:
        raise ValueError(f"Week {week_number} not found in the provided weeks list")

    # Walk backward to find the nearest non-linked week
    j = week_number
    target_week = None
    while j >= 1:
        w = None
        for week in weeks:
            if week.week_number == j:
                w = week
                break

        if not w:
            j -= 1
            continue

        if w.mode != "linked":
            # Found a non-linked week
            target_week = w
            break

        j -= 1

    if not target_week:
        raise ValueError(f"No base or custom week found while resolving week {week_number}")

    # Get the days for the target week
    effective_days = days_by_week.get(target_week.id, [])

    return {
        "resolved_week_number": target_week.week_number,
        "mode": current_week.mode,
        "days": effective_days,
    }
