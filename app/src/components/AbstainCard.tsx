import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { ScanResult } from "../engine";
import { colors, font, radius, spacing } from "../theme";

/**
 * Shown when ScanResult.abstained === true. The app NEVER fabricates a result; abstaining is a
 * feature. The disclaimer + "see a professional" path must never be bypassed.
 */
export function AbstainCard({
  reason,
  rawText,
}: {
  reason?: ScanResult["abstainReason"];
  rawText?: string;
}) {
  const msg =
    reason === "unresolved_drug"
      ? "I couldn't read or identify the drug on this label clearly enough to check it."
      : "I read the label, but this drug isn't in the documented interaction set I can verify against.";
  return (
    <View style={styles.card}>
      <Ionicons name="help-circle-outline" size={36} color={colors.inkSoft} />
      <Text style={styles.title}>I can't verify this one</Text>
      <Text style={styles.body}>{msg}</Text>
      <Text style={styles.advice}>
        Please don't guess from this. Check with a pharmacist before combining medications.
      </Text>
      {rawText ? <Text style={styles.raw}>Read as: “{rawText}”</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  title: { color: colors.ink, fontSize: font.h2, fontWeight: "800", marginTop: spacing.xs },
  body: { color: colors.inkSoft, fontSize: font.body, lineHeight: 22, textAlign: "center" },
  advice: { color: colors.ink, fontSize: font.body, fontWeight: "700", lineHeight: 22, textAlign: "center", marginTop: spacing.xs },
  raw: { color: colors.inkFaint, fontSize: font.small, fontStyle: "italic", marginTop: spacing.sm },
});
