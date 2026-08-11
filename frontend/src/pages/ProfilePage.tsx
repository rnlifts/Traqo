import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useToast } from '../components/Toast';
import { authApi, type UserProfile } from '../api/authApi';
import { kgToLbs, lbsToKg, cmToFtIn, ftInToCm, roundTo } from '../utils/units';
import { useLanguage } from '../contexts/LanguageContext';

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ftin';

export default function ProfilePage() {
  const location = useLocation();
  const { Toast, showToast } = useToast();
  const { t } = useLanguage();

  const ACTIVITY_LEVELS: { value: string; label: string }[] = [
    { value: 'sedentary', label: t.profilePage.activitySedentary },
    { value: 'light', label: t.profilePage.activityLight },
    { value: 'moderate', label: t.profilePage.activityModerate },
    { value: 'active', label: t.profilePage.activityActive },
    { value: 'very_active', label: t.profilePage.activityVeryActive },
  ];
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weightValue, setWeightValue] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await authApi.getMe();
      setProfile(data);
      populateForm(data);
      if ((location.state as { autoEdit?: boolean } | null)?.autoEdit) {
        setEditing(true);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  function populateForm(data: UserProfile) {
    setAge(data.age !== null ? String(data.age) : '');
    setGender(data.gender || '');
    setActivityLevel(data.activity_level || '');
    if (data.weight_kg !== null) {
      setWeightValue(String(roundTo(data.weight_kg, 1)));
    } else {
      setWeightValue('');
    }
    if (data.height_cm !== null) {
      setHeightCm(String(roundTo(data.height_cm, 1)));
      const { feet, inches } = cmToFtIn(data.height_cm);
      setHeightFeet(String(feet));
      setHeightInches(String(inches));
    } else {
      setHeightCm('');
      setHeightFeet('');
      setHeightInches('');
    }
  }

  function startEditing() {
    if (profile) populateForm(profile);
    setEditing(true);
  }

  async function handleSave() {
    const weightNum = weightValue.trim() === '' ? null : parseFloat(weightValue);
    const weightKg =
      weightNum === null ? null : weightUnit === 'lbs' ? lbsToKg(weightNum) : weightNum;

    let heightCmValue: number | null;
    if (heightUnit === 'cm') {
      heightCmValue = heightCm.trim() === '' ? null : parseFloat(heightCm);
    } else {
      const feetNum = heightFeet.trim() === '' ? 0 : parseFloat(heightFeet);
      const inchesNum = heightInches.trim() === '' ? 0 : parseFloat(heightInches);
      heightCmValue = heightFeet.trim() === '' && heightInches.trim() === '' ? null : ftInToCm(feetNum, inchesNum);
    }

    const ageNum = age.trim() === '' ? null : parseInt(age, 10);

    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        age: ageNum,
        weight_kg: weightKg !== null ? roundTo(weightKg, 2) : null,
        height_cm: heightCmValue !== null ? roundTo(heightCmValue, 2) : null,
        gender: gender || null,
        activity_level: activityLevel || null,
      });
      setProfile(updated);
      populateForm(updated);
      setEditing(false);
      showToast(t.profilePage.profileUpdated, 'success');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || (err as Error).message || t.profilePage.updateFailed;
      showToast(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="page-container">
          <div className="loading">{t.profilePage.loadingProfile}</div>
        </div>
      </Layout>
    );
  }

  if (loadError || !profile) {
    return (
      <Layout>
        <div className="page-container">
          <div className="card" style={{ textAlign: 'center' }}>
            <h1 className="page-title" style={{ marginBottom: '12px' }}>{t.common2.somethingWentWrong}</h1>
            <p style={{ color: 'var(--text)' }}>{t.profilePage.loadProfileFailed}</p>
            <button className="btn btn-primary" onClick={loadProfile} style={{ marginTop: '12px' }}>
              {t.profilePage.retry}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <div style={{ marginBottom: '24px' }}>
          <p className="kicker">{t.profilePage.kicker}</p>
          <h1 className="page-title">{profile.display_name}</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text)' }}>@{profile.username}</p>
        </div>

        {!editing ? (
          <>
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-h)' }}>{t.profilePage.personalInfo}</h3>
                <button className="btn btn-secondary" onClick={startEditing}>
                  {profile.is_complete ? t.profileCard.edit : t.profileCard.completeProfile}
                </button>
              </div>
              {!profile.is_complete ? (
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                  {t.profilePage.completePrompt}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--text)' }}>{t.profileCard.age}</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>{profile.age} {t.profileCard.years}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--text)' }}>{t.profileCard.weight}</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>{roundTo(profile.weight_kg!, 1)} kg</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--text)' }}>{t.profileCard.height}</p>
                    <p style={{ margin: 0, fontWeight: 600 }}>{roundTo(profile.height_cm!, 1)} cm</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--text)' }}>{t.profileCard.gender}</p>
                    <p style={{ margin: 0, fontWeight: 600, textTransform: 'capitalize' }}>{profile.gender}</p>
                  </div>
                </div>
              )}
            </div>

            {profile.body_metrics && (
              <div className="card" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-h)' }}>{t.bodyStats.title}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--text)' }}>{t.bodyStats.bmi}</p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>{profile.body_metrics.bmi}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--text)' }}>{t.bodyStats.bmr}</p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>{profile.body_metrics.bmr}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: 'var(--text)' }}>{t.profilePage.maintenanceCalories}</p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>{profile.body_metrics.maintenance_calories} {t.bodyStats.kcal}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-h)' }}>{t.profilePage.editProfile}</h3>

            <div className="field-group" style={{ marginBottom: '16px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label htmlFor="profile-age" style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>{t.profileCard.age}</label>
              <input
                id="profile-age"
                type="number"
                className="input-field"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={1}
                max={120}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="profile-weight" style={{ fontSize: '13px', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>{t.profileCard.weight}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="profile-weight"
                  type="number"
                  className="input-field"
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  aria-label={t.profilePage.weightUnitAria}
                  className="input-field"
                  value={weightUnit}
                  onChange={(e) => {
                    const newUnit = e.target.value as WeightUnit;
                    const current = parseFloat(weightValue);
                    if (!isNaN(current)) {
                      const converted =
                        newUnit === 'lbs' && weightUnit === 'kg'
                          ? kgToLbs(current)
                          : newUnit === 'kg' && weightUnit === 'lbs'
                          ? lbsToKg(current)
                          : current;
                      setWeightValue(String(roundTo(converted, 1)));
                    }
                    setWeightUnit(newUnit);
                  }}
                  style={{ width: '90px' }}
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="profile-height" style={{ fontSize: '13px', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>{t.profileCard.height}</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {heightUnit === 'cm' ? (
                  <input
                    id="profile-height"
                    type="number"
                    className="input-field"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    style={{ flex: 1, minWidth: '100px' }}
                  />
                ) : (
                  <>
                    <input
                      id="profile-height"
                      type="number"
                      className="input-field"
                      placeholder="ft"
                      aria-label={t.profilePage.heightFeetAria}
                      value={heightFeet}
                      onChange={(e) => setHeightFeet(e.target.value)}
                      style={{ width: '70px' }}
                    />
                    <input
                      type="number"
                      className="input-field"
                      placeholder="in"
                      aria-label={t.profilePage.heightInchesAria}
                      value={heightInches}
                      onChange={(e) => setHeightInches(e.target.value)}
                      style={{ width: '70px' }}
                    />
                  </>
                )}
                <select
                  aria-label={t.profilePage.heightUnitAria}
                  className="input-field"
                  value={heightUnit}
                  onChange={(e) => {
                    const newUnit = e.target.value as HeightUnit;
                    if (newUnit === 'ftin' && heightUnit === 'cm') {
                      const cm = parseFloat(heightCm);
                      if (!isNaN(cm)) {
                        const { feet, inches } = cmToFtIn(cm);
                        setHeightFeet(String(feet));
                        setHeightInches(String(inches));
                      }
                    } else if (newUnit === 'cm' && heightUnit === 'ftin') {
                      const feet = parseFloat(heightFeet) || 0;
                      const inches = parseFloat(heightInches) || 0;
                      if (heightFeet.trim() !== '' || heightInches.trim() !== '') {
                        setHeightCm(String(roundTo(ftInToCm(feet, inches), 1)));
                      }
                    }
                    setHeightUnit(newUnit);
                  }}
                  style={{ width: '90px' }}
                >
                  <option value="cm">cm</option>
                  <option value="ftin">ft/in</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="profile-gender" style={{ fontSize: '13px', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>{t.profilePage.genderLabel}</label>
              <select id="profile-gender" className="input-field" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">{t.profilePage.selectPlaceholder}</option>
                <option value="male">{t.profilePage.male}</option>
                <option value="female">{t.profilePage.female}</option>
                <option value="other">{t.profilePage.other}</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="profile-activity-level" style={{ fontSize: '13px', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
                {t.profilePage.activityLevelLabel}
              </label>
              <select id="profile-activity-level" className="input-field" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
                <option value="">{t.profilePage.selectPlaceholder}</option>
                {ACTIVITY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                {saving ? t.planBuilder.saving : t.planBuilder.save}
              </button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                {t.planBuilder.cancel}
              </button>
            </div>
          </div>
        )}
        {Toast}
      </div>
    </Layout>
  );
}
