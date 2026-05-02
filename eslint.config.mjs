/** @type {import("eslint").Linter.Config[]} */
import coreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * `eslint-config-next` enables strict React Compiler–oriented hooks rules that flag many existing
 * patterns in this codebase. Relax them until a dedicated migration passes CI; `@next/next/*`
 * stays on from `core-web-vitals`.
 */
export default [
  ...coreWebVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/purity": "off",
    },
  },
];
