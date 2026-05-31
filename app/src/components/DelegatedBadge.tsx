import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, radius } from "../theme";

/** Shown when ScanResult.delegated === true: a larger model on a mesh peer answered. */
export function DelegatedBadge() {
  return (
    <View style={styles.wrap}>
      <Ionicons name="git-network-outline" size={14} color={colors.accent} />
      <Text style={styles.text}>Analyzed by a larger model on a nearby device</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  text: { color: colors.accent, fontSize: font.small, fontWeight: "700" },
});
