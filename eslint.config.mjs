import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // react-three-fiber props (args, intensity, castShadow...) are not DOM props
  { rules: { "react/no-unknown-property": "off" } },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);
