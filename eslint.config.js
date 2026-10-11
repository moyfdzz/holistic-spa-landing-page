import js from "@eslint/js";
import globals from "globals";
import astro from "eslint-plugin-astro";
import tsParser from "@typescript-eslint/parser";
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
      "coverage/",
      "playwright-report/",
      "test-results/",
      // Legacy code from the original site, replaced by later tickets: the
      // carousel by REL-18 and the contact form validation by REL-19.
      "src/scripts/services-swiper.js",
      "src/scripts/contact-form.js",
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

  // Astro files use TypeScript syntax in the frontmatter (for example `interface Props`).
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: { parser: tsParser },
    },
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
    // The jsx-a11y plugin itself is already registered by the Astro config
    // above, so only its rules are added here (registering it twice fails).
    files: ["**/*.{jsx,tsx}"],
    languageOptions: jsxA11y.flatConfigs.recommended.languageOptions,
    rules: jsxA11y.flatConfigs.recommended.rules,
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
      // TypeScript already checks the types, including DOM types such as ParentNode.
      "jsdoc/no-undefined-types": "off",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns-description": "error",
    },
  },
];
