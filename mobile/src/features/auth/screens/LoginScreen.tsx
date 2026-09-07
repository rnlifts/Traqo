import React, { useState } from "react";
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
import type { AuthStackScreenProps } from "../../../navigation/types";

export const LoginScreen: React.FC<AuthStackScreenProps<"Login">> = ({ navigation }) => {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.login(username.trim().toLowerCase(), password);
      await signIn(res.token, res.user);
      // No navigation call — RootNavigator swaps to the app stack on auth state change.
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError("Could not reach the server. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Log in to Traqo</Text>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />
        <Button title="Log in" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.linkText}>
            Don&apos;t have an account? <Text style={styles.link}>Sign up</Text>
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
  linkRow: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  linkText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: "600" },
});
