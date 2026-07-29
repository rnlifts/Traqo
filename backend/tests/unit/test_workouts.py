"""Unit tests for workouts module."""

import pytest
from src.modules.workouts.domain.entities.workout_plan import WorkoutPlan
from src.modules.workouts.domain.entities.plan_day import PlanDay
from src.modules.workouts.domain.exceptions import (
    UnauthorizedWorkoutPlanAccessError,
    WorkoutPlanNotFoundError,
)
from src.modules.workouts.application.use_cases.create_workout_plan import CreateWorkoutPlan
from src.modules.workouts.application.use_cases.list_workout_plans import ListWorkoutPlans
from src.modules.workouts.application.use_cases.update_workout_plan import UpdateWorkoutPlan
from src.modules.workouts.application.use_cases.delete_workout_plan import DeleteWorkoutPlan


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def user_id():
    """Provide a test user ID."""
    return 1


@pytest.fixture
def other_user_id():
    """Provide a different user ID."""
    return 2


# ============================================================================
# CreateWorkoutPlan Tests
# ============================================================================


class TestCreateWorkoutPlan:
    """Tests for CreateWorkoutPlan use case."""

    def test_create_plan_with_valid_data(self, in_memory_plan_repo, user_id):
        """CreateWorkoutPlan creates a new plan."""
        use_case = CreateWorkoutPlan(in_memory_plan_repo)

        plan = use_case.execute(user_id, "Push Day")

        assert plan.id == 1
        assert plan.user_id == user_id
        assert plan.name == "Push Day"

    def test_create_multiple_plans(self, in_memory_plan_repo, user_id):
        """User can create multiple plans."""
        use_case = CreateWorkoutPlan(in_memory_plan_repo)

        plan1 = use_case.execute(user_id, "Push Day")
        plan2 = use_case.execute(user_id, "Pull Day")

        assert plan1.id == 1
        assert plan2.id == 2
        assert plan1.name != plan2.name

    def test_different_users_can_create_plans_with_same_name(
        self, in_memory_plan_repo, user_id, other_user_id
    ):
        """Different users can create plans with same name."""
        use_case = CreateWorkoutPlan(in_memory_plan_repo)

        plan1 = use_case.execute(user_id, "My Program")
        plan2 = use_case.execute(other_user_id, "My Program")

        assert plan1.user_id == user_id
        assert plan2.user_id == other_user_id
        assert plan1.id != plan2.id


# ============================================================================
# ListWorkoutPlans Tests
# ============================================================================


class TestListWorkoutPlans:
    """Tests for ListWorkoutPlans use case."""

    def test_list_plans_for_user(self, in_memory_plan_repo, user_id):
        """ListWorkoutPlans returns all plans for a user."""
        create_use_case = CreateWorkoutPlan(in_memory_plan_repo)
        create_use_case.execute(user_id, "Push Day")
        create_use_case.execute(user_id, "Pull Day")

        list_use_case = ListWorkoutPlans(in_memory_plan_repo)
        plans = list_use_case.execute(user_id)

        assert len(plans) == 2
        names = {p.name for p in plans}
        assert names == {"Push Day", "Pull Day"}

    def test_list_plans_empty_for_user_with_no_plans(self, in_memory_plan_repo, user_id):
        """ListWorkoutPlans returns empty list when user has no plans."""
        list_use_case = ListWorkoutPlans(in_memory_plan_repo)

        plans = list_use_case.execute(user_id)

        assert plans == []

    def test_list_plans_excludes_other_users_plans(
        self, in_memory_plan_repo, user_id, other_user_id
    ):
        """ListWorkoutPlans only returns plans for the requested user."""
        create_use_case = CreateWorkoutPlan(in_memory_plan_repo)

        create_use_case.execute(user_id, "Push Day")
        create_use_case.execute(other_user_id, "Leg Day")

        list_use_case = ListWorkoutPlans(in_memory_plan_repo)
        plans = list_use_case.execute(user_id)

        assert len(plans) == 1
        assert plans[0].name == "Push Day"
        assert plans[0].user_id == user_id


# ============================================================================
# UpdateWorkoutPlan Tests
# ============================================================================


class TestUpdateWorkoutPlan:
    """Tests for UpdateWorkoutPlan use case."""

    def test_update_plan_name(self, in_memory_plan_repo, user_id):
        """UpdateWorkoutPlan changes plan name."""
        create_use_case = CreateWorkoutPlan(in_memory_plan_repo)
        plan = create_use_case.execute(user_id, "Old Name")

        update_use_case = UpdateWorkoutPlan(in_memory_plan_repo)
        updated = update_use_case.execute(plan.id, "New Name", user_id)

        assert updated.name == "New Name"
        assert updated.user_id == user_id

    def test_update_plan_owner_must_match(self, in_memory_plan_repo, user_id, other_user_id):
        """UpdateWorkoutPlan raises error if user doesn't own plan."""
        create_use_case = CreateWorkoutPlan(in_memory_plan_repo)
        plan = create_use_case.execute(user_id, "My Plan")

        update_use_case = UpdateWorkoutPlan(in_memory_plan_repo)
        with pytest.raises(UnauthorizedWorkoutPlanAccessError):
            update_use_case.execute(plan.id, "New Name", other_user_id)

    def test_update_nonexistent_plan_raises_error(self, in_memory_plan_repo, user_id):
        """UpdateWorkoutPlan raises error for nonexistent plan."""
        update_use_case = UpdateWorkoutPlan(in_memory_plan_repo)

        with pytest.raises(WorkoutPlanNotFoundError):
            update_use_case.execute(999, "New Name", user_id)


# ============================================================================
# DeleteWorkoutPlan Tests
# ============================================================================


class TestDeleteWorkoutPlan:
    """Tests for DeleteWorkoutPlan use case."""

    def test_delete_plan_owner_can_delete(self, in_memory_plan_repo, user_id):
        """DeleteWorkoutPlan succeeds when owner deletes plan."""
        create_use_case = CreateWorkoutPlan(in_memory_plan_repo)
        plan = create_use_case.execute(user_id, "Push Day")

        delete_use_case = DeleteWorkoutPlan(in_memory_plan_repo)
        delete_use_case.execute(plan.id, user_id)

        # Verify plan is deleted
        assert in_memory_plan_repo.get_by_id(plan.id) is None

    def test_delete_nonexistent_plan_raises_error(self, in_memory_plan_repo, user_id):
        """DeleteWorkoutPlan raises error for nonexistent plan."""
        delete_use_case = DeleteWorkoutPlan(in_memory_plan_repo)

        with pytest.raises(WorkoutPlanNotFoundError):
            delete_use_case.execute(999, user_id)

    def test_delete_plan_wrong_owner_raises_error(
        self, in_memory_plan_repo, user_id, other_user_id
    ):
        """DeleteWorkoutPlan raises error when user doesn't own plan."""
        create_use_case = CreateWorkoutPlan(in_memory_plan_repo)
        plan = create_use_case.execute(user_id, "My Plan")

        delete_use_case = DeleteWorkoutPlan(in_memory_plan_repo)
        with pytest.raises(UnauthorizedWorkoutPlanAccessError):
            delete_use_case.execute(plan.id, other_user_id)

        # Plan should still exist
        assert in_memory_plan_repo.get_by_id(plan.id) is not None

    def test_delete_multiple_plans(self, in_memory_plan_repo, user_id):
        """Can delete multiple plans sequentially."""
        create_use_case = CreateWorkoutPlan(in_memory_plan_repo)
        plan1 = create_use_case.execute(user_id, "Push")
        plan2 = create_use_case.execute(user_id, "Pull")

        delete_use_case = DeleteWorkoutPlan(in_memory_plan_repo)
        delete_use_case.execute(plan1.id, user_id)
        delete_use_case.execute(plan2.id, user_id)

        assert in_memory_plan_repo.get_by_id(plan1.id) is None
        assert in_memory_plan_repo.get_by_id(plan2.id) is None


# ============================================================================
# PlanDay Repository Tests
# ============================================================================


class TestPlanDayRepository:
    """Tests for plan day CRUD via repository."""

    def test_create_plan_day(self, in_memory_plan_repo, in_memory_day_repo, user_id):
        """Can create a plan day."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Test Plan"))

        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        assert day.id is not None
        assert day.workout_plan_id == plan.id

    def test_list_days_for_plan(self, in_memory_plan_repo, in_memory_day_repo, user_id):
        """Can list days for a plan (sorted by position)."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Test Plan"))

        day1 = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=2, label="Day 2")
        )
        day2 = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        days = in_memory_day_repo.list_by_plan(plan.id)

        assert len(days) == 2
        # Should be sorted by order_position
        assert days[0].order_position == 1
        assert days[1].order_position == 2

    def test_get_day_by_id(self, in_memory_plan_repo, in_memory_day_repo, user_id):
        """Can retrieve a day by id."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Test Plan"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        retrieved = in_memory_day_repo.get_by_id(day.id)

        assert retrieved is not None
        assert retrieved.id == day.id
        assert retrieved.label == "Day 1"

    def test_delete_day(self, in_memory_plan_repo, in_memory_day_repo, user_id):
        """Can delete a day."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Test Plan"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Day 1")
        )

        in_memory_day_repo.delete(day.id)

        assert in_memory_day_repo.get_by_id(day.id) is None

    def test_update_day(self, in_memory_plan_repo, in_memory_day_repo, user_id):
        """Can update a day."""
        plan = in_memory_plan_repo.create(WorkoutPlan(user_id=user_id, name="Test Plan"))
        day = in_memory_day_repo.create(
            PlanDay(workout_plan_id=plan.id, order_position=1, label="Old Label")
        )

        day.label = "New Label"
        updated = in_memory_day_repo.update(day)

        assert updated.label == "New Label"
        retrieved = in_memory_day_repo.get_by_id(day.id)
        assert retrieved.label == "New Label"
