import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { useAuth } from "./AuthContext";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

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
        // Rate limit hit
        const retryAfter = parseInt(err.response.headers["retry-after"], 10);
        setRateLimitCountdown(retryAfter);
        setIsRateLimited(true);
        setError(null);
      } else {
        setError(
          err.response?.data?.error || "Login failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      <h1>Login</h1>

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
          Your username and password are already filled in — just tap <strong>Login</strong> to continue.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="username" style={{ display: "block", marginBottom: "5px" }}>
            Username:
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username"
            required
            className="input-field"
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "5px" }}>
            Password:
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
            className="input-field"
          />
        </div>

        {isRateLimited && rateLimitCountdown !== null && (
          <div style={{
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '15px',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            Too many attempts — try again in {formatCountdown(rateLimitCountdown)}
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
                color: '#721c24',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 0 0 12px',
                flex: '0 0 auto'
              }}
              aria-label="Dismiss error"
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
          {isRateLimited ? `Locked (${formatCountdown(rateLimitCountdown)})` : loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p style={{ marginTop: "15px", textAlign: "center" }}>
        Don't have an account?{" "}
        <Link to="/register" style={{ color: "#007bff", textDecoration: "none" }}>
          Register
        </Link>
      </p>
    </div>
  );
};
