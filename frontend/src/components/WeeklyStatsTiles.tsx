import React from 'react';
import type { WeeklyStats } from '../api/dashboardApi';
import { useLanguage } from '../contexts/LanguageContext';

interface WeeklyStatsTilesProps {
  stats: WeeklyStats;
}

function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return String(Math.round(volume));
}

const tileStyle: React.CSSProperties = {
  flex: '1 1 130px',
  minWidth: '130px',
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-card)',
  padding: '16px',
};

const iconBadgeStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
  marginBottom: '10px',
};

export const WeeklyStatsTiles: React.FC<WeeklyStatsTilesProps> = ({ stats }) => {
  const { t } = useLanguage();
  return (
    <div>
      <p className="section-label">{t.weeklyStats.thisWeek}</p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={tileStyle}>
          <div style={{ ...iconBadgeStyle, backgroundColor: 'var(--accent-soft)' }}>🏋️</div>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-h)' }}>
            {stats.workout_count}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>{t.weeklyStats.workouts}</p>
        </div>

        <div style={tileStyle}>
          <div style={{ ...iconBadgeStyle, backgroundColor: 'var(--success-soft)' }}>📊</div>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-h)' }}>
            {formatVolume(stats.total_volume)} kg
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>{t.weeklyStats.volume}</p>
        </div>

        <div style={tileStyle}>
          <div style={{ ...iconBadgeStyle, backgroundColor: 'var(--customize-bg)' }}>🏆</div>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-h)' }}>
            {stats.pr_count}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>{t.weeklyStats.prs}</p>
        </div>
      </div>
    </div>
  );
};

export default WeeklyStatsTiles;
