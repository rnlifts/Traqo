import React, { useState } from "react";
import { Link } from "react-router-dom";
import { TrendChart, type TrendChartDataPoint } from "../../components/TrendChart";
import type { ExerciseProgressResult } from "../../api/progressApi";

type MetricType = "est_1rm" | "volume" | "best_weight";

interface ExerciseProgressProps {
  data: ExerciseProgressResult;
  loading: boolean;
  error: string | null;
}

export const ExerciseProgress: React.FC<ExerciseProgressProps> = ({
  data,
  loading,
  error,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("est_1rm");

  if (loading) {
    return <div className="loading">Loading progress data...</div>;
  }

  if (error) {
    return (
      <div className="page-container">
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          className="error-message"
        >
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Build chart data based on selected metric
  const buildChartData = (): TrendChartDataPoint[] => {
    switch (selectedMetric) {
      case "est_1rm": {
        // For Est. 1RM, find the best estimated_1rm in each session (filter out nulls)
        return data.sessions
          .map((session) => {
            const setsWithE1rm = session.sets.filter((s) => s.estimated_1rm !== null);
            if (setsWithE1rm.length === 0) return null;
            const bestSet = setsWithE1rm.reduce((max, current) =>
              current.estimated_1rm! > max.estimated_1rm! ? current : max
            );
            return {
              date: session.date,
              value: bestSet.estimated_1rm!,
              isPR: bestSet.is_e1rm_pr,
            };
          })
          .filter((p) => p !== null) as TrendChartDataPoint[];
      }
      case "volume": {
        return data.sessions.map((session) => ({
          date: session.date,
          value: session.volume,
          isPR: session.is_volume_pr,
        }));
      }
      case "best_weight": {
        // For Best Weight, find the heaviest weight in each session (filter out nulls)
        return data.sessions
          .map((session) => {
            const setsWithWeight = session.sets.filter((s) => s.weight !== null);
            if (setsWithWeight.length === 0) return null;
            const bestSet = setsWithWeight.reduce((max, current) =>
              current.weight! > max.weight! ? current : max
            );
            return {
              date: session.date,
              value: bestSet.weight!,
              isPR: bestSet.is_weight_pr,
            };
          })
          .filter((p) => p !== null) as TrendChartDataPoint[];
      }
    }
  };

  const getChartLabel = (): string => {
    switch (selectedMetric) {
      case "est_1rm":
        return "Estimated 1RM (lbs)";
      case "volume":
        return "Volume (lbs)";
      case "best_weight":
        return "Heaviest Weight (lbs)";
    }
  };

  const chartData = buildChartData();

  // Get display name for a PR category
  const getPRLabel = (isPR: boolean, category: string): string | null => {
    if (!isPR) return null;
    switch (category) {
      case "weight":
        return "New personal record: heaviest weight";
      case "reps":
        return "New personal record: most reps";
      case "e1rm":
        return "New personal record: best estimated 1RM";
      case "volume":
        return "New personal record: best session volume";
      default:
        return "New personal record";
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Render PR badge
  const renderPRBadge = (
    isWeightPR: boolean,
    isRepsPR: boolean,
    isE1rmPR: boolean
  ) => {
    const badges = [];

    if (isWeightPR) {
      const label = getPRLabel(true, "weight");
      badges.push(
        <span
          key="weight"
          className="badge"
          style={{
            backgroundColor: "var(--customize-bg)",
            color: "var(--customize)",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
            marginLeft: "4px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          aria-label={label || "PR"}
        >
          ★ PR
        </span>
      );
    }

    if (isRepsPR) {
      const label = getPRLabel(true, "reps");
      badges.push(
        <span
          key="reps"
          className="badge"
          style={{
            backgroundColor: "var(--customize-bg)",
            color: "var(--customize)",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
            marginLeft: "4px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          aria-label={label || "PR"}
        >
          ★ PR
        </span>
      );
    }

    if (isE1rmPR) {
      const label = getPRLabel(true, "e1rm");
      badges.push(
        <span
          key="e1rm"
          className="badge"
          style={{
            backgroundColor: "var(--customize-bg)",
            color: "var(--customize)",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
            marginLeft: "4px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          aria-label={label || "PR"}
        >
          ★ PR
        </span>
      );
    }

    return badges;
  };

  const renderVolumePRBadge = (isVolumePR: boolean) => {
    if (!isVolumePR) return null;
    const label = getPRLabel(true, "volume");
    return (
      <span
        className="badge"
        style={{
          backgroundColor: "var(--customize-bg)",
          color: "var(--customize)",
          padding: "2px 6px",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: "bold",
          marginLeft: "4px",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
        }}
        aria-label={label || "PR"}
      >
        ★ PR
      </span>
    );
  };

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: "8px", fontSize: "28px" }}>{data.exercise_name}</h1>

      {/* Personal Records Card */}
      {data.personal_records &&
      (data.personal_records.heaviest_weight !== null ||
        data.personal_records.best_estimated_1rm !== null ||
        data.personal_records.best_volume !== null ||
        data.personal_records.most_reps !== null) ? (
        <div className="card" style={{ marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Personal Records</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {data.personal_records.heaviest_weight !== null && (
              <div style={{ textAlign: "center", padding: "12px", borderRadius: "16px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>
                  Heaviest Weight
                </p>
                <p style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px 0", color: "var(--accent)" }}>
                  {data.personal_records.heaviest_weight} lbs
                </p>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0" }}>
                  {formatDate(data.personal_records.heaviest_weight_date!)}
                </p>
              </div>
            )}

            {data.personal_records.best_estimated_1rm !== null && (
              <div style={{ textAlign: "center", padding: "12px", borderRadius: "16px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>
                  Best Est. 1RM
                </p>
                <p style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px 0", color: "var(--accent)" }}>
                  {data.personal_records.best_estimated_1rm} lbs
                </p>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0" }}>
                  {formatDate(data.personal_records.best_estimated_1rm_date!)}
                </p>
              </div>
            )}

            {data.personal_records.best_volume !== null && (
              <div style={{ textAlign: "center", padding: "12px", borderRadius: "16px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>
                  Best Volume
                </p>
                <p style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px 0", color: "var(--accent)" }}>
                  {data.personal_records.best_volume} lbs
                </p>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0" }}>
                  {formatDate(data.personal_records.best_volume_date!)}
                </p>
              </div>
            )}

            {data.personal_records.most_reps !== null && (
              <div style={{ textAlign: "center", padding: "12px", borderRadius: "16px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>
                  Most Reps
                </p>
                <p style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px 0", color: "var(--accent)" }}>
                  {data.personal_records.most_reps}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text)", margin: "0" }}>
                  {formatDate(data.personal_records.most_reps_date!)}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Metric Selector */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "8px" }}>
        {(["est_1rm", "volume", "best_weight"] as const).map((metric) => (
          <button
            key={metric}
            onClick={() => setSelectedMetric(metric)}
            className="btn"
            style={{
              backgroundColor: selectedMetric === metric ? "var(--accent)" : "var(--border)",
              color: selectedMetric === metric ? "var(--surface)" : "var(--text-h)",
              fontWeight: selectedMetric === metric ? "bold" : "normal",
            }}
          >
            {metric === "est_1rm" && "Est. 1RM"}
            {metric === "volume" && "Volume"}
            {metric === "best_weight" && "Best Weight"}
          </button>
        ))}
      </div>

      {/* Trend Chart */}
      <TrendChart
        data={chartData}
        label={getChartLabel()}
        color="var(--accent)"
        exerciseName={data.exercise_name}
      />

      {/* Session List */}
      <div style={{ marginTop: "32px" }}>
        <h3 style={{ marginBottom: "16px" }}>Session History</h3>

        {data.sessions.length === 0 ? (
          <div className="empty-state">
            <p>No logged sets yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {[...data.sessions].reverse().map((session) => (
              <div key={session.session_id} className="card">
                {/* Date link and volume */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <Link
                    to={`/workout-history/${session.session_id}`}
                    style={{
                      textDecoration: "none",
                      color: "var(--accent)",
                      fontWeight: "bold",
                    }}
                  >
                    {formatDate(session.date)}
                  </Link>
                  <div style={{ fontSize: "14px" }}>
                    Volume: {session.volume.toFixed(1)} lbs
                    {renderVolumePRBadge(session.is_volume_pr)}
                  </div>
                </div>

                {/* Sets list */}
                <div style={{ display: "grid", gap: "8px" }}>
                  {session.sets.map((set) => (
                    <div
                      key={`${session.session_id}-${set.set_number}`}
                      style={{
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        padding: "8px 12px",
                        borderRadius: "16px",
                        fontSize: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: "500" }}>
                            Set {set.set_number}: {set.weight !== null && set.reps !== null ? `${set.weight} × ${set.reps}` : set.weight !== null ? `${set.weight} lbs` : set.reps !== null ? `${set.reps} reps` : "not set"}
                          </span>
                          {renderPRBadge(
                            set.is_weight_pr,
                            set.is_reps_pr,
                            set.is_e1rm_pr
                          )}
                        </div>
                        {set.estimated_1rm !== null && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--text)",
                              textAlign: "right",
                            }}
                          >
                            Est. 1RM: {set.estimated_1rm} lbs
                          </div>
                        )}
                      </div>
                      {set.notes && (
                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--text)",
                            fontStyle: "italic",
                            marginTop: "4px",
                          }}
                        >
                          {set.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Est. 1RM of best set */}
                {(() => {
                  const e1rms = session.sets.map((s) => s.estimated_1rm).filter((e) => e !== null);
                  return e1rms.length > 0 ? (
                    <div
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px solid var(--border)",
                        fontSize: "14px",
                      }}
                    >
                      Best Set Est. 1RM:{" "}
                      <strong>
                        {Math.max(...(e1rms as number[])).toFixed(
                          1
                        )}{" "}
                        lbs
                      </strong>
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
