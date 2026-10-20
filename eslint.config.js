const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  expoConfig,
  {
    files: ["app/(tabs)/geocam.tsx"],
    // CameraView needs its ref prop during render; this rule misreads values
    // returned together with the hook's camera ref as ref access.
    rules: { "react-hooks/refs": "off" },
  },
]);
