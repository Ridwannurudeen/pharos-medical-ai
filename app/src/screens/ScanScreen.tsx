import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DisclaimerBanner } from "../components/DisclaimerBanner";
import {
  __setMockScenario,
  scanMockPipeline,
  scanPipeline,
  type ScanResult,
  type ScenarioName,
} from "../engine";
import type { MeshStatus, ResultNotice } from "../mesh";
import type { ScanStackParamList } from "../navigation/types";
import { useShelf } from "../store/shelf";
import { colors, font, radius, spacing } from "../theme";

type Props = NativeStackScreenProps<ScanStackParamList, "Scan">;

type DemoScenarioName =
  | ScenarioName
  | "fallback"
  | "no-peer"
  | "ocr-fail"
  | "low-confidence";

type RunOptions = {
  meshStatus?: MeshStatus;
  notice?: ResultNotice;
  pipeline?: "real" | "mock";
};

const SCENARIOS: {
  name: DemoScenarioName;
  label: string;
  engineScenario: ScenarioName;
  options?: RunOptions;
}[] = [
  { name: "major", label: "Major", engineScenario: "major" },
  { name: "none", label: "No interaction", engineScenario: "none" },
  { name: "abstain", label: "Abstain", engineScenario: "abstain" },
  {
    name: "delegated",
    label: "Delegated",
    engineScenario: "delegated",
    options: { meshStatus: "delegating" },
  },
  {
    name: "fallback",
    label: "Fallback",
    engineScenario: "major",
    options: { meshStatus: "fell-back", notice: "fallback" },
  },
  {
    name: "no-peer",
    label: "No peer",
    engineScenario: "major",
    options: { meshStatus: "on-device", notice: "no-peer" },
  },
  {
    name: "ocr-fail",
    label: "OCR fail",
    engineScenario: "abstain",
    options: { notice: "ocr-fail" },
  },
  {
    name: "low-confidence",
    label: "Low confidence",
    engineScenario: "abstain",
    options: { notice: "low-confidence" },
  },
];

function analysisCopy(options?: RunOptions): string {
  if (options?.meshStatus === "delegating")
    return "Analyzing on a larger model nearby...";
  if (options?.meshStatus === "fell-back")
    return "Checking the nearby anchor, then falling back if needed...";
  if (options?.notice === "ocr-fail")
    return "Checking whether the label is readable...";
  return "Analyzing on-device...";
}

function shapeDemoResult(
  result: ScanResult,
  notice?: ResultNotice,
): ScanResult {
  if (notice === "ocr-fail") {
    return {
      ...result,
      scan: { rawText: "Unreadable label", generic: null, matched: false },
      interactions: [],
      explanation: "",
      abstained: true,
      abstainReason: "unresolved_drug",
      delegated: false,
      latencyMs: 900,
    };
  }

  if (notice === "low-confidence") {
    return {
      ...result,
      scan: { rawText: "IBU... 200 mg", generic: null, matched: false },
      interactions: [],
      explanation: "",
      abstained: true,
      abstainReason: "unresolved_drug",
      delegated: false,
      latencyMs: 1100,
    };
  }

  if (notice === "fallback" || notice === "no-peer") {
    return { ...result, delegated: false };
  }

  return result;
}

function qvacImageSrc(
  image: string,
  pipeline?: RunOptions["pipeline"],
): string {
  return pipeline === "mock" ? image : image.replace(/^file:\/\//, "");
}

export function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingText, setAnalyzingText] = useState(analysisCopy());
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const shelf = useShelf((s) => s.items);

  const runScan = useCallback(
    async (image: string, options?: RunOptions) => {
      if (analyzing) return;
      setScanError(null);
      setAnalyzingText(analysisCopy(options));
      setAnalyzing(true);
      try {
        const imageSrc = qvacImageSrc(image, options?.pipeline);
        console.log(`[Pharos] ${options?.pipeline ?? "real"} scan started`, {
          image,
          imageSrc,
        });
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const pipeline =
          options?.pipeline === "mock" ? scanMockPipeline : scanPipeline;
        const result = shapeDemoResult(
          await pipeline(imageSrc, shelf),
          options?.notice,
        );
        console.log(`[Pharos] ${options?.pipeline ?? "real"} scan finished`, {
          abstained: result.abstained,
          interactions: result.interactions.length,
        });
        navigation.navigate("Result", {
          result,
          meshStatus:
            options?.meshStatus ??
            (result.delegated ? "delegating" : "on-device"),
          notice: options?.notice,
        });
      } catch (error) {
        console.error("[Pharos] scan failed", error);
        setScanError(
          "Scan failed before a result. Check adb logcat for the Pharos error line.",
        );
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzing, navigation, shelf],
  );

  const capture = useCallback(async () => {
    if (analyzing) return;
    setScanError(null);
    setAnalyzingText("Capturing label...");
    setAnalyzing(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      console.log("[Pharos] capture pressed", { cameraReady });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (!cameraReady || !cameraRef.current) {
        throw new Error("camera is not ready");
      }
      const photo = await Promise.race([
        cameraRef.current.takePictureAsync({
          quality: 1,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("camera capture timed out")),
            10000,
          );
        }),
      ]);
      if (!photo?.uri) throw new Error("camera did not return a photo URI");
      console.log("[Pharos] capture saved", {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });
      setAnalyzing(false);
      await runScan(photo.uri);
    } catch (error) {
      console.error("[Pharos] capture failed", error);
      setScanError(
        "Camera capture failed before analysis. Check adb logcat for the Pharos error line.",
      );
      setAnalyzing(false);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }, [analyzing, cameraReady, runScan]);

  const runScenario = useCallback(
    (scenario: (typeof SCENARIOS)[number]) => {
      __setMockScenario(scenario.engineScenario);
      void runScan(`mock://${scenario.name}`, {
        ...scenario.options,
        pipeline: "mock",
      });
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
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => {
              console.log("[Pharos] camera ready");
              setCameraError(null);
              setCameraReady(true);
            }}
            onMountError={(event) => {
              console.error("[Pharos] camera mount failed", event.message);
              setCameraReady(false);
              setCameraError(event.message);
            }}
          />
        ) : (
          <View style={styles.permission}>
            <Text style={styles.permTitle}>Camera access</Text>
            <Text style={styles.permBody}>
              Pharos reads a medication label on-device. The photo never leaves
              your phone.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.permBtn}
              onPress={requestPermission}
            >
              <Text style={styles.permBtnText}>Enable camera</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.reticle} pointerEvents="none" />
        {analyzing ? (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.analyzing}
          >
            <ActivityIndicator color="#fff" />
            <Text style={styles.analyzingText}>{analyzingText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityHint="Takes a medication label photo and analyzes it on this device."
          accessibilityLabel="Capture medication label"
          accessibilityRole="button"
          accessibilityState={{
            disabled: !permission.granted || !cameraReady || analyzing,
          }}
          style={[
            styles.shutter,
            (!permission.granted || !cameraReady || analyzing) &&
              styles.shutterDisabled,
          ]}
          onPress={capture}
          disabled={!permission.granted || !cameraReady || analyzing}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <Text style={styles.hint}>
          {cameraReady
            ? "Point at a medication label and capture"
            : "Camera starting..."}
        </Text>
        {cameraError || scanError ? (
          <View style={styles.scanError}>
            <Text style={styles.scanErrorText}>{cameraError ?? scanError}</Text>
          </View>
        ) : null}
        {shelf.length === 0 ? (
          <View style={styles.emptyShelf}>
            <Text style={styles.emptyShelfText}>
              Shelf is empty. Scans can identify a label, but interaction checks
              need saved medications.
            </Text>
          </View>
        ) : null}

        <View style={styles.devStrip}>
          <Text style={styles.devLabel}>Demo scenarios (mock engine)</Text>
          <View style={styles.devRow}>
            {SCENARIOS.map((s) => (
              <Pressable
                key={s.name}
                accessibilityLabel={`Run ${s.label} demo scenario`}
                accessibilityRole="button"
                accessibilityState={{ disabled: analyzing }}
                style={styles.devBtn}
                onPress={() => runScenario(s)}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  brand: {
    fontSize: font.h1,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.5,
  },
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
  permBody: {
    color: "#D7E0DB",
    fontSize: font.small,
    textAlign: "center",
    lineHeight: 19,
  },
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
  analyzing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,20,17,0.55)",
    gap: spacing.sm,
  },
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
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  hint: { color: colors.inkSoft, fontSize: font.small },
  scanError: {
    backgroundColor: colors.warnBg,
    borderColor: "#F0C9BD",
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.md,
    width: "100%",
  },
  scanErrorText: {
    color: colors.danger,
    fontSize: font.small,
    lineHeight: 18,
    textAlign: "center",
  },
  emptyShelf: {
    backgroundColor: colors.warnBg,
    borderColor: "#F0C9BD",
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.md,
    width: "100%",
  },
  emptyShelfText: {
    color: colors.danger,
    fontSize: font.small,
    lineHeight: 18,
    textAlign: "center",
  },
  devStrip: {
    marginTop: spacing.sm,
    width: "100%",
    gap: spacing.xs,
    alignItems: "center",
  },
  devLabel: {
    color: colors.inkFaint,
    fontSize: font.tiny,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  devRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
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
