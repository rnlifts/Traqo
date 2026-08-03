import React from "react";
import { getYoutubeEmbedUrl } from "../utils/youtube";

export interface ExercisePreviewPanelProps {
  selected: {
    name: string;
    video_url: string | null;
  } | null;
  fullWidth?: boolean;
}

export const ExercisePreviewPanel: React.FC<ExercisePreviewPanelProps> = ({
  selected,
  fullWidth = false,
}) => {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    backgroundColor: "var(--surface)",
    width: fullWidth ? "100%" : "300px",
    flexShrink: 0,
    minHeight: "200px",
    justifyContent: "flex-start",
    borderRadius: "6px",
  };

  const placeholderStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "var(--text-h)",
    fontSize: "12px",
    textAlign: "center",
    minHeight: "180px",
    flex: 1,
  };

  const nameStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: "500",
    color: "var(--text)",
    marginBottom: "4px",
    wordBreak: "break-word",
  };

  const videoContainerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    paddingBottom: "56.25%", // 16:9 aspect ratio
    borderRadius: "6px",
    overflow: "hidden",
  };

  const iframeStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: "6px",
  };

  const emptyStateStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "180px",
    color: "var(--text-h)",
    fontSize: "12px",
    textAlign: "center",
    flex: 1,
  };

  // Nothing selected
  if (!selected) {
    return (
      <div style={containerStyle}>
        <div style={placeholderStyle}>
          <div style={{ fontSize: "24px" }}>👁️</div>
          <div>Click exercise to preview</div>
        </div>
      </div>
    );
  }

  // Selected with video URL
  if (selected.video_url) {
    const embedUrl = getYoutubeEmbedUrl(selected.video_url);
    if (embedUrl) {
      return (
        <div style={containerStyle}>
          <div style={nameStyle}>{selected.name}</div>
          <div style={videoContainerStyle}>
            <iframe
              src={embedUrl}
              title={selected.name}
              style={iframeStyle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      );
    }
  }

  // Selected without video URL
  return (
    <div style={containerStyle}>
      <div style={nameStyle}>{selected.name}</div>
      <div style={emptyStateStyle}>
        <div style={{ fontSize: "20px" }}>🎬</div>
        <div style={{ fontSize: "11px", color: "var(--text-h)" }}>
          No video available
        </div>
      </div>
    </div>
  );
};
