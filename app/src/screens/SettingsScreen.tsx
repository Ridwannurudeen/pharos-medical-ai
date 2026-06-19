import { Ionicons } from "@expo/vector-icons";
import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { colors, font, radius, spacing } from "../theme";

export function SettingsScreen() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    Network.getNetworkStateAsync()
      .then((s) => setOnline(!!s.isConnected))
      .catch(() => setOnline(null));
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>About Pharos</Text>
        <Text style={styles.lede}>
          A phone reads a medication label, explains it in plain language, and flags documented
          interactions with what is on your shelf — fully on-device.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.cardTitle}>Warning tool, not a green light</Text>
          </View>
          <Text style={styles.cardBody}>
            Pharos shows documented interaction warnings when it can verify them in DDInter. If it
            finds no match or abstains, that does not mean a medicine is safe for you.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons
              name={online ? "cloud-outline" : "airplane-outline"}
              size={18}
              color={online ? colors.inkSoft : colors.accent}
            />
            <Text style={styles.cardTitle}>Offline</Text>
          </View>
          <Text style={styles.cardBody}>
            {online === null
              ? "Network state unknown. Pharos runs entirely on-device either way."
              : online
                ? "Network is on, but Pharos makes no network calls. Turn on airplane mode and everything still works."
                : "Network is off. Pharos is working fully on-device — this is the intended mode."}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="git-network-outline" size={18} color={colors.inkSoft} />
            <Text style={styles.cardTitle}>Works alone, stronger together</Text>
          </View>
          <Text style={styles.cardBody}>
            The validated path runs OCR, DDInter lookup, and MedPsy locally on the phone. When a
            configured QVAC anchor is nearby, the phone can keep the scan private while delegating
            the heavier explanation to the larger model.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="library-outline" size={18} color={colors.inkSoft} />
            <Text style={styles.cardTitle}>Data sources</Text>
          </View>
          <Text style={styles.cardBody}>
            Interaction grades come from <Text style={styles.bold}>DDInter 2.0</Text> (CC BY-NC). Each
            flagged interaction cites its DDInter ids. DDInter records a severity grade, not a
            mechanism or management text; the plain-language context is generated on-device and is
            labeled as such.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.inkSoft} />
            <Text style={styles.cardTitle}>Your data</Text>
          </View>
          <Text style={styles.cardBody}>
            Your medication shelf is stored encrypted in the device keystore and never leaves the
            phone. No accounts, no analytics, no network.
          </Text>
        </View>

        <DisclaimerBanner />
        <Text style={styles.version}>Pharos · Lane B prototype</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  h1: { fontSize: font.h1, fontWeight: "900", color: colors.ink, letterSpacing: -0.5 },
  lede: { color: colors.inkSoft, fontSize: font.body, lineHeight: 23 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardTitle: { color: colors.ink, fontSize: font.h3, fontWeight: "800" },
  cardBody: { color: colors.inkSoft, fontSize: font.small, lineHeight: 20 },
  bold: { color: colors.ink, fontWeight: "800" },
  version: { color: colors.inkFaint, fontSize: font.tiny, textAlign: "center", marginTop: spacing.sm },
});
