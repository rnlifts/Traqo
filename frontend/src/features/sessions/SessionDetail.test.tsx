import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SessionDetail } from "./SessionDetail";
import { en } from "../../i18n/en";
import type { WorkoutSessionDetail, WorkoutSetWithExercise } from "../../api/workoutSessionsApi";
import type { PlanDay } from "../../api/workoutPlansApi";

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en", t: en, setLanguage: vi.fn() }),
}));

const baseSession: WorkoutSessionDetail["session"] = {
  id: 1,
  user_id: 1,
  workout_plan_id: 1,
  plan_day_id: 1,
  started_at: "2026-08-11T07:00:00Z",
  completed_at: "2026-08-11T07:10:00Z",
  duration_minutes: 10,
};

function renderDetail(sets: WorkoutSetWithExercise[], matchingDay: PlanDay | null) {
  render(
    <MemoryRouter>
      <SessionDetail session={baseSession} sets={sets} matchingDay={matchingDay} dayLabel="Day 1" />
    </MemoryRouter>
  );
}

describe("SessionDetail", () => {
  describe("duration-only sets", () => {
    const durationOnlySet: WorkoutSetWithExercise = {
      id: 1,
      workout_session_id: 1,
      exercise_id: 5,
      workout_exercise_id: 10,
      exercise_name: "Squat Hold",
      set_number: 1,
      weight: null,
      reps: null,
      duration_seconds: 60,
      notes: "",
    };

    it("renders the duration, not null × null, when a plan day matches (has_duration exercise)", () => {
      const matchingDay: PlanDay = {
        id: 1,
        label: "Day 1",
        order_position: 1,
        exercises: [
          {
            id: 10,
            plan_day_id: 1,
            exercise_id: 5,
            order_number: 1,
            target_sets: 1,
            target_reps: null,
            target_weight: null,
            target_duration_seconds: 60,
            has_reps: false,
            has_weight: false,
            has_duration: true,
            set_targets: [],
            exercise_name: "Squat Hold",
          },
        ],
      };

      renderDetail([durationOnlySet], matchingDay);

      expect(screen.getByText("Set 1: 60s")).toBeInTheDocument();
      expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    });

    it("renders the duration, not null × null, in the fallback (no matching plan day) branch", () => {
      renderDetail([durationOnlySet], null);

      expect(screen.getByText("Set 1: 60s")).toBeInTheDocument();
      expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    });
  });

  describe("weight/reps sets (unchanged behavior)", () => {
    const weightRepsSet: WorkoutSetWithExercise = {
      id: 2,
      workout_session_id: 1,
      exercise_id: 6,
      workout_exercise_id: 11,
      exercise_name: "Bench Press",
      set_number: 1,
      weight: 135,
      reps: 8,
      duration_seconds: null,
      notes: "",
    };

    it("still renders weight × reps in the fallback branch", () => {
      renderDetail([weightRepsSet], null);

      expect(screen.getByText("Set 1: 135 × 8")).toBeInTheDocument();
    });
  });
});
