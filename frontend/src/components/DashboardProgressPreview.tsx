import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { progressApi, type ExerciseProgressResult } from '../api/progressApi';
import type { RandomExercise } from '../api/dashboardApi';
import { TrendChart, type TrendChartDataPoint } from './TrendChart';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProgressPreviewProps {
  randomExercise: RandomExercise | null;
}

function buildBestWeightSeries(data: ExerciseProgressResult): TrendChartDataPoint[] {
  const points: (TrendChartDataPoint | null)[] = data.sessions.map((session) => {
    const withWeight = session.sets.filter((s) => s.weight !== null);
    if (withWeight.length === 0) return null;
    const best = withWeight.reduce((max, s) => (s.weight! > max.weight! ? s : max));
    return { date: session.date, value: best.weight!, isPR: best.is_weight_pr };
  });
  return points.filter((p): p is TrendChartDataPoint => p !== null);
}

export const DashboardProgressPreview: React.FC<DashboardProgressPreviewProps> = ({
  randomExercise,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [progress, setProgress] = useState<ExerciseProgressResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!randomExercise) return;
    let cancelled = false;
    progressApi
      .getExerciseProgress(randomExercise.exercise_id)
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch((error) => {
        console.error('Failed to load progress preview:', error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [randomExercise]);

  return (
    <div>
      <p className="section-label">{t.progressPreview.title}</p>
      <div className="card" style={{ marginBottom: '24px' }}>
        {!randomExercise ? (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
            {t.progressPreview.noData}
          </p>
        ) : loadFailed ? (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
            {t.progressPreview.loadFailed(randomExercise.exercise_name)}
          </p>
        ) : !progress ? (
          <div className="loading">{t.progressPreview.loading}</div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-h)' }}>
                {randomExercise.exercise_name}
              </h3>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/exercises/${randomExercise.exercise_id}/progress`)}
              >
                {t.progressPreview.viewProgress}
              </button>
            </div>
            <TrendChart
              data={buildBestWeightSeries(progress)}
              label={t.progressPreview.weightLabel}
              exerciseName={randomExercise.exercise_name}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardProgressPreview;
