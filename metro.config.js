const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Defensive setting for pnpm-managed node_modules: even with
// node-linker=hoisted, some nested/peer dependencies can still be
// symlinked, which has historically caused Metro's DependencyGraph
// to crash with "Cannot read properties of undefined (reading 'get')".
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
