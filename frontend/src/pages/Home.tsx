import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h1>Traqo - Fitness Tracker</h1>
      <p style={{ fontSize: '18px', marginBottom: '30px' }}>
        Track your workouts, build your strength, achieve your goals.
      </p>

      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          to="/register"
          className="btn btn-primary"
          style={{ padding: '12px 30px', fontSize: '16px', display: 'inline-block', textDecoration: 'none' }}
        >
          Create Account
        </Link>
        <Link
          to="/login"
          className="btn btn-success"
          style={{ padding: '12px 30px', fontSize: '16px', display: 'inline-block', textDecoration: 'none' }}
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
