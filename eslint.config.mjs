import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next 16.x ships a native flat-config array at this subpath, so it is imported
// directly with no FlatCompat shim (same setup as treasury-ui).
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"],
  },
];

export default eslintConfig;
