import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".data"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Express error middleware needs all four parameters.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Controllers do HTTP only; data access goes through a service.
    files: ["src/controllers/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["../models/*", "../db/*"], message: "Controllers call services, not models or the database." },
          ],
        },
      ],
    },
  },
);
