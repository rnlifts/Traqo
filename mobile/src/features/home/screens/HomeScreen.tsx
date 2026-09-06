import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/Button";
import { colors, spacing } from "../../../theme/theme";
import { useAuth } from "../../auth/context/AuthContext";

// Placeholder for the authenticated area — proves the full auth loop works.
// Replaced by the real app navigator in a later feature.
export const HomeScreen: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.hello}>Signed in as</Text>
      <Text style={styles.name}>{user?.display_name}</Text>
      <Text style={styles.username}>@{user?.username}</Text>
      <View style={styles.spacer} />
      <Button title="Log out" onPress={signOut} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  hello: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 24, fontWeight: "700", marginTop: spacing.xs },
  username: { color: colors.textMuted, fontSize: 16, marginTop: spacing.xs },
  spacer: { height: spacing.xl },
});
