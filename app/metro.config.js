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
  // Pin @qvac/sdk to the app-local copy (matches the compiled native libs). The real engine is
  // imported from the repo-root compiled core, which would otherwise resolve @qvac/sdk (and its
  // transitive `react-native`) against the repo-root tree and pull in a duplicate RN.
  if (moduleName === "@qvac/sdk" || moduleName.startsWith("@qvac/sdk/")) {
    const sub = moduleName.slice("@qvac/sdk".length);
    return context.resolveRequest(
      context,
      sub ? path.join(APP_QVAC, sub) : APP_QVAC,
      platform,
    );
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
