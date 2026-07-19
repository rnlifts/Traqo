import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../../api/authApi";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.register(displayName, password);
      // Redirect to login on success
      navigate("/login", {
        state: { message: "Registration successful! Please log in." },
      });
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="displayName" style={{ display: "block", marginBottom: "5px" }}>
            Display Name:
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
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
            placeholder="At least 8 characters"
            required
            minLength={8}
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
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <p style={{ marginTop: "15px", textAlign: "center" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "#007bff", textDecoration: "none" }}>
          Log in
        </Link>
      </p>
    </div>
  );
};
