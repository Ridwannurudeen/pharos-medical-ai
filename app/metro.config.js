// Default Expo Metro config, plus watchFolders so the app can import the Lead's
// repo-root `../core` engine once you flip USE_ROOT_CORE in src/engine/index.ts.
// Until that flip the app uses a self-contained mock and this extra watch is harmless.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [repoRoot];
// Resolve ALL deps from the app's own node_modules only. The repo root has a different
// react-native (pulled in by the root @qvac/sdk install) — including it here makes Metro
// bundle the wrong RN internals (e.g. EventEmitter) and hermesc fails. watchFolders still
// lets Metro read the compiled engine under repoRoot/core/dist (file path, not a module).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

// @qvac/sdk uses an `exports` map (Metro 0.80 resolves this) plus Node "#"-subpath `imports`
// ("#polyfill-bare-globals", "#rpc") which Metro 0.80 does NOT resolve. Enable exports + the
// react-native condition, and hand-resolve the "#" imports from the importing @qvac/sdk package's
// own imports map (react-native > default): "#rpc" -> expo-rpc-client, "#polyfill" -> noop.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["require", "import", "react-native"];

const QVAC_MARKER = path.join("node_modules", "@qvac", "sdk");
const APP_QVAC = path.join(projectRoot, "node_modules", "@qvac", "sdk");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pin ONLY the bare `@qvac/sdk` specifier (the repo-root compiled engine's import) to the
  // app-local copy, so its transitive `react-native` resolves app-local (not the repo-root tree).
  // Do NOT redirect `@qvac/sdk/<subpath>` — those MUST resolve through the package `exports` map
  // (e.g. "@qvac/sdk/worker.mobile.bundle" -> dist/worker.mobile.bundle.js so Metro inlines the
  // 10.8 MB mobile worker bundle). Rewriting subpaths to an absolute path bypasses `exports` and
  // breaks the worker-bundle load at runtime (RPC_CONNECTION_FAILED / "Cannot find module").
  if (moduleName === "@qvac/sdk") {
    return context.resolveRequest(context, APP_QVAC, platform);
  }
  if (moduleName.startsWith("#")) {
    const origin = context.originModulePath || "";
    const idx = origin.lastIndexOf(QVAC_MARKER);
    if (idx >= 0) {
      const pkgRoot = origin.slice(0, idx + QVAC_MARKER.length);
      const imports =
        JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"))
          .imports || {};
      const entry = imports[moduleName];
      const target =
        typeof entry === "string"
          ? entry
          : entry &&
            (entry["react-native"] ||
              entry.default ||
              entry.import ||
              entry.require);
      if (target) {
        return { type: "sourceFile", filePath: path.join(pkgRoot, target) };
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
