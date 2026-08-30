import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
  {
    files: ["app/systems/lab/bead-studio/**/*.js"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Bead Studio is a self-contained browser module; its event wiring intentionally uses expression callbacks.
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    files: ["*.config.{js,mjs,ts}", "tests/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
