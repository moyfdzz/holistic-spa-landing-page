// Conventional Commits, e.g. "feat(REL-18): add service cards".
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scopes are Linear ticket IDs such as REL-6, which are upper case.
    "scope-case": [0],
  },
};
