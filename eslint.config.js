import js from "@eslint/js";
import globals from "globals";
import astro from "eslint-plugin-astro";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import jsdoc from "eslint-plugin-jsdoc";

export default [
  {
    ignores: [
      "dist/",
      ".astro/",
      ".vercel/",
      "node_modules/",
      "public/",
      // Legacy browser script ported as-is from the static site. It is replaced
      // piece by piece by the design (REL-10), services (REL-18) and FAQ
      // (REL-20) tickets, so it is not linted.
      "src/scripts/index.js",
    ],
  },

  js.configs.recommended,
  ...astro.configs["flat/recommended"],
  ...astro.configs["flat/jsx-a11y-recommended"],

  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Known issue in the ported FAQ markup (links with href="javascript:void(0)").
  // The FAQ is rebuilt with <details>/<summary> in REL-20; remove this then.
  {
    files: ["src/pages/index.astro"],
    rules: { "astro/jsx-a11y/anchor-is-valid": "off" },
  },

  // Config files run in Node.
  {
    files: ["*.config.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // React islands.
  {
    files: ["**/*.{jsx,tsx}"],
    ...react.configs.flat.recommended,
    settings: { react: { version: "detect" } },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...react.configs.flat["jsx-runtime"],
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },

  // JSDoc is required on exported functions and components.
  {
    files: ["**/*.{js,jsx,mjs}"],
    ...jsdoc.configs["flat/recommended"],
    rules: {
      ...jsdoc.configs["flat/recommended"].rules,
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns-description": "error",
    },
  },
];
