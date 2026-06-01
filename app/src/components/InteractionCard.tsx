import { StyleSheet, Text, View } from "react-native";

import type { Interaction } from "../engine";
import { colors, font, radius, severityStyle, spacing } from "../theme";
import { SeverityChip } from "./SeverityChip";

/**
 * The CITED FACT block. Everything here is a retrieved DDInter field (drug pair, severity,
 * source, ids). The model's plain-language text lives in a separate section on the Result
 * screen and must never be mixed into this card — grounding discipline from core/types.ts.
 */
export function InteractionCard({ ix }: { ix: Interaction }) {
  const accent = severityStyle[ix.severity].fg;
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.row}>
        <Text style={styles.pair}>
          {ix.drugA} <Text style={styles.x}>×</Text> {ix.drugB}
        </Text>
        <SeverityChip severity={ix.severity} />
      </View>
      <Text style={styles.caution}>{severityStyle[ix.severity].caution}</Text>
      <View style={styles.cite}>
        <Text style={styles.citeLabel}>Source</Text>
        <Text style={styles.citeVal}>{ix.source}</Text>
        <Text style={styles.ids}>
          {ix.ddinterIdA} · {ix.ddinterIdB}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  pair: { flex: 1, color: colors.ink, fontSize: font.h3, fontWeight: "800" },
  x: { color: colors.inkFaint, fontWeight: "600" },
  caution: { color: colors.inkSoft, fontSize: font.small, lineHeight: 18 },
  cite: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopColor: colors.line,
    borderTopWidth: 1,
  },
  citeLabel: {
    color: colors.inkFaint,
    fontSize: font.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  citeVal: { color: colors.ink, fontSize: font.small, fontWeight: "700" },
  ids: { color: colors.inkFaint, fontSize: font.tiny, marginLeft: "auto", fontVariant: ["tabular-nums"] },
});
