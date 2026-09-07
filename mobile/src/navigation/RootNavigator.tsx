import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { colors } from "../theme/theme";
import { useAuth } from "../features/auth/context/AuthContext";
import { HomeScreen } from "../features/home/screens/HomeScreen";
import { AuthStack } from "./AuthStack";

export const RootNavigator: React.FC = () => {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status === "authenticated" ? <HomeScreen /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
