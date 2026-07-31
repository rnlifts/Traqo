import React from "react";
import { getYoutubeEmbedUrl } from "../utils/youtube";

export interface ExerciseWorkoutPreviewProps {
  name: string;
  video_url: string | null;
  muscle_group: string | null;
  equipment: string | null;
}

export const ExerciseWorkoutPreview: React.FC<ExerciseWorkoutPreviewProps> = ({
  name,
  video_url,
  muscle_group,
  equipment,
}) => {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
  };

  const nameStyle: React.CSSProperties = {
    fontSize: "16px",
    fontWeight: "600",
    color: "var(--text)",
    margin: 0,
  };

  const videoContainerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    paddingBottom: "56.25%",
    borderRadius: "6px",
    overflow: "hidden",
    backgroundColor: "var(--bg)",
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

  const noVideoStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "200px",
    color: "var(--text-h)",
    fontSize: "14px",
    textAlign: "center",
    backgroundColor: "var(--bg)",
    borderRadius: "6px",
  };

  const tagsContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  };

  const tagStyle: React.CSSProperties = {
    display: "inline-block",
    backgroundColor: "var(--bg-hover)",
    color: "var(--text)",
    padding: "6px 12px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: "500",
    whiteSpace: "nowrap",
  };

  const renderVideo = () => {
    if (!video_url) {
      return (
        <div style={noVideoStyle}>
          <div style={{ fontSize: "20px" }}>🎬</div>
          <div>No video available</div>
        </div>
      );
    }

    const embedUrl = getYoutubeEmbedUrl(video_url);
    if (!embedUrl) {
      return (
        <div style={noVideoStyle}>
          <div style={{ fontSize: "20px" }}>🎬</div>
          <div>No video available</div>
        </div>
      );
    }

    return (
      <div style={videoContainerStyle}>
        <iframe
          src={embedUrl}
          title={name}
          style={iframeStyle}
          allowFullScreen
        />
      </div>
    );
  };

  const renderTags = () => {
    const tags = [];
    if (muscle_group) {
      tags.push(
        <div key="muscle" style={tagStyle}>
          {muscle_group}
        </div>
      );
    }
    if (equipment) {
      tags.push(
        <div key="equipment" style={tagStyle}>
          {equipment}
        </div>
      );
    }

    if (tags.length === 0) {
      return null;
    }

    return <div style={tagsContainerStyle}>{tags}</div>;
  };

  return (
    <div style={containerStyle}>
      <h3 style={nameStyle}>{name}</h3>
      {renderVideo()}
      {renderTags()}
    </div>
  );
};
