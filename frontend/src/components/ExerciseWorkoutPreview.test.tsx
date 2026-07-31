import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExerciseWorkoutPreview } from "./ExerciseWorkoutPreview";

describe("ExerciseWorkoutPreview", () => {
  describe("Exercise name", () => {
    it("displays exercise name", () => {
      render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url={null}
          muscle_group={null}
          equipment={null}
        />
      );

      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });
  });

  describe("Video rendering", () => {
    it("renders iframe when video_url is valid", () => {
      render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          muscle_group={null}
          equipment={null}
        />
      );

      const iframe = screen.getByTitle("Bench Press");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
      expect(iframe).toHaveAttribute("allowFullScreen");
    });

    it("renders no video message when video_url is null", () => {
      render(
        <ExerciseWorkoutPreview
          name="Squats"
          video_url={null}
          muscle_group={null}
          equipment={null}
        />
      );

      expect(screen.getByText("No video available")).toBeInTheDocument();
      expect(screen.getByText("🎬")).toBeInTheDocument();
    });

    it("renders no video message when video_url is invalid", () => {
      render(
        <ExerciseWorkoutPreview
          name="Deadlift"
          video_url="https://www.example.com/not-youtube"
          muscle_group={null}
          equipment={null}
        />
      );

      expect(screen.getByText("No video available")).toBeInTheDocument();
    });

    it("does not autoplay iframe", () => {
      render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          muscle_group={null}
          equipment={null}
        />
      );

      const iframe = screen.getByTitle("Bench Press");
      expect(iframe.getAttribute("src")).not.toContain("autoplay");
    });
  });

  describe("Tag pills", () => {
    it("renders both muscle_group and equipment tags when present", () => {
      render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url={null}
          muscle_group="chest"
          equipment="barbell"
        />
      );

      expect(screen.getByText("chest")).toBeInTheDocument();
      expect(screen.getByText("barbell")).toBeInTheDocument();
    });

    it("renders only muscle_group tag when equipment is null", () => {
      render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url={null}
          muscle_group="chest"
          equipment={null}
        />
      );

      expect(screen.getByText("chest")).toBeInTheDocument();
      expect(screen.queryByText("barbell")).not.toBeInTheDocument();
    });

    it("renders only equipment tag when muscle_group is null", () => {
      render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url={null}
          muscle_group={null}
          equipment="barbell"
        />
      );

      expect(screen.getByText("barbell")).toBeInTheDocument();
      expect(screen.queryByText("chest")).not.toBeInTheDocument();
    });

    it("renders no tags when both are null", () => {
      const { container } = render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url={null}
          muscle_group={null}
          equipment={null}
        />
      );

      const tags = container.querySelectorAll("[style*='background-color: var(--bg-hover)']");
      expect(tags.length).toBe(0);
    });
  });

  describe("Combined states", () => {
    it("displays video, name, and both tags together", () => {
      render(
        <ExerciseWorkoutPreview
          name="Bench Press"
          video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          muscle_group="chest"
          equipment="barbell"
        />
      );

      expect(screen.getByText("Bench Press")).toBeInTheDocument();
      expect(screen.getByTitle("Bench Press")).toBeInTheDocument();
      expect(screen.getByText("chest")).toBeInTheDocument();
      expect(screen.getByText("barbell")).toBeInTheDocument();
    });

    it("displays no video with muscle_group and equipment tags", () => {
      render(
        <ExerciseWorkoutPreview
          name="Squats"
          video_url={null}
          muscle_group="legs"
          equipment="barbell"
        />
      );

      expect(screen.getByText("Squats")).toBeInTheDocument();
      expect(screen.getByText("No video available")).toBeInTheDocument();
      expect(screen.getByText("legs")).toBeInTheDocument();
      expect(screen.getByText("barbell")).toBeInTheDocument();
    });
  });

  describe("URL handling", () => {
    it("handles youtu.be short URLs", () => {
      render(
        <ExerciseWorkoutPreview
          name="Deadlift"
          video_url="https://youtu.be/dQw4w9WgXcQ"
          muscle_group={null}
          equipment={null}
        />
      );

      const iframe = screen.getByTitle("Deadlift");
      expect(iframe).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });
  });
});
