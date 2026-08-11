import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Layout } from "../components/Layout";
import { DashboardHero } from "../components/DashboardHero";
import { WeeklyStatsTiles } from "../components/WeeklyStatsTiles";
import { WeeklyActivityCalendar } from "../components/WeeklyActivityCalendar";
import { DashboardProgressPreview } from "../components/DashboardProgressPreview";
import { ProfileCard } from "../components/ProfileCard";
import { BodyStatsCard } from "../components/BodyStatsCard";
import { ThemeToggle } from "../components/ThemeToggle";
import type { WorkoutHistoryEntry, WorkoutSession, LastActivePlan } from "../api/workoutSessionsApi";
import { workoutSessionsApi } from "../api/workoutSessionsApi";
import { dashboardApi, type DashboardSummary } from "../api/dashboardApi";
import { authApi, type UserProfile } from "../api/authApi";

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [unresolvedSession, setUnresolvedSession] = useState<WorkoutSession | null>(null);
  const [lastActivePlan, setLastActivePlan] = useState<LastActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyData, sessionData, lastActivePlanData] = await Promise.all([
          workoutSessionsApi.getWorkoutHistory(),
          workoutSessionsApi.getUnresolvedSession(),
          workoutSessionsApi.getLastActivePlan(),
        ]);
        setRecentWorkouts(historyData.slice(0, 3));
        setUnresolvedSession(sessionData);
        setLastActivePlan(lastActivePlanData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    // Fetched independently of the block above: a failure here (or slowness) must
    // never block the hero card / recent workouts from rendering, and vice versa.
    const fetchSummary = async () => {
      try {
        const data = await dashboardApi.getSummary();
        setSummary(data);
      } catch (error) {
        console.error("Failed to load dashboard summary:", error);
      }
    };

    // Also independent: the desktop sidebar profile widgets shouldn't block or be
    // blocked by anything else on the page.
    const fetchProfile = async () => {
      try {
        const data = await authApi.getMe();
        setProfile(data);
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    };

    fetchData();
    fetchSummary();
    fetchProfile();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " +
      date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    );
  };

  return (
    <Layout>
      <div className="page-container">
        <div style={{ marginBottom: '24px' }}>
          <p className="kicker">{t.dashboard.welcomeBack}</p>
          <h1 className="page-title">{currentUser?.display_name}</h1>
        </div>

        <div className="dashboard-layout">
          <div className="dashboard-main">
            {!loading && (
              <DashboardHero
                unresolvedSession={unresolvedSession}
                lastActivePlan={lastActivePlan}
                onUnresolvedSessionChange={setUnresolvedSession}
              />
            )}

            {summary && (
              <>
                <WeeklyStatsTiles stats={summary.weekly_stats} />
                <WeeklyActivityCalendar days={summary.weekly_activity} />
                <DashboardProgressPreview randomExercise={summary.random_exercise} />
              </>
            )}
          </div>

          <div className="dashboard-sidebar">
            <div className="dashboard-sidebar-toolbar">
              <ThemeToggle />
            </div>

            {profile && (
              <div className="dashboard-profile-widgets">
                <ProfileCard profile={profile} />
                {profile.body_metrics && <BodyStatsCard bodyMetrics={profile.body_metrics} />}
              </div>
            )}

            <p className="section-label">{t.dashboard.recentWorkouts}</p>
            {loading ? (
              <div className="loading">{t.dashboard.loadingHistory}</div>
            ) : recentWorkouts.length > 0 ? (
              <div className="history-list">
                {recentWorkouts.map((workout, idx) => (
                  <div
                    key={idx}
                    className="history-row"
                    onClick={() => workout.session_id && navigate(`/workout-history/${workout.session_id}`)}
                  >
                    <div className="h-left">
                      <strong>{workout.workout}</strong>
                      <div className="h-date">{formatDate(workout.date)}</div>
                    </div>
                    <div className="h-stat">{workout.duration}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-note">{t.dashboard.noWorkouts}</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
