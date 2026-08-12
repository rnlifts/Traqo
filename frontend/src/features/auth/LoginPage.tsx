import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { useAuth } from "./AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { LanguageToggle } from "../../components/LanguageToggle";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState(
    (location.state as any)?.username || ""
  );
  const [password, setPassword] = useState(
    (location.state as any)?.password || ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    (location.state as any)?.message || null
  );
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null) return null;
        const next = prev - 1;
        if (next <= 0) {
          setIsRateLimited(false);
          return null;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  const formatCountdown = (seconds: number | null): string => {
    if (seconds === null) return "";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await authApi.login(username, password);
      // Store token and user in auth context
      login(response.token, response.user);
      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err: any) {
      if (err.response?.status === 429) {
        // Rate limit / account lockout hit. Fall back to a sane default if the
        // server ever omits Retry-After, rather than showing "NaN:NaN".
        const parsed = parseInt(err.response.headers["retry-after"], 10);
        const retryAfter = Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60;
        setRateLimitCountdown(retryAfter);
        setIsRateLimited(true);
        setError(null);
      } else {
        setError(err.response?.data?.error || t.login.genericError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <LanguageToggle />
      </div>
      <h1>{t.login.title}</h1>

      {message && (
        <div style={{
          backgroundColor: 'var(--success-soft)',
          border: '1px solid var(--success)',
          color: 'var(--success)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {t.login.prefilledBefore}<strong>{t.login.submit}</strong>{t.login.prefilledAfter}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="username" style={{ display: "block", marginBottom: "5px" }}>
            {t.login.usernameLabel}
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.login.usernamePlaceholder}
            required
            className="input-field"
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "5px" }}>
            {t.login.passwordLabel}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.login.passwordPlaceholder}
            required
            className="input-field"
          />
        </div>

        {isRateLimited && rateLimitCountdown !== null && (
          <div style={{
            backgroundColor: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '15px',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {t.login.tooManyAttempts(formatCountdown(rateLimitCountdown))}
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="error-message">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 0 0 12px',
                flex: '0 0 auto'
              }}
              aria-label={t.login.dismissError}
            >
              ×
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isRateLimited}
          className="btn btn-primary"
          style={{
            width: "100%",
            opacity: loading || isRateLimited ? 0.6 : 1,
            cursor: loading || isRateLimited ? 'not-allowed' : 'pointer',
          }}
        >
          {isRateLimited ? t.login.locked(formatCountdown(rateLimitCountdown)) : loading ? t.login.loggingIn : t.login.submit}
        </button>
      </form>

      <p style={{ marginTop: "15px", textAlign: "center" }}>
        {t.login.noAccount}
        <Link to="/register" style={{ color: "var(--accent)", textDecoration: "none" }}>
          {t.login.registerLink}
        </Link>
      </p>
    </div>
  );
};
