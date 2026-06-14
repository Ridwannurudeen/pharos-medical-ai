// Device-specific config for the REAL engine (app/src/engine/real.ts).
//
// Everything in this file is RN/device plumbing that the Lead CANNOT run-validate from the build
// sandbox — it MUST be confirmed on the S25 dev build. The core pipeline it feeds is already
// run-validated (see real.ts header). Marked TODO(dolepee) where a device decision is required.
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

/** Filename opened by `SQLite.openDatabaseSync(DB_NAME)`. expo-sqlite looks in <documentDir>/SQLite/. */
export const DB_NAME = "pharos.db";

// TODO(dolepee): how the ~1.28 GB MedPsy-1.7B GGUF gets onto the device and its on-disk path.
// QVAC loadModel() takes a local filesystem path. Options: (a) download once on first launch via
// FileSystem.downloadAsync from a URL you control, into <documentDir>models/, or (b) sideload via adb
// push for the demo build. Bundling it as an Expo asset is NOT advisable at that size. Set the final
// absolute path here once decided.
export const MEDPSY_MODEL_SRC = `${FileSystem.documentDirectory}models/medpsy-1.7b-q4_k_m-imat.gguf`;

// TODO(dolepee): a stable per-install id for the audit log. A constant is fine for the demo; for a real
// per-install id, generate a UUID once and persist it in expo-secure-store, or use expo-device.
export const DEVICE_ID = "pharos-phone";

/**
 * Copy the bundled pharos.db into the writable SQLite directory on first run, so openDatabaseSync
 * can open it. Idempotent — skips if already copied.
 *
 * NOT run-validated here (no RN runtime). Confirm on device:
 *  - place the DB at app/assets/pharos.db and `require` it below (Metro bundles it as an asset);
 *  - copy it from the asset's localUri into <documentDir>SQLite/<DB_NAME>.
 * (`pharos.db` is gitignored — regenerate at repo root with `npm run data`, then copy into app/assets/.)
 */
export async function ensureDatabase(): Promise<void> {
  const dir = `${FileSystem.documentDirectory}SQLite`;
  const dest = `${dir}/${DB_NAME}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  // TODO(dolepee): drop the DB at app/assets/pharos.db, then enable the require below.
  const asset = Asset.fromModule(require("../../assets/pharos.db"));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("pharos.db asset has no localUri");
  await FileSystem.copyAsync({ from: asset.localUri, to: dest });
}
