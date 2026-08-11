import { useLanguage } from '../contexts/LanguageContext';
import './LanguageToggle.css';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const isNepali = language === 'ne';

  return (
    <button
      type="button"
      className="language-toggle"
      onClick={() => setLanguage(isNepali ? 'en' : 'ne')}
      aria-label={t.nav.language}
      title={t.nav.language}
    >
      <span className="language-toggle-icon" aria-hidden="true">
        🌐
      </span>
      <span className="language-toggle-label">{isNepali ? 'नेपाली' : 'EN'}</span>
    </button>
  );
}

export default LanguageToggle;
