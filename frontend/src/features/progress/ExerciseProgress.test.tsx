import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ExerciseProgress } from "./ExerciseProgress";
import { en } from "../../i18n/en";
import type { ExerciseProgressResult } from "../../api/progressApi";

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en", t: en, setLanguage: vi.fn() }),
}));

function renderProgress(data: ExerciseProgressResult) {
  render(
    <MemoryRouter>
      <ExerciseProgress data={data} loading={false} error={null} />
    </MemoryRouter>
  );
}

describe("ExerciseProgress", () => {
  it("shows the duration for a duration-only set instead of 'not set'", () => {
    const data: ExerciseProgressResult = {
      exercise_id: 1,
      exercise_name: "Cardio",
      sessions: [
        {
          session_id: 1,
          date: "2026-08-11T07:00:00Z",
          volume: 0,
          is_volume_pr: false,
          sets: [
            {
              set_number: 1,
              weight: null,
              reps: null,
              duration_seconds: 60,
              notes: "",
              estimated_1rm: null,
              is_weight_pr: false,
              is_reps_pr: false,
              is_e1rm_pr: false,
            },
          ],
        },
      ],
      personal_records: {
        heaviest_weight: null,
        heaviest_weight_date: null,
        best_estimated_1rm: null,
        best_estimated_1rm_date: null,
        best_volume: null,
        best_volume_date: null,
        most_reps: null,
        most_reps_date: null,
      },
    };

    renderProgress(data);

    expect(screen.getByText("Set 1: 60s")).toBeInTheDocument();
    expect(screen.queryByText(/not set/)).not.toBeInTheDocument();
  });

  it("does not show a Best Volume PR card or a per-session Volume line for a duration-only exercise", () => {
    const data: ExerciseProgressResult = {
      exercise_id: 1,
      exercise_name: "Plank Hold",
      sessions: [
        {
          session_id: 1,
          date: "2026-08-11T07:00:00Z",
          volume: 0,
          is_volume_pr: false,
          sets: [
            {
              set_number: 1,
              weight: null,
              reps: null,
              duration_seconds: 90,
              notes: "",
              estimated_1rm: null,
              is_weight_pr: false,
              is_reps_pr: false,
              is_e1rm_pr: false,
            },
          ],
        },
      ],
      personal_records: {
        heaviest_weight: null,
        heaviest_weight_date: null,
        best_estimated_1rm: null,
        best_estimated_1rm_date: null,
        best_volume: null,
        best_volume_date: null,
        most_reps: null,
        most_reps_date: null,
      },
    };

    renderProgress(data);

    expect(screen.queryByText("Best Volume")).not.toBeInTheDocument();
    expect(screen.queryByText(/Volume: 0/)).not.toBeInTheDocument();
  });

  it("still shows weight × reps sets and Best Volume PR unchanged", () => {
    const data: ExerciseProgressResult = {
      exercise_id: 1,
      exercise_name: "Bench Press",
      sessions: [
        {
          session_id: 1,
          date: "2026-08-11T07:00:00Z",
          volume: 1080,
          is_volume_pr: false,
          sets: [
            {
              set_number: 1,
              weight: 135,
              reps: 8,
              duration_seconds: null,
              notes: "",
              estimated_1rm: 171,
              is_weight_pr: false,
              is_reps_pr: false,
              is_e1rm_pr: false,
            },
          ],
        },
      ],
      personal_records: {
        heaviest_weight: 135,
        heaviest_weight_date: "2026-08-11T07:00:00Z",
        best_estimated_1rm: null,
        best_estimated_1rm_date: null,
        best_volume: 1080,
        best_volume_date: "2026-08-11T07:00:00Z",
        most_reps: null,
        most_reps_date: null,
      },
    };

    renderProgress(data);

    expect(screen.getByText("Set 1: 135 × 8")).toBeInTheDocument();
    expect(screen.getByText("Best Volume")).toBeInTheDocument();
    expect(screen.getByText("Volume: 1080.0 lbs")).toBeInTheDocument();
  });
});
