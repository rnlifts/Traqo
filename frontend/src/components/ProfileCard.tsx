import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../api/authApi';
import { roundTo } from '../utils/units';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileCardProps {
  profile: UserProfile;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ profile }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="card" style={{ boxShadow: 'var(--shadow-card)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <p className="section-label" style={{ margin: 0 }}>{t.profileCard.yourProfile}</p>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/profile', { state: { autoEdit: true } })}
        >
          {profile.is_complete ? t.profileCard.edit : t.profileCard.completeProfile}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-h)' }}>{profile.display_name}</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>@{profile.username}</p>
        </div>
      </div>

      {!profile.is_complete ? (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>
          {t.profileCard.completePrompt}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text)' }}>{t.profileCard.age}</span>
            <span style={{ fontWeight: 600 }}>{profile.age} {t.profileCard.years}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text)' }}>{t.profileCard.weight}</span>
            <span style={{ fontWeight: 600 }}>{roundTo(profile.weight_kg!, 1)} kg</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text)' }}>{t.profileCard.height}</span>
            <span style={{ fontWeight: 600 }}>{roundTo(profile.height_cm!, 1)} cm</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text)' }}>{t.profileCard.gender}</span>
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{profile.gender}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
