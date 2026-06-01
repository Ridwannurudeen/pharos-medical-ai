import { StyleSheet, Text, View } from "react-native";

import { colors, font, radius } from "../theme";

// Phase 2 surface. Driven by ScanResult.delegated + a core/ status hook the Lead will expose.
// Kept prop-driven and harmless now so the Result screen can already show on-device status.
export type MeshStatus = "on-device" | "delegating" | "fell-back";

const LABEL: Record<MeshStatus, string> = {
  "on-device": "On-device",
  delegating: "Delegating to anchor",
  "fell-back": "Fell back to on-device",
};

export function MeshStatusChip({ status = "on-device" }: { status?: MeshStatus }) {
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.dot,
          { backgroundColor: status === "delegating" ? colors.accent : colors.inkFaint },
        ]}
      />
      <Text style={styles.text}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  text: { color: colors.inkSoft, fontSize: font.tiny, fontWeight: "700" },
});
