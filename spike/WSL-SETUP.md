# Run-validate the real engine on WSL2 (solo item 1)

Closes **item 1 — run-validate `core/engine-qvac.ts`**. The QVAC inference worker will not start on
native Windows (`RPC_INIT_TIMEOUT`), so we run `spike/validate-engine.ts` on a real Linux runtime via
WSL2. **This also tests an open unknown: whether the worker starts on WSL2 at all.** If it does, item 1
is done; if it still times out, run the same scan through the phone dev build instead.

Verified facts this runbook depends on (checked 2026-06-12 against the repo): `@qvac/sdk` is **not** in
`package.json` (`dependencies: {}`) so it needs an explicit install; `engines.node >= 24`; the Windows
`node_modules` holds Windows-only native bindings (must reinstall under Linux); `Ubuntu-24.04` is an
available distro; the OCR recognizer + CRAFT detector are `registry://s3` models (first run needs WAN);
MedPsy is a local GGUF already on disk.

## Phase A — install WSL (Windows PowerShell)
```powershell
wsl --install -d Ubuntu-24.04
```
- Reboot if prompted, then launch **Ubuntu 24.04** from the Start menu.
- First launch creates a UNIX username + password (remember it — `sudo` needs it).
- Everything below runs in the **Ubuntu shell**, not PowerShell.

## Phase B — inside the Ubuntu shell

### 1. Node 24 (Ubuntu's default is too old)
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v          # must print v24.x
```
(Alternative: install via `nvm` then `nvm install 24`.)

### 2. Copy the project into the Linux filesystem
Exclude `node_modules` (Windows binaries) and `core/dist` (rebuilt on install). `/mnt/c` is too slow
for native modules, so we copy into `~`. The 1.28 GB MedPsy GGUF and `data/pharos.db` come along, so
nothing re-downloads.
```bash
mkdir -p ~/pharos
tar -C /mnt/c/Users/gudma/pharos --exclude=node_modules --exclude=core/dist -cf - . | tar -C ~/pharos -xf -
cd ~/pharos
```

### 3. System lib the Bare worker needs
The SDK's Bare worker (`rocksdb-native` binding) needs `libatomic.so.1`, which the minimal Ubuntu
image lacks. Without it the worker exits before IPC and you get a misleading `RPC_INIT_TIMEOUT`.
```bash
sudo apt-get install -y libatomic1
```

### 4. Install deps + the SDK (Linux bindings)
`@qvac/sdk` isn't a declared dependency, so it needs its own install. **Pin the proven version**
(`0.12.2`, run-verified 2026-06-14); installing unpinned can hit a transient `ETARGET` if a
transitive dep hasn't propagated to your npm mirror yet — retry, or pin.
```bash
npm install
npm install @qvac/sdk@0.12.2
```
~194 packages, a few minutes. The first `npm install` also compiles `core/dist` (harmless).

### 5. Run the validation (keep WAN ON for this first run — OCR models pull ~15 MB from S3)
```bash
MEDPSY_1_7B=$PWD/models/medpsy-1.7b-q4_k_m-imat.gguf node spike/validate-engine.ts
```

## Success looks like
```
OCR rawText : "...aspirin..."
generic     : acetylsalicylic acid · matched: true
interaction : ... = Major (DDInter 2.0, .../...)
explanation : <streamed MedPsy text>
VALIDATE ENGINE: PASS ✓
```
Exit code 0 = **item 1 closed** — `engine-qvac.ts`'s `ocr()` and `explain()` are runtime-proven.
After the first (online) run the OCR models are cached, so re-runs work fully offline.

## If it fails
- **`RPC_INIT_TIMEOUT` again** → the SDK's Linux worker won't start in this WSL2 either; don't fight it,
  run the same scan through the phone dev build. Report it.
- **Anything else** (thrown error, wrong severity, empty explanation) → capture the full output; it
  points at the exact model call to fix in `engine-qvac.ts`.
