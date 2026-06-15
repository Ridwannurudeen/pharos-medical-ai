// Device-specific config for the REAL engine (app/src/engine/real.ts).
//
// RN/device plumbing. Uses the SDK-54 `expo-file-system/legacy` API (the classic
// getInfoAsync/downloadAsync/createDownloadResumable surface; the bare default export is
// deprecated in SDK 54). All steps log to console (ReactNativeJS in logcat) for diagnosis.
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

/** Filename opened by `SQLite.openDatabaseSync(DB_NAME)`. expo-sqlite looks in <documentDir>/SQLite/. */
export const DB_NAME = "pharos.db";

// MedPsy-1.7B GGUF (~1.28 GB). QVAC loadModel() takes a local path. Downloaded once on first launch
// (online) into <documentDir>models/ by ensureModel(); offline on every run after.
export const MEDPSY_MODEL_SRC = `${FileSystem.documentDirectory}models/medpsy-1.7b-q4_k_m-imat.gguf`;
export const MEDPSY_MODEL_URL =
  "https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf?download=true";
// Guard: the real file is ~1.28 GB. A smaller file on disk = a truncated/interrupted download,
// which would make loadModel fail on a corrupt GGUF — so we re-download it.
const MEDPSY_MIN_BYTES = 1_200_000_000;

// TODO(dolepee): a stable per-install id for the audit log. A constant is fine for the demo.
export const DEVICE_ID = "pharos-phone";

// MESH (optional, gated): when set, the MedPsy explanation is delegated to a nearby anchor running the
// bigger MedPsy-4B (the phone still does OCR + DDInter grounding locally). null = solo (on-device only).
export const MESH_DELEGATE: {
  providerPublicKey: string;
  timeout?: number;
  fallbackToLocal?: boolean;
} | null = null;

/** Copy the bundled pharos.db into the writable SQLite directory on first run. Idempotent. */
export async function ensureDatabase(): Promise<void> {
  const dir = `${FileSystem.documentDirectory}SQLite`;
  const dest = `${dir}/${DB_NAME}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) {
    console.log("[Pharos] pharos.db already present, skipping copy");
    return;
  }
  console.log("[Pharos] copying pharos.db asset into SQLite dir…");
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const asset = Asset.fromModule(require("../../assets/pharos.db"));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("pharos.db asset has no localUri");
  await FileSystem.copyAsync({ from: asset.localUri, to: dest });
  console.log("[Pharos] pharos.db ready");
}

/**
 * Ensure the MedPsy-1.7B GGUF is on disk at MEDPSY_MODEL_SRC, downloading it once on first launch
 * with progress logging. Idempotent — skips if a complete copy is already present.
 */
export async function ensureModel(
  onProgress?: (pct: number) => void,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(MEDPSY_MODEL_SRC);
  if (info.exists && (info.size ?? 0) >= MEDPSY_MIN_BYTES) {
    console.log(
      `[Pharos] MedPsy model present (${info.size} bytes), skipping download`,
    );
    return;
  }
  if (info.exists) {
    console.log(
      `[Pharos] MedPsy model incomplete (${info.size} bytes) — re-downloading`,
    );
    await FileSystem.deleteAsync(MEDPSY_MODEL_SRC, { idempotent: true });
  }
  const dir = MEDPSY_MODEL_SRC.slice(0, MEDPSY_MODEL_SRC.lastIndexOf("/"));
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  console.log("[Pharos] downloading MedPsy model (~1.28 GB)…");
  let lastPct = -1;
  const dl = FileSystem.createDownloadResumable(
    MEDPSY_MODEL_URL,
    MEDPSY_MODEL_SRC,
    {},
    (p) => {
      if (!p.totalBytesExpectedToWrite) return;
      const pct = Math.floor(
        (p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100,
      );
      if (pct !== lastPct && pct % 5 === 0) {
        lastPct = pct;
        console.log(`[Pharos] MedPsy download ${pct}%`);
        onProgress?.(pct);
      }
    },
  );
  const res = await dl.downloadAsync();
  if (!res || res.status !== 200)
    throw new Error(`MedPsy model download failed: HTTP ${res?.status}`);
  const after = await FileSystem.getInfoAsync(MEDPSY_MODEL_SRC);
  console.log(
    `[Pharos] MedPsy model downloaded: ${after.exists ? after.size : 0} bytes`,
  );
}
