# Google data (Search Console and Business Profile)

What only Google knows: which searches showed the site and how often it was clicked (Search Console), and what people did on the Maps listing (Business Profile). The nightly job imports them into our own database so the dashboard can show them next to the site's own numbers (REL-51).

## Search Console

### What is stored

- `search_console_daily`: one row per day, query, page, country and device, with clicks, impressions, CTR (0 to 1) and average position.
- `search_console_totals`: one row per day with the totals **as the Search Console screen shows them**. Google leaves the anonymized queries out of the detail, so the detail adds up to less than the real total: use the totals for "how many clicks", and the detail for "which searches". A quiet day has a row of zeros, which also marks the day as imported.

Queries and pages are cut at 500 and 1000 characters (`QUERY_MAX`, `PAGE_MAX`) so a huge one cannot break the primary key; rows that become equal after the cut are added up (CTR is clicks over impressions, position is the average weighted by impressions).

### How it runs

`runScheduled` (`src/server/jobs/scheduled.js`) runs the daily analytics job first and then the Google import, each one in its own `try`. A failure in Google never skips the analytics job, which deletes the old salts and events, and the run is marked as failed if either failed. It is the same Cron Trigger (07:30 UTC), so no new schedule is used.

`runSearchConsoleImport` (`src/server/google/import.js`) asks for **one day at a time**, newest first, and replaces that day in a single statement (`replaceSearchConsoleDay`): a rerun gives the same rows, rows Google no longer gives are removed, and a failure leaves the day as it was. Each run asks for:

1. The three newest days with final data (`RECENT_DAYS`, two days behind today, `LAG_DAYS`), every night, because the newest can still change.
2. Any days between the last run and those, if a night was missed.
3. The history before the oldest imported day, back to **2026-10-11** (`SEARCH_CONSOLE_START_DAY`, when the property was verified).

At most 9 days per run (`MAX_DAYS_PER_RUN`). **Why 9:** a Worker on the free plan may make about 50 requests per run and each one to Google or to the database counts, and each day costs three (totals, details and one database statement), next to the ones of the analytics job. The first nights fill the history (about two or three nights), and after that a run asks for three days. Check in Cloudflare (Observability) that a run is not cut off; if the plan changes, so can the constant.

The API gives 25,000 rows per request: a day with more is read with `startRow` until a page is not full. A request that fails with 429 or a 5xx is tried again up to four times, waiting as long as Google says (`Retry-After`) or 0.5, 1 and 2 seconds, never more than 10.

### Signing in

A service account signs a JWT with its private key (Web Crypto, no library) and exchanges it at `https://oauth2.googleapis.com/token` for a token that is valid for an hour (`src/server/google/auth.js`). The token is asked for **read-only** (`webmasters.readonly`). The address the signed request goes to is fixed in the code and is never taken from the key file. Neither the key nor the token is logged or put in an error message.

### What the owner sets up

1. In Google Cloud: enable the Search Console API, create a service account and download its JSON key.
2. In Search Console, **Settings, Users and permissions**: add the service account's email as a user with the **Restricted** permission (read only).
3. In Cloudflare, Worker `holistic-spa-landing-page`, **Settings, Variables and Secrets**, as **Runtime** variables:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (secret): the whole content of the JSON file.
   - `SEARCH_CONSOLE_SITE_URL` (plain text): `sc-domain:masajesrelaxmty.com` for a domain property, or the URL ending in `/` for a URL-prefix property. It has to be exactly the property.

Until both exist the import is skipped and the log says so (`search console import finished: {"skipped":true,"reason":"not configured (missing ...)"}`), so the code can be deployed first. If one is there but wrong, the run fails and the message names the variable, never its value.

The Search Console pages Google documents describe OAuth 2.0 and do not mention service accounts; the permission level (Restricted) and the use of a service account are the usual way and are checked on the first real run. If Google refused it, the same code would work with an OAuth refresh token instead of the JWT step.

### Errors

- `403` or `404`: the service account is not a user of the property, or `SEARCH_CONSOLE_SITE_URL` is not exactly the property.
- `Google refused the service account sign-in (400, invalid_grant)`: the key is wrong or was deleted, or the clock of the key's project is off.

## Business Profile

Not built yet. It needs Google to approve the project for the Business Profile APIs (a support case, 7 to 10 business days) and OAuth 2.0 consent from an account that manages the listing.
