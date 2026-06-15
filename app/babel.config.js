const path = require("path");

// Resolve babel-preset-expo from the APP's expo install, not the repo root. The repo root
// has babel-preset-expo@56 (pulled in by the root @qvac/sdk install); resolving the bare
// "babel-preset-expo" string walks up to it, and v56's `hermes-stable` profile leaves
// `#private` class fields unlowered (RN 0.86's Hermes supports them) — but this app is
// RN 0.81, whose hermesc rejects them. Pinning to the app-local v54 lowers them correctly.
const expoBabelPreset = require.resolve("babel-preset-expo", {
  paths: [path.dirname(require.resolve("expo/package.json"))],
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [expoBabelPreset],
  };
};
