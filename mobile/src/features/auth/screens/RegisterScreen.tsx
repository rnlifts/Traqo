import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ApiError } from "../../../api/client";
import { Button } from "../../../components/Button";
import { TextField } from "../../../components/TextField";
import { colors, spacing } from "../../../theme/theme";
import { authApi } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_REGEX,
} from "../types";
import type { AuthStackScreenProps } from "../../../navigation/types";

type UsernameState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken"; message: string };

export const RegisterScreen: React.FC<AuthStackScreenProps<"Register">> = ({ navigation }) => {
  const { signIn } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>({ status: "idle" });

  // Tracks the latest username we kicked off a check for, so a slow earlier
  // response can't overwrite the state for what the user has since typed.
  const latestChecked = useRef<string>("");

  useEffect(() => {
    const value = username.trim().toLowerCase();

    if (!value) {
      setUsernameState({ status: "idle" });
      return;
    }
    if (!USERNAME_REGEX.test(value)) {
      setUsernameState({
        status: "invalid",
        message: "3–20 chars, start with a letter, lowercase letters/numbers/underscore.",
      });
      return;
    }

    setUsernameState({ status: "checking" });
    latestChecked.current = value;

    const timer = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(value);
        if (latestChecked.current !== value) return;
        if (res.available) {
          setUsernameState({ status: "available" });
        } else {
          setUsernameState({ status: "taken", message: res.reason ?? "That username is taken." });
        }
      } catch {
        if (latestChecked.current !== value) return;
        setUsernameState({ status: "invalid", message: "Couldn't check that username. Try again." });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? `At least ${PASSWORD_MIN_LENGTH} characters.`
      : null;

  const canSubmit =
    displayName.trim().length > 0 &&
    usernameState.status === "available" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    !submitting;

  const handleSubmit = async () => {
    setFormError(null);
    setSubmitting(true);
    const uname = username.trim().toLowerCase();
    try {
      await authApi.register(displayName.trim(), uname, password);
      // Backend register does NOT return a token — log in right after.
      const res = await authApi.login(uname, password);
      await signIn(res.token, res.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.status === 409 ? "That username was just taken. Pick another." : err.detail);
      } else {
        setFormError("Could not reach the server. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const usernameHint =
    usernameState.status === "checking"
      ? "Checking availability…"
      : usernameState.status === "available"
        ? "Username is available"
        : null;
  const usernameFieldError =
    usernameState.status === "invalid" || usernameState.status === "taken"
      ? usernameState.message
      : null;
  const usernameHintColor =
    usernameState.status === "available" ? colors.success : colors.textMuted;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>

        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          placeholder="How your name shows in the app"
        />

        <TextField
          label="Username"
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="lowercase, no spaces"
          error={usernameFieldError}
          hint={usernameHint}
          hintColor={usernameHintColor}
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          error={passwordError}
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <View style={styles.spacer} />
        <Button
          title="Sign up"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />

        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.link}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  spacer: { height: spacing.sm },
  linkRow: { marginTop: spacing.lg, alignItems: "center" },
  linkText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: "600" },
});
