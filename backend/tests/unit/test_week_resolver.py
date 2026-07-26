"""Unit tests for week_resolver.py — the week-chain resolution algorithm.

Tests the core algorithm from spec §1.4/§4.4: walk backward from a week
to the nearest preceding non-linked (base or custom) week.
"""

import pytest

from src.modules.workouts.domain.entities.plan_week import PlanWeek
from src.modules.workouts.domain.entities.plan_day import PlanDay
from src.modules.workouts.domain.services.week_resolver import resolve_effective_week


class TestResolveEffectiveWeek:
    """Test the resolve_effective_week algorithm."""

    def test_week_1_base_resolves_to_itself(self):
        """Week 1 as base resolves to itself."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        weeks = [week1]

        day_mon = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        day_tue = PlanDay(workout_plan_id=1, label="Tue", order_position=2, id=11, plan_week_id=1, is_rest=False)
        days_by_week = {1: [day_mon, day_tue]}

        result = resolve_effective_week(1, weeks, days_by_week)

        assert result["resolved_week_number"] == 1
        assert result["mode"] == "base"
        assert len(result["days"]) == 2
        assert result["days"][0].label == "Mon"
        assert result["days"][1].label == "Tue"

    def test_linked_week_resolves_to_preceding_base(self):
        """Week 2 linked resolves back to Week 1 base."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        week2 = PlanWeek(id=2, workout_plan_id=1, week_number=2, mode="linked")
        weeks = [week1, week2]

        day_mon = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        day_tue = PlanDay(workout_plan_id=1, label="Tue", order_position=2, id=11, plan_week_id=1, is_rest=False)
        days_by_week = {1: [day_mon, day_tue], 2: []}  # Linked week has no days

        result = resolve_effective_week(2, weeks, days_by_week)

        assert result["resolved_week_number"] == 1
        assert result["mode"] == "linked"
        assert len(result["days"]) == 2
        assert result["days"][0].label == "Mon"

    def test_custom_week_resolves_to_itself(self):
        """Week 2 custom resolves to itself, not back to Week 1."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        week2 = PlanWeek(id=2, workout_plan_id=1, week_number=2, mode="custom")
        weeks = [week1, week2]

        day_mon_w1 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        day_mon_w2 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=20, plan_week_id=2, is_rest=False)
        days_by_week = {1: [day_mon_w1], 2: [day_mon_w2]}

        result = resolve_effective_week(2, weeks, days_by_week)

        assert result["resolved_week_number"] == 2
        assert result["mode"] == "custom"
        assert result["days"][0].id == 20  # Week 2's own day, not Week 1's

    def test_multiple_linked_weeks_resolve_to_nearest_preceding_custom(self):
        """Weeks 4 & 5 linked resolve to Week 3 custom, not Week 1 base.

        This tests the critical case from spec §1.4:
        Week chain: 1(base)/2(linked)/3(custom)/4(linked)/5(linked)
        Week 4 and 5 should both resolve to Week 3, not Week 1.
        """
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        week2 = PlanWeek(id=2, workout_plan_id=1, week_number=2, mode="linked")
        week3 = PlanWeek(id=3, workout_plan_id=1, week_number=3, mode="custom")
        week4 = PlanWeek(id=4, workout_plan_id=1, week_number=4, mode="linked")
        week5 = PlanWeek(id=5, workout_plan_id=1, week_number=5, mode="linked")
        weeks = [week1, week2, week3, week4, week5]

        day_mon_w1 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        day_mon_w3 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=30, plan_week_id=3, is_rest=False)
        days_by_week = {
            1: [day_mon_w1],
            2: [],  # Linked
            3: [day_mon_w3],
            4: [],  # Linked
            5: [],  # Linked
        }

        # Resolve week 4
        result4 = resolve_effective_week(4, weeks, days_by_week)
        assert result4["resolved_week_number"] == 3
        assert result4["mode"] == "linked"
        assert result4["days"][0].id == 30  # Week 3's content

        # Resolve week 5
        result5 = resolve_effective_week(5, weeks, days_by_week)
        assert result5["resolved_week_number"] == 3
        assert result5["mode"] == "linked"
        assert result5["days"][0].id == 30  # Week 3's content, same as week 4

    def test_linked_week_immediately_after_base(self):
        """Week 2 linked immediately after Week 1 base resolves correctly."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        week2 = PlanWeek(id=2, workout_plan_id=1, week_number=2, mode="linked")
        weeks = [week1, week2]

        day1 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        days_by_week = {1: [day1], 2: []}

        result = resolve_effective_week(2, weeks, days_by_week)

        assert result["resolved_week_number"] == 1
        assert result["mode"] == "linked"

    def test_all_weeks_linked_except_base_resolves_to_base(self):
        """All non-base weeks linked fall back to base."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        week2 = PlanWeek(id=2, workout_plan_id=1, week_number=2, mode="linked")
        week3 = PlanWeek(id=3, workout_plan_id=1, week_number=3, mode="linked")
        weeks = [week1, week2, week3]

        day1 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        days_by_week = {1: [day1], 2: [], 3: []}

        result3 = resolve_effective_week(3, weeks, days_by_week)

        assert result3["resolved_week_number"] == 1
        assert result3["mode"] == "linked"

    def test_week_number_not_found_raises_error(self):
        """Requesting a week that doesn't exist raises ValueError."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        weeks = [week1]
        days_by_week = {1: []}

        with pytest.raises(ValueError, match="Week 5 not found"):
            resolve_effective_week(5, weeks, days_by_week)

    def test_negative_week_number_raises_error(self):
        """Negative week number raises ValueError."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        weeks = [week1]
        days_by_week = {1: []}

        with pytest.raises(ValueError, match="week_number must be >= 1"):
            resolve_effective_week(-1, weeks, days_by_week)

    def test_zero_week_number_raises_error(self):
        """Week number 0 raises ValueError."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        weeks = [week1]
        days_by_week = {1: []}

        with pytest.raises(ValueError, match="week_number must be >= 1"):
            resolve_effective_week(0, weeks, days_by_week)

    def test_missing_days_for_resolved_week_returns_empty_list(self):
        """If the resolved week has no entry in days_by_week, days list is empty."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        weeks = [week1]
        days_by_week = {}  # No entries at all

        result = resolve_effective_week(1, weeks, days_by_week)

        assert result["resolved_week_number"] == 1
        assert result["days"] == []

    def test_complex_week_chain_various_requests(self):
        """Test a realistic complex chain with various requests.

        Chain: 1(base)/2(linked)/3(linked)/4(custom)/5(linked)/6(linked)/7(custom)/8(linked)

        Expected resolutions:
        - Week 1 -> Week 1 (base)
        - Week 2 -> Week 1 (linked, nearest preceding is base)
        - Week 3 -> Week 1 (linked, nearest preceding is base)
        - Week 4 -> Week 4 (custom)
        - Week 5 -> Week 4 (linked, nearest preceding is custom)
        - Week 6 -> Week 4 (linked, nearest preceding is custom)
        - Week 7 -> Week 7 (custom)
        - Week 8 -> Week 7 (linked, nearest preceding is custom)
        """
        weeks = [
            PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base"),
            PlanWeek(id=2, workout_plan_id=1, week_number=2, mode="linked"),
            PlanWeek(id=3, workout_plan_id=1, week_number=3, mode="linked"),
            PlanWeek(id=4, workout_plan_id=1, week_number=4, mode="custom"),
            PlanWeek(id=5, workout_plan_id=1, week_number=5, mode="linked"),
            PlanWeek(id=6, workout_plan_id=1, week_number=6, mode="linked"),
            PlanWeek(id=7, workout_plan_id=1, week_number=7, mode="custom"),
            PlanWeek(id=8, workout_plan_id=1, week_number=8, mode="linked"),
        ]

        day1 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        day4 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=40, plan_week_id=4, is_rest=False)
        day7 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=70, plan_week_id=7, is_rest=False)
        days_by_week = {
            1: [day1],
            2: [],
            3: [],
            4: [day4],
            5: [],
            6: [],
            7: [day7],
            8: [],
        }

        # Week 1 base
        assert resolve_effective_week(1, weeks, days_by_week)["resolved_week_number"] == 1

        # Week 2 linked -> Week 1
        assert resolve_effective_week(2, weeks, days_by_week)["resolved_week_number"] == 1

        # Week 3 linked -> Week 1
        assert resolve_effective_week(3, weeks, days_by_week)["resolved_week_number"] == 1

        # Week 4 custom
        assert resolve_effective_week(4, weeks, days_by_week)["resolved_week_number"] == 4

        # Week 5 linked -> Week 4
        assert resolve_effective_week(5, weeks, days_by_week)["resolved_week_number"] == 4

        # Week 6 linked -> Week 4
        assert resolve_effective_week(6, weeks, days_by_week)["resolved_week_number"] == 4

        # Week 7 custom
        assert resolve_effective_week(7, weeks, days_by_week)["resolved_week_number"] == 7

        # Week 8 linked -> Week 7
        assert resolve_effective_week(8, weeks, days_by_week)["resolved_week_number"] == 7

    def test_preserves_mode_field_of_requested_week(self):
        """The mode field in response is always the mode of the *requested* week."""
        week1 = PlanWeek(id=1, workout_plan_id=1, week_number=1, mode="base")
        week2 = PlanWeek(id=2, workout_plan_id=1, week_number=2, mode="linked")
        week3 = PlanWeek(id=3, workout_plan_id=1, week_number=3, mode="custom")
        weeks = [week1, week2, week3]

        day1 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=10, plan_week_id=1, is_rest=False)
        day3 = PlanDay(workout_plan_id=1, label="Mon", order_position=1, id=30, plan_week_id=3, is_rest=False)
        days_by_week = {1: [day1], 2: [], 3: [day3]}

        # Week 2 is linked, so its response mode is "linked" (even though it resolves to week 1)
        result2 = resolve_effective_week(2, weeks, days_by_week)
        assert result2["mode"] == "linked"
        assert result2["resolved_week_number"] == 1

        # Week 3 is custom, so its response mode is "custom"
        result3 = resolve_effective_week(3, weeks, days_by_week)
        assert result3["mode"] == "custom"
        assert result3["resolved_week_number"] == 3
