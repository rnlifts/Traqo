import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { DayActivity } from '../api/dashboardApi';
import { useLanguage } from '../contexts/LanguageContext';

interface WeeklyActivityCalendarProps {
  days: DayActivity[];
}

export const WeeklyActivityCalendar: React.FC<WeeklyActivityCalendarProps> = ({ days }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div>
      <p className="section-label">{t.weeklyActivity.title}</p>
      <div
        className="card"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          marginBottom: '24px',
        }}
      >
        {days.map((day) => (
          <div
            key={day.date}
            style={{
              flex: '1 0 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 600 }}>
              {day.day_label}
            </span>
            {day.has_workout ? (
              <button
                onClick={() => day.session_id && navigate(`/workout-history/${day.session_id}`)}
                aria-label={t.weeklyActivity.viewWorkoutFrom(day.day_label)}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ) : (
              <span style={{ fontSize: '14px', color: 'var(--placeholder)' }}>—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyActivityCalendar;
