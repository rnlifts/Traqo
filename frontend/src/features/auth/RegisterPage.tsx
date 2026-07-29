import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { RegistrationSuccessDialog } from "./RegistrationSuccessDialog";

interface RegistrationResult {
  username: string;
  password: string;
}

interface UsernameValidationError {
  message: string;
}

// Username validation rules (must match backend)
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function validateUsernameFormat(username: string): UsernameValidationError | null {
  const normalized = username.toLowerCase().trim();

  if (!normalized) {
    return null; // Empty is OK for now, just not checked
  }

  if (normalized.length < USERNAME_MIN_LENGTH) {
    return { message: "Must be at least 3 characters" };
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    return { message: "Must be at most 20 characters" };
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    if (!/^[a-z]/.test(normalized)) {
      return { message: "Must start with a letter" };
    }
    return { message: "Only lowercase letters, numbers, and underscores allowed" };
  }

  return null;
}

export const RegisterPage: React.FC = () => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameStatusMessage, setUsernameStatusMessage] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightUsernameRef = useRef<string | null>(null);

  // Handle username input with auto-lowercase
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setUsername(value);
  };

  // Debounced username check
  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle");
      setUsernameStatusMessage(null);
      return;
    }

    // Check format first
    const formatError = validateUsernameFormat(username);
    if (formatError) {
      setUsernameStatus("invalid");
      setUsernameStatusMessage(formatError.message);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    // Set up debounce for availability check
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setUsernameStatus("checking");
    setUsernameStatusMessage("Checking availability…");

    debounceTimerRef.current = setTimeout(async () => {
      inFlightUsernameRef.current = username;

      try {
        const result = await authApi.checkUsernameAvailability(username);

        // Ignore stale responses: if the user has since typed something different, don't update UI
        if (inFlightUsernameRef.current !== username) {
          return;
        }

        if (result.available) {
          setUsernameStatus("available");
          setUsernameStatusMessage("✓ Username available");
        } else {
          setUsernameStatus("taken");
          setUsernameStatusMessage(`✗ ${result.reason || "Username already taken"}`);
        }
      } catch (err: any) {
        if (inFlightUsernameRef.current !== username) {
          return;
        }
        setUsernameStatus("invalid");
        setUsernameStatusMessage("Error checking availability");
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [username]);

  useEffect(() => {
    if (!loading || !statusMessage) return;

    const messages = ["Creating your account…"];
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

    // Validate username availability
    if (usernameStatus !== "available") {
      setError("Please choose an available username");
      return;
    }

    setLoading(true);
    setStatusMessage("Creating your account…");

    const startTime = Date.now();

    try {
      const result = await authApi.register(displayName, username, password);

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
      if (err.response?.status === 409) {
        setError("That username is already taken. Please choose another.");
      } else {
        setError(
          err.response?.data?.error || "Registration failed. Please try again."
        );
      }
    }
  };

  const isFormValid = displayName.trim() && usernameStatus === "available" && password;

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
                Nickname:
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
                required
                className="input-field"
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label htmlFor="username" style={{ display: "block", marginBottom: "5px" }}>
                Username:
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="3-20 characters"
                required
                className="input-field"
              />
              {usernameStatusMessage && (
                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "13px",
                    color:
                      usernameStatus === "available"
                        ? "var(--success)"
                        : usernameStatus === "taken" || usernameStatus === "invalid"
                        ? "var(--danger)"
                        : "var(--text)",
                  }}
                >
                  {usernameStatusMessage}
                </div>
              )}
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
                  type="button"
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
              disabled={!isFormValid || loading}
              className="btn btn-primary"
              style={{
                width: "100%",
                opacity: (!isFormValid || loading) ? 0.6 : 1,
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
