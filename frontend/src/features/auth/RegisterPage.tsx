import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { RegistrationSuccessDialog } from "./RegistrationSuccessDialog";

interface RegistrationResult {
  username: string;
  password: string;
}

export const RegisterPage: React.FC = () => {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);

  useEffect(() => {
    if (!loading || !statusMessage) return;

    const messages = ["Creating your account…", "Generating your username…"];
    let currentIndex = 0;

    const updateStatus = () => {
      currentIndex = (currentIndex + 1) % messages.length;
      setStatusMessage(messages[currentIndex]);
    };

    const interval = setInterval(updateStatus, 600);
    return () => clearInterval(interval);
  }, [loading, statusMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatusMessage("Creating your account…");

    const startTime = Date.now();

    try {
      const result = await authApi.register(displayName, password);

      const elapsedTime = Date.now() - startTime;
      const minimumDisplayTime = 600;
      const delayNeeded = Math.max(0, minimumDisplayTime - elapsedTime);

      if (delayNeeded > 0) {
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
      }

      setLoading(false);
      setStatusMessage(null);
      setRegistrationResult({
        username: result.username,
        password: password,
      });
      setShowSuccessDialog(true);
    } catch (err: any) {
      setLoading(false);
      setStatusMessage(null);
      setError(
        err.response?.data?.error || "Registration failed. Please try again."
      );
    }
  };

  return (
    <>
      {showSuccessDialog && registrationResult && (
        <RegistrationSuccessDialog
          username={registrationResult.username}
          password={registrationResult.password}
        />
      )}

      <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
        <h1>Register</h1>

        {statusMessage ? (
          <div style={{ textAlign: "center", minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "16px", color: "var(--text)", lineHeight: "1.5" }}>
              {statusMessage}
            </div>
          </div>
        ) : (
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
        )}

        <p style={{ marginTop: "15px", textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#007bff", textDecoration: "none" }}>
            Log in
          </Link>
        </p>
      </div>
    </>
  );
};
