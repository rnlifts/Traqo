import { describe, it, expect } from "vitest";
import {
  extractYoutubeVideoId,
  getYoutubeThumbnailUrl,
  getYoutubeEmbedUrl,
} from "./youtube";

describe("YouTube Utilities", () => {
  describe("extractYoutubeVideoId", () => {
    it("extracts video ID from youtube.com/watch?v= URL", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      expect(extractYoutubeVideoId(url)).toBe("dQw4w9WgXcQ");
    });

    it("extracts video ID from youtu.be/ short URL", () => {
      const url = "https://youtu.be/dQw4w9WgXcQ";
      expect(extractYoutubeVideoId(url)).toBe("dQw4w9WgXcQ");
    });

    it("extracts video ID from youtube.com URL with additional parameters", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s";
      expect(extractYoutubeVideoId(url)).toBe("dQw4w9WgXcQ");
    });

    it("extracts video ID from youtu.be URL with additional path", () => {
      const url = "https://youtu.be/dQw4w9WgXcQ?t=10";
      expect(extractYoutubeVideoId(url)).toBe("dQw4w9WgXcQ");
    });

    it("returns null for non-YouTube URLs", () => {
      const url = "https://www.google.com/search?q=test";
      expect(extractYoutubeVideoId(url)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractYoutubeVideoId("")).toBeNull();
    });

    it("returns null for null", () => {
      expect(extractYoutubeVideoId(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(extractYoutubeVideoId(undefined)).toBeNull();
    });

    it("handles youtube.com/watch URLs without protocol", () => {
      const url = "youtube.com/watch?v=dQw4w9WgXcQ";
      expect(extractYoutubeVideoId(url)).toBe("dQw4w9WgXcQ");
    });
  });

  describe("getYoutubeThumbnailUrl", () => {
    it("generates correct thumbnail URL from valid youtube.com URL", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      expect(getYoutubeThumbnailUrl(url)).toBe(
        "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      );
    });

    it("generates correct thumbnail URL from valid youtu.be URL", () => {
      const url = "https://youtu.be/dQw4w9WgXcQ";
      expect(getYoutubeThumbnailUrl(url)).toBe(
        "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      );
    });

    it("returns null for invalid YouTube URL", () => {
      const url = "https://www.google.com/search";
      expect(getYoutubeThumbnailUrl(url)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(getYoutubeThumbnailUrl("")).toBeNull();
    });

    it("returns null for null", () => {
      expect(getYoutubeThumbnailUrl(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(getYoutubeThumbnailUrl(undefined)).toBeNull();
    });
  });

  describe("getYoutubeEmbedUrl", () => {
    it("generates correct embed URL from valid youtube.com URL", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      expect(getYoutubeEmbedUrl(url)).toBe(
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("generates correct embed URL from valid youtu.be URL", () => {
      const url = "https://youtu.be/dQw4w9WgXcQ";
      expect(getYoutubeEmbedUrl(url)).toBe(
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });

    it("does NOT include autoplay parameter in base URL", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const embedUrl = getYoutubeEmbedUrl(url);
      expect(embedUrl).not.toContain("autoplay");
    });

    it("returns null for invalid YouTube URL", () => {
      const url = "https://www.google.com/search";
      expect(getYoutubeEmbedUrl(url)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(getYoutubeEmbedUrl("")).toBeNull();
    });

    it("returns null for null", () => {
      expect(getYoutubeEmbedUrl(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(getYoutubeEmbedUrl(undefined)).toBeNull();
    });
  });
});
