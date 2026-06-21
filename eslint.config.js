// Flat ESLint config: typescript-eslint (type-aware) + the two classic React
// Hooks correctness rules.
//
// We intentionally do NOT spread eslint-plugin-react-hooks v7's `recommended`
// preset: it now bundles the React Compiler rule set (preserve-manual-
// memoization, set-state-in-effect, immutability, …), which assumes the code
// is compiled with React Compiler. This app uses OpenTUI's own reconciler
// without the compiler, so those rules flag correct hand-written memoization
// and effects. The classic rules below still catch real hook misuse.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "reports/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
);
