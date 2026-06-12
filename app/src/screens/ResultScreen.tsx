import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AbstainCard } from "../components/AbstainCard";
import { DelegatedBadge } from "../components/DelegatedBadge";
import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { InteractionCard } from "../components/InteractionCard";
import { MeshStatusChip } from "../components/MeshStatusChip";
import { StreamingText } from "../components/StreamingText";
import type { ResultNotice } from "../mesh";
import type { ScanStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<ScanStackParamList, "Result">;

const NOTICE_COPY: Record<
  ResultNotice,
  {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    body: string;
  }
> = {
  fallback: {
    icon: "swap-horizontal-outline",
    title: "Fallback used",
    body: "The nearby anchor was unavailable, so this answer was completed on this device.",
  },
  "no-peer": {
    icon: "radio-outline",
    title: "No nearby anchor",
    body: "No mesh peer was available for this demo case. The scan still completed locally.",
  },
  "ocr-fail": {
    icon: "scan-outline",
    title: "OCR could not read enough text",
    body: "The label was not readable enough to identify a drug, so Pharos abstained instead of guessing.",
  },
  "low-confidence": {
    icon: "alert-circle-outline",
    title: "Low-confidence label",
    body: "The scan produced partial text, but not enough to verify a drug against the documented interaction set.",
  },
};

function NoticeCard({ notice }: { notice: ResultNotice }) {
  const copy = NOTICE_COPY[notice];
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Ionicons name={copy.icon} size={18} color={colors.danger} />
      <View style={styles.noticeText}>
        <Text style={styles.noticeTitle}>{copy.title}</Text>
        <Text style={styles.noticeBody}>{copy.body}</Text>
      </View>
    </View>
  );
}

export function ResultScreen({ route }: Props) {
  const { meshStatus, notice, result } = route.params;
  const status = meshStatus ?? (result.delegated ? "delegating" : "on-device");
  const title = result.scan.generic ?? result.scan.rawText;
  const showLabel =
    !!result.scan.generic && result.scan.rawText !== result.scan.generic;
  const location =
    status === "delegating"
      ? "via a nearby device"
      : status === "fell-back"
        ? "after fallback to this device"
        : "on this device";

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Scanned</Text>
            <Text style={styles.title}>{title}</Text>
            {showLabel ? <Text style={styles.raw}>label: “{result.scan.rawText}”</Text> : null}
          </View>
          <MeshStatusChip status={status} />
        </View>

        {result.delegated ? <DelegatedBadge /> : null}
        {notice ? <NoticeCard notice={notice} /> : null}

        {result.abstained ? (
          <AbstainCard reason={result.abstainReason} rawText={result.scan.rawText} />
        ) : result.interactions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Documented interactions vs your shelf</Text>
            {result.interactions.map((ix, i) => (
              <InteractionCard key={`${ix.ddinterIdA}-${ix.ddinterIdB}-${i}`} ix={ix} />
            ))}
          </View>
        ) : (
          <View style={styles.noneCard}>
            <Text style={styles.noneTitle}>No documented interaction found</Text>
            <Text style={styles.noneBody}>
              Nothing documented between this medication and your shelf in DDInter. This is not a
              guarantee of safety — keep your shelf current and check with a professional.
            </Text>
          </View>
        )}

        {!result.abstained && result.explanation ? (
          <View style={styles.explain}>
            <Text style={styles.explainLabel}>In plain language</Text>
            <StreamingText text={result.explanation} style={styles.explainText} />
            <Text style={styles.explainNote}>
              Plain-language context from the on-device model. Background only, not a DDInter field.
            </Text>
          </View>
        ) : null}

        <Text style={styles.latency}>
          Answered in {(result.latencyMs / 1000).toFixed(1)}s · {location}
        </Text>

        <DisclaimerBanner />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  headerText: { flex: 1 },
  kicker: { color: colors.inkFaint, fontSize: font.tiny, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  title: { color: colors.ink, fontSize: font.h1, fontWeight: "900", letterSpacing: -0.5, textTransform: "capitalize" },
  raw: { color: colors.inkFaint, fontSize: font.small, fontStyle: "italic", marginTop: 2 },
  notice: {
    alignItems: "flex-start",
    backgroundColor: colors.warnBg,
    borderColor: "#F0C9BD",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticeText: { flex: 1, gap: 2 },
  noticeTitle: { color: colors.danger, fontSize: font.small, fontWeight: "800" },
  noticeBody: { color: colors.inkSoft, fontSize: font.small, lineHeight: 19 },
  section: { gap: spacing.md },
  sectionLabel: { color: colors.inkSoft, fontSize: font.small, fontWeight: "700" },
  noneCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noneTitle: { color: colors.accent, fontSize: font.h3, fontWeight: "800" },
  noneBody: { color: colors.inkSoft, fontSize: font.small, lineHeight: 19 },
  explain: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  explainLabel: { color: colors.inkFaint, fontSize: font.tiny, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  explainText: { color: colors.ink, fontSize: font.body, lineHeight: 23 },
  explainNote: { color: colors.inkFaint, fontSize: font.tiny, fontStyle: "italic" },
  latency: { color: colors.inkFaint, fontSize: font.small, textAlign: "center" },
});
