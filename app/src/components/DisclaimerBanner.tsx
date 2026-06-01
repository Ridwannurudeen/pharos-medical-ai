import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, radius, spacing } from "../theme";

/** Always visible in any medical-content view (non-negotiable framing from the brief). */
export function DisclaimerBanner() {
  return (
    <View style={styles.wrap}>
      <Ionicons name="information-circle-outline" size={16} color={colors.inkSoft} />
      <Text style={styles.text}>
        Educational information only, not medical advice. Pharos never diagnoses or doses, and
        never tells you to start or stop a medication. Always confirm with a pharmacist or doctor.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  text: { flex: 1, color: colors.inkSoft, fontSize: font.small, lineHeight: 18 },
});
