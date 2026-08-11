import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return <div className="loading">{t.sharing.loading}</div>;
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h1>{t.home.tagline}</h1>
      <p style={{ fontSize: '18px', marginBottom: '30px' }}>
        {t.home.subtitle}
      </p>

      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          to="/register"
          className="btn btn-primary"
          style={{ padding: '12px 30px', fontSize: '16px', display: 'inline-block', textDecoration: 'none' }}
        >
          {t.home.createAccount}
        </Link>
        <Link
          to="/login"
          className="btn btn-success"
          style={{ padding: '12px 30px', fontSize: '16px', display: 'inline-block', textDecoration: 'none' }}
        >
          {t.home.logIn}
        </Link>
      </div>
    </div>
  );
}
