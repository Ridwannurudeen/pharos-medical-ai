// Default Expo Metro config, plus watchFolders so the app can import the Lead's
// repo-root `../core` engine once you flip USE_ROOT_CORE in src/engine/index.ts.
// Until that flip the app uses a self-contained mock and this extra watch is harmless.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

module.exports = config;
