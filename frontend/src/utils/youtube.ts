/**
 * YouTube URL utilities for extracting video IDs and generating thumbnail/embed URLs.
 * Mirrors the backend's derive_youtube_thumbnail() logic.
 */

/**
 * Extracts the video ID from a YouTube URL.
 * Supports both youtube.com/watch?v=... and youtu.be/... formats.
 * @param videoUrl - Full YouTube URL or null
 * @returns 11-character video ID, or null if invalid or empty
 */
export function extractYoutubeVideoId(videoUrl?: string | null): string | null {
  if (!videoUrl) return null;

  let videoId: string | null = null;

  if (videoUrl.includes("youtube.com/watch")) {
    const idx = videoUrl.indexOf("v=");
    if (idx !== -1) {
      videoId = videoUrl.slice(idx + 2, idx + 13);
    }
  } else if (videoUrl.includes("youtu.be/")) {
    const idx = videoUrl.indexOf("youtu.be/");
    if (idx !== -1) {
      videoId = videoUrl.slice(idx + 9, idx + 20);
    }
  }

  return videoId;
}

/**
 * Generates a YouTube thumbnail image URL from a video URL.
 * @param videoUrl - Full YouTube URL or null
 * @returns Thumbnail image URL (hqdefault.jpg), or null if invalid or empty
 */
export function getYoutubeThumbnailUrl(videoUrl?: string | null): string | null {
  const videoId = extractYoutubeVideoId(videoUrl);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Generates a YouTube embed URL suitable for iframe src.
 * Note: Does not include autoplay parameter; add ?autoplay=1 after user clicks play.
 * @param videoUrl - Full YouTube URL or null
 * @returns Embed URL (without autoplay), or null if invalid or empty
 */
export function getYoutubeEmbedUrl(videoUrl?: string | null): string | null {
  const videoId = extractYoutubeVideoId(videoUrl);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}
