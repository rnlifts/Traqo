import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExercisePreviewPanel } from "./ExercisePreviewPanel";

describe("ExercisePreviewPanel", () => {
  describe("Nothing selected state", () => {
    it("displays placeholder when no exercise is selected", () => {
      render(<ExercisePreviewPanel selected={null} />);

      expect(screen.getByText("Click exercise to preview")).toBeInTheDocument();
    });

    it("displays eye icon in placeholder", () => {
      render(<ExercisePreviewPanel selected={null} />);

      const icon = screen.getByText("👁️");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Selected with video URL state", () => {
    const videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    it("displays exercise name", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Bench Press",
            video_url: videoUrl,
          }}
        />
      );

      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    it("renders iframe with correct embed URL directly (no autoplay)", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Bench Press",
            video_url: videoUrl,
          }}
        />
      );

      const iframe = screen.getByTitle("Bench Press");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("iframe has allowFullScreen attribute", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Bench Press",
            video_url: videoUrl,
          }}
        />
      );

      const iframe = screen.getByTitle("Bench Press");
      expect(iframe).toHaveAttribute("allowFullScreen");
    });

    it("handles youtu.be short URLs correctly", () => {
      const shortUrl = "https://youtu.be/dQw4w9WgXcQ";
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Deadlift",
            video_url: shortUrl,
          }}
        />
      );

      const iframe = screen.getByTitle("Deadlift");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });
  });

  describe("Selected without video URL state", () => {
    it("displays exercise name", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Squats",
            video_url: null,
          }}
        />
      );

      expect(screen.getByText("Squats")).toBeInTheDocument();
    });

    it("displays 'No preview available' message", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Squats",
            video_url: null,
          }}
        />
      );

      expect(screen.getByText("No video available")).toBeInTheDocument();
    });

    it("displays film icon in empty state", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Squats",
            video_url: null,
          }}
        />
      );

      const icon = screen.getByText("🎬");
      expect(icon).toBeInTheDocument();
    });

    it("does not display play button", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Squats",
            video_url: null,
          }}
        />
      );

      const playButton = screen.queryByTitle("Play video");
      expect(playButton).not.toBeInTheDocument();
    });
  });

  describe("State transitions", () => {
    const videoUrl1 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const videoUrl2 = "https://www.youtube.com/watch?v=9bZkp7q19f0";

    it("switches from nothing selected to exercise with video", () => {
      const { rerender } = render(<ExercisePreviewPanel selected={null} />);

      expect(
        screen.getByText("Click exercise to preview")
      ).toBeInTheDocument();

      rerender(
        <ExercisePreviewPanel
          selected={{
            name: "Bench Press",
            video_url: videoUrl1,
          }}
        />
      );

      expect(screen.getByText("Bench Press")).toBeInTheDocument();
      expect(screen.getByTitle("Bench Press")).toBeInTheDocument(); // iframe
    });

    it("switches between exercises with videos and updates iframe URLs", () => {
      const { rerender } = render(
        <ExercisePreviewPanel
          selected={{
            name: "Bench Press",
            video_url: videoUrl1,
          }}
        />
      );

      expect(screen.getByTitle("Bench Press")).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );

      rerender(
        <ExercisePreviewPanel
          selected={{
            name: "Squat",
            video_url: videoUrl2,
          }}
        />
      );

      expect(screen.getByTitle("Squat")).toHaveAttribute(
        "src",
        "https://www.youtube.com/embed/9bZkp7q19f0"
      );
    });

    it("switches from exercise with video to exercise without video", () => {
      const { rerender } = render(
        <ExercisePreviewPanel
          selected={{
            name: "Bench Press",
            video_url: videoUrl1,
          }}
        />
      );

      expect(screen.getByText("Bench Press")).toBeInTheDocument();
      expect(screen.getByTitle("Bench Press")).toBeInTheDocument(); // iframe

      rerender(
        <ExercisePreviewPanel
          selected={{
            name: "Mystery Exercise",
            video_url: null,
          }}
        />
      );

      expect(screen.getByText("Mystery Exercise")).toBeInTheDocument();
      expect(screen.getByText("No video available")).toBeInTheDocument();
      expect(screen.queryByTitle("Mystery Exercise")).not.toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles invalid video URL gracefully", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Invalid Video",
            video_url: "https://www.example.com/not-youtube",
          }}
        />
      );

      // Should show empty state instead of crashing
      expect(screen.getByText("Invalid Video")).toBeInTheDocument();
      expect(screen.getByText("No video available")).toBeInTheDocument();
      expect(screen.queryByTitle("Invalid Video")).not.toBeInTheDocument();
    });

    it("handles undefined video_url", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Undefined Video",
            video_url: undefined as any,
          }}
        />
      );

      expect(screen.getByText("Undefined Video")).toBeInTheDocument();
      expect(screen.getByText("No video available")).toBeInTheDocument();
    });

    it("handles empty string video_url", () => {
      render(
        <ExercisePreviewPanel
          selected={{
            name: "Empty Video",
            video_url: "",
          }}
        />
      );

      expect(screen.getByText("Empty Video")).toBeInTheDocument();
      expect(screen.getByText("No video available")).toBeInTheDocument();
    });
  });
});
