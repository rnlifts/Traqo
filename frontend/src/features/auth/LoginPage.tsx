import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { useAuth } from "./AuthContext";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    (location.state as any)?.message || null
  );

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
      setError(
        err.response?.data?.error || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      <h1>Login</h1>

      {message && (
        <div style={{
          backgroundColor: "#d4edda",
          border: "1px solid #c3e6cb",
          color: "#155724",
          padding: "12px",
          borderRadius: "4px",
          marginBottom: "15px"
        }}>
          {message}
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
          disabled={loading}
          className="btn btn-primary"
          style={{
            width: "100%",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Logging in..." : "Login"}
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
