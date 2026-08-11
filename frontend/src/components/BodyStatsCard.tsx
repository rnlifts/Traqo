import React from 'react';
import type { BodyMetrics } from '../api/authApi';
import { useLanguage } from '../contexts/LanguageContext';
import type { TranslationKeys } from '../i18n/en';

interface BodyStatsCardProps {
  bodyMetrics: BodyMetrics;
}

function bmiCategory(bmi: number, t: TranslationKeys['bodyStats']): string {
  if (bmi < 18.5) return t.underweight;
  if (bmi < 25) return t.normal;
  if (bmi < 30) return t.overweight;
  return t.obese;
}

export const BodyStatsCard: React.FC<BodyStatsCardProps> = ({ bodyMetrics }) => {
  const { t } = useLanguage();
  return (
    <div className="card" style={{ boxShadow: 'var(--shadow-card)', marginBottom: '16px' }}>
      <p className="section-label" style={{ marginTop: 0 }}>{t.bodyStats.title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text)' }}>{t.bodyStats.bmi}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>{bodyMetrics.bmi}</strong>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--success-soft)',
                color: 'var(--success)',
                fontWeight: 600,
              }}
            >
              {bmiCategory(bodyMetrics.bmi, t.bodyStats)}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--text)' }}>{t.bodyStats.bmr}</span>
          <strong>{bodyMetrics.bmr} {t.bodyStats.kcal}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--text)' }}>{t.bodyStats.maintenance}</span>
          <strong>{bodyMetrics.maintenance_calories} {t.bodyStats.kcal}</strong>
        </div>
      </div>
    </div>
  );
};

export default BodyStatsCard;
