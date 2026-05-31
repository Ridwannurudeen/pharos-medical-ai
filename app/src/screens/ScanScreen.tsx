import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DisclaimerBanner } from "../components/DisclaimerBanner";
import { __setMockScenario, scanPipeline, type ScenarioName } from "../engine";
import type { ScanStackParamList } from "../navigation/types";
import { useShelf } from "../store/shelf";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<ScanStackParamList, "Scan">;

const SCENARIOS: { name: ScenarioName; label: string }[] = [
  { name: "major", label: "Major" },
  { name: "none", label: "No interaction" },
  { name: "abstain", label: "Abstain" },
  { name: "delegated", label: "Delegated" },
];

export function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const shelf = useShelf((s) => s.items);

  const runScan = useCallback(
    async (image: string) => {
      if (analyzing) return;
      setAnalyzing(true);
      try {
        const result = await scanPipeline(image, shelf);
        navigation.navigate("Result", { result });
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzing, navigation, shelf],
  );

  const capture = useCallback(async () => {
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.5,
      skipProcessing: true,
    });
    await runScan(photo?.uri ?? "camera://capture");
  }, [runScan]);

  const runScenario = useCallback(
    (name: ScenarioName) => {
      __setMockScenario(name);
      void runScan(`mock://${name}`);
    },
    [runScan],
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.headerWrap}>
        <Text style={styles.brand}>Pharos</Text>
        <DisclaimerBanner />
      </View>

      <View style={styles.cameraWrap}>
        {permission.granted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={styles.permission}>
            <Text style={styles.permTitle}>Camera access</Text>
            <Text style={styles.permBody}>
              Pharos reads a medication label on-device. The photo never leaves your phone.
            </Text>
            <Pressable style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Enable camera</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.reticle} pointerEvents="none" />
        {analyzing ? (
          <View style={styles.analyzing}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.analyzingText}>Analyzing on-device…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.shutter, (!permission.granted || analyzing) && styles.shutterDisabled]}
          onPress={capture}
          disabled={!permission.granted || analyzing}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <Text style={styles.hint}>Point at a medication label and capture</Text>

        <View style={styles.devStrip}>
          <Text style={styles.devLabel}>Demo scenarios (mock engine)</Text>
          <View style={styles.devRow}>
            {SCENARIOS.map((s) => (
              <Pressable
                key={s.name}
                style={styles.devBtn}
                onPress={() => runScenario(s.name)}
                disabled={analyzing}
              >
                <Text style={styles.devBtnText}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  headerWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  brand: { fontSize: font.h1, fontWeight: "900", color: colors.ink, letterSpacing: -0.5 },
  cameraWrap: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#0B1411",
    alignItems: "center",
    justifyContent: "center",
  },
  permission: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  permTitle: { color: "#fff", fontSize: font.h3, fontWeight: "800" },
  permBody: { color: "#D7E0DB", fontSize: font.small, textAlign: "center", lineHeight: 19 },
  permBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  permBtnText: { color: "#fff", fontWeight: "800" },
  reticle: {
    width: "78%",
    height: "44%",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: radius.md,
  },
  analyzing: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,20,17,0.55)", gap: spacing.sm },
  analyzingText: { color: "#fff", fontWeight: "700" },
  controls: { padding: spacing.lg, alignItems: "center", gap: spacing.sm },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: { width: 54, height: 54, borderRadius: radius.pill, backgroundColor: colors.accent },
  hint: { color: colors.inkSoft, fontSize: font.small },
  devStrip: { marginTop: spacing.sm, width: "100%", gap: spacing.xs, alignItems: "center" },
  devLabel: { color: colors.inkFaint, fontSize: font.tiny, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  devRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  devBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  devBtnText: { color: colors.ink, fontSize: font.small, fontWeight: "700" },
});
