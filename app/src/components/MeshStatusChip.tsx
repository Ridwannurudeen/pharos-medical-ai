import { StyleSheet, Text, View } from "react-native";

import type { MeshStatus } from "../mesh";
import { colors, font, radius } from "../theme";

// Phase 2 surface. Driven by ScanResult.delegated + a core/ status hook the Lead will expose.
// Kept prop-driven and harmless now so the Result screen can already show on-device status.
const LABEL: Record<MeshStatus, string> = {
  "on-device": "On-device",
  delegating: "Delegating to anchor",
  "fell-back": "Fell back to on-device",
};

const DOT_COLOR: Record<MeshStatus, string> = {
  "on-device": colors.inkFaint,
  delegating: colors.accent,
  "fell-back": colors.danger,
};

export function MeshStatusChip({ status = "on-device" }: { status?: MeshStatus }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: DOT_COLOR[status] }]} />
      <Text style={styles.text}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, maxWidth: 150 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  text: { color: colors.inkSoft, flexShrink: 1, fontSize: font.tiny, fontWeight: "700" },
});
