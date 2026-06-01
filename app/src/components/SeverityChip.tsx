import { StyleSheet, Text, View } from "react-native";

import type { Severity } from "../engine";
import { font, radius, severityStyle } from "../theme";

export function SeverityChip({
  severity,
  size = "md",
}: {
  severity: Severity;
  size?: "sm" | "md";
}) {
  const s = severityStyle[severity];
  const big = size === "md";
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: s.bg,
          paddingVertical: big ? 6 : 3,
          paddingHorizontal: big ? 14 : 10,
        },
      ]}
    >
      <Text style={[styles.label, { color: s.fg, fontSize: big ? font.body : font.tiny }]}>
        {s.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", borderRadius: radius.pill },
  label: { fontWeight: "800", letterSpacing: 0.3 },
});
