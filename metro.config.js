const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Defensive setting for pnpm-managed node_modules: even with
// node-linker=hoisted, some nested/peer dependencies can still be
// symlinked, which has historically caused Metro's DependencyGraph
// to crash with "Cannot read properties of undefined (reading 'get')".
config.resolver.unstable_enableSymlinks = true;

// FIX (Termux/Android): com mais de 1 worker o Metro cria processos filhos
// via child_process.fork (canal IPC em JSON). No Node para Android (Termux)
// o processo filho pode escrever lixo de trace do sistema ("B|<pid>|dl...")
// nesse canal, e o processo principal cai com
// `SyntaxError: Unexpected token 'B', "B|25445|dl"... is not valid JSON`.
// Com 1 worker o Metro transforma os arquivos no próprio processo, sem fork.
if (process.platform === "android") {
  config.maxWorkers = 1;
}

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
