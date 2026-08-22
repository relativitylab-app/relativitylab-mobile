const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Three.js publishes separate ESM and CommonJS builds behind its exports map.
// React Three Fiber's native entry point is CommonJS, so it resolves the CJS
// build and patches TextureLoader there for React Native. Application code is
// ESM and would otherwise resolve the module build, leaving it with a second
// Three.js instance whose loader still expects a DOM. Pin both to one file.
const threeEntry = path.resolve(__dirname, "node_modules/three/build/three.cjs");
const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { filePath: threeEntry, type: "sourceFile" };
  }

  const resolve = upstreamResolveRequest ?? context.resolveRequest;
  return resolve(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./app/global.css" });
