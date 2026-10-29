---
description: Run every check CI runs, in order, and report the results
---

Run these in order and stop at the first failure to fix it: `npm run lint`, `npm run format:check`, `npm run check`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm run lighthouse` when the change can affect speed, layout or scripts.

Follow the environment notes in `CLAUDE.md` (Node version, Chromium paths, preview server). Report each result as pass or fail with the failing output. Do not skip, disable or quarantine a test to make a check pass.
