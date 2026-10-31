# Website analytics

First-party, cookieless statistics stored in our own Postgres (decision in [ADR-008](adr/008-web-analytics-first-party.md)). Nothing in this system identifies a person.

## What is and is not stored

| Stored                                                         | Never stored                                  |
| -------------------------------------------------------------- | --------------------------------------------- |
| Event name, page path, language                                | IP address                                    |
| Where the visit came from (channel, referrer host, UTM values) | Cookies or any identifier kept in the browser |
| Approximate place: country, state, city (from Cloudflare)      | The full user agent string                    |
| Device type, browser and OS as categories                      | Form field values, names, phones, emails      |
| Screen size bucket (small, medium, large)                      | Exact screen size                             |
| An anonymous visitor id for one day                            | Anything that links visits across days        |

The visitor id is `hash(salt of the day + IP + user agent + site host)`. The salt is random, secret, stored in `analytics_salts` and deleted by the daily job, so after that day the id cannot be recomputed and a person cannot be followed.

## The tracker

`src/scripts/analytics.js` is loaded on every page (deferred, after the page is shown) and sends events with `navigator.sendBeacon`, or `fetch` with `keepalive` as a fallback. It never blocks the page.

It does nothing when:

- the page is not on the production host (`<meta name="analytics-host">`), such as previews and local runs;
- the browser sends Do Not Track or Global Privacy Control;
- the visitor, normally the owner, opted out: open any page of the site with `?notrack` to stop measuring that browser, and with `?notrack=0` to start again. This keeps a flag in `localStorage` (not a cookie) and nothing else is stored in the browser.

Islands and scripts report events with `track(type, props)` from `src/utils/track.js` (the contact form does it). Details such as `props` are always short labels, never text typed by the visitor.

Not sent yet: the `chat_*` events, which arrive with their own tickets.

The speed of the page (`web_vital`, see below) is measured with the browser's own performance entries in `src/scripts/vitals.js`, in memory, and sent once, the first time the page is hidden. `VITALS_SAMPLE_RATE` in that file is the share of page views that report it (1 is all of them); lower it if traffic grows.

## How the collector decides

`POST /api/collect` (`src/pages/api/collect.js`) accepts a small JSON body and builds one row (`src/server/analytics/collect.js`). It drops the request, without storing anything, when:

- the `Origin` is not the production host (previews, local runs, other sites);
- `DNT: 1` or `Sec-GPC: 1` is sent;
- the user agent is empty or looks like a bot;
- the body is larger than 2 KB, or invalid (answered with an error code).

It answers `204` for everything it accepts or deliberately ignores, so the tracker never learns why.

## Events

| Event                                                                                    | When                                                     |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `page_view`                                                                              | A page loads (path, language, referrer, UTM, screen)     |
| `engagement`                                                                             | Active time and scroll depth, when the page is left      |
| `section_view`                                                                           | A section enters the screen (`props.section`)            |
| `contact_view`, `form_start`, `form_submit`, `form_success`, `form_error`                | The contact funnel (`form_error` has an error type only) |
| `whatsapp_click`                                                                         | Any WhatsApp link (`props.placement`)                    |
| `phone_click`, `email_click`, `social_click`, `language_switch`                          | Clicks                                                   |
| `service_card_view`, `faq_open`                                                          | Content interest (`props.id`)                            |
| `chat_open`, `chat_message`, `chat_suggestion_click`, `chat_handoff_click`, `chat_close` | The website chat, when it exists                         |
| `web_vital`                                                                              | Real-user speed, once per page view (see below)          |

Any other event name is rejected. `props` has at most 8 keys and short values.

## Channels

UTM parameters win; otherwise the referrer host decides: `google_maps`, `google_search`, `bing`, `instagram`, `facebook`, `whatsapp`, `other_site`, `direct`, `internal` (navigation inside the site) and `campaign` (any other UTM source). A visit from Google Maps looks like normal Google traffic unless the link in the Business Profile has `?utm_source=google&utm_medium=maps`; the same goes for the Instagram, Facebook and WhatsApp profiles.

## The daily job

A Cloudflare Cron Trigger (`wrangler.jsonc`, `triggers.crons`: 07:30 UTC, which is 01:30 in Monterrey) calls the `scheduled` handler of `src/worker.js`, which runs `runDailyJob` (`src/server/analytics/jobs.js`). In this order:

1. **Totals.** It recomputes yesterday and the day before into `analytics_daily` (one row per day, dimension and key). Recomputing a day gives the same result and replaces the old rows in one statement, so a failed run leaves nothing half done and a rerun is safe. A "day" starts at midnight in Monterrey, the same boundary as the visitor salt.
2. **Salts.** It deletes the salts of earlier days, so the visitor ids of those days can no longer be recomputed.
3. **Retention.** It deletes raw events older than 13 months (`RAW_EVENT_RETENTION_MONTHS`). The daily totals stay for good because they hold no visitor ids.

It logs counts only. If it fails, the run is recorded as failed in Cloudflare (Worker, Settings, Triggers or Observability).

`analytics_daily` dimensions: `total`, `event`, `path`, `channel`, `referrer_host`, `country`, `region`, `city`, `device`, `browser`, `os`, `locale`, `section`, `service`, `faq`, `whatsapp` (by placement), `scroll` and `conversion`. `scroll` counts the page views by how far down the visitor got (the `scroll` prop of `engagement`: 0, 25, 50, 75 or 100). The `conversion` row (key `contacted`) counts the visitors of the day who contacted the business: a click to WhatsApp, phone or email, or a contact form that was sent (`CONTACT_EVENTS` in `rollup.js`). Opening the form, a social link or a language switch is not a contact. `contacted_channel` has one row per channel with the **sessions** that ended in a contact, counted for the channel the session started from, so the conversion of a source is its contacted sessions over its sessions (a session is counted once however many contacts it has). Each row has visitors, sessions, page views, events, engaged seconds and bounces (one page view and less than 10 seconds engaged). Monthly and yearly "visitors" are the sum of the daily ones: the design cannot recognize the same person on two days.

## The query API

`GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month|year&compare=previous` (`src/pages/api/admin/analytics.js`, logic in `src/server/analytics/query.js`). It is behind the admin guard like every `/api/admin` route and the query is validated with Zod: a wrong one answers `400`. `from` and `to` are swapped when reversed, `to` is cut at today, `from` at the launch day, and a range is at most 1830 days.

The answer has `range`, `events` (every kind of event of the range, not only the top 20 of the breakdown, which is what the funnel reads), `through` (the last day with totals), `totals`, `series` (one point per day, week starting Monday, month or year that has data), `breakdowns` (the top 20 keys of each dimension, by visitors) and `comparison` (the previous period of the same length with the change of each number, when `compare=previous`). `bounceRate` is bounces over sessions and `avgEngagedSeconds` is engaged seconds per session.

- **Today is included.** When the range ends today, a cache miss first recomputes today from the raw events with `rollupDay` (the same idempotent statement the daily job uses) and then reads the totals. That GET therefore writes today's rows; the daily job recomputes yesterday and the day before, so late events settle the day. Today is recomputed at most once a minute per Worker instance.
- **`live`** is the count of distinct visitors with an event in the last 30 minutes, read from the raw events and never cached.
- Answers are cached inside the Worker instance for 3 minutes, or 1 minute when the range ends today.
- A monthly or yearly `visitors` is the sum of the daily ones: show it as such.

## The Resumen page

`/admin` (`src/pages/admin/index.astro`) is rendered on the server from the same functions as the API, with no JavaScript framework: `loadOverview` (`src/server/admin/dashboard.js`) reads the totals and the live counter, and `buildOverview` (`overview.js`) turns them into the tiles and the series. It shows:

- **Ahora mismo**: visitors in the last 30 minutes.
- Tiles with the change against the previous period: visitors (labeled "suma de días" when the range has more than one day, because the visitor id lasts one day), visitors per day (average over the days since the tracker existed, with the busiest day when the series is by day; only for ranges of more than one day), sessions, active time (average per session, median in the note), messages from the contact form, WhatsApp clicks and conversion (visitors who contacted the business over all visitors). The previous period is left out when it ends before the tracker existed (29 Oct 2026), so "7 días" has no comparison during the first week.
- **Visitas en el tiempo**: a line chart with the previous period as a dashed line. It groups by day, week, month or year (`?g=`, automatic by default: days up to two months, weeks up to nine, months up to three years). Buckets without data are zero, so the line has no gaps.

The charts are plain SVG drawn on the server (`src/server/admin/chart.js` has the geometry and `VisitsChart.astro` the markup), so the panel loads no chart library. Each chart has a text summary, a legend, a "Ver números" table with the same data, a reading line that follows the pointer or the arrow keys, and no information that depends on color alone (the previous period is dashed). There is no dark theme in the site yet, so the charts have only the light one.

## The Sitio web page

`/admin/sitio` (`src/pages/admin/sitio.astro`) reads the same totals as the API (`loadSite` in `dashboard.js`, `buildSite` in `site.js`) for the range chosen with the date picker. Its blocks are plain HTML bars and tiles, each with a "Ver números" table and a link that downloads the same numbers as CSV:

- **De dónde llegan**: sessions by the channel they started from, with the share of them that ended in a contact. Visits that move inside the site (`internal`) have no sessions of their own and are not listed.
- **Estados** and **Ciudades**: visitors by state and by city, with the share of the visitors with a known state who are outside Nuevo León. A value Cloudflare could not read shows as "Sin datos".
- **Embudo de contacto**: all the visitors, then the ones who opened the contact page, started the form, sent it and whose message arrived (`contact_view`, `form_start`, `form_submit`, `form_success`), each as a share of the step before. Steps that nobody reached stay in the list, so it shows where people stop; a step never goes above 100 % because the steps are not strictly nested. Next to it, **Otras formas de contactar** (clicks to WhatsApp, phone and email) and **Desde dónde pulsan WhatsApp** (the floating button apart from the other links).
- **Qué hacen en el sitio**: average and median active time, bounce rate and pages per session; **Hasta dónde bajan** (the `scroll` breakdown); the most viewed pages and the landing pages; the services whose card was seen more times and the questions of the FAQ opened more times (named from `src/data/services.js` and `src/data/faq.js`, so a rename there shows up here); and the language.
- **Dispositivos** and **Navegadores**: visitors by type of device and by browser.
- **Velocidad del sitio**: the p75 of LCP, INP, CLS, FCP and TTFB with the limits of good and poor (the same ones that are bucket bounds, see above). A rating is always a word and a sign (✓ Bueno, ! Necesita mejorar, ✕ Malo), never a color alone, and a metric with fewer than 10 measured page views says so.

All the bars of a block share one scale, so they can be compared with each other. Each breakdown holds the top 20 rows.

## CSV export

`GET /api/admin/analytics/export?table=series|<dimension>&from&to&granularity` (`src/pages/api/admin/analytics/export.js`, formatting in `src/server/analytics/csv.js`) downloads one table of the dashboard: `series`, or any dimension of `breakdownDimensions` (`channel`, `path`, `city`...). It takes the same range and granularity as the query API, answers `400` for a wrong `table` or range, and follows the same admin guard. A dimension is exported whole (up to 10000 rows), not only its top 20, and today is included like in the dashboard.

The file is UTF-8 with a byte order mark so Excel shows accents, with `\r\n` line ends, and is named `analytics-<table>-<from>_<to>.csv`. The keys of the rows come from visitors (paths, referrer hosts, cities), so a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'`; otherwise a spreadsheet could run it as a formula.

Nothing is left of REL-50 except what the dashboard (REL-52) will show with these numbers.

## Histograms (median and percentiles)

A median or a percentile of several days cannot be computed from the daily medians, so the daily job also writes one histogram per day and metric into `analytics_distributions` (`src/server/analytics/distribution.js` has the bucket bounds). A range sums the histograms of its days and reads the median (`p50`) and `p75` from the sum, placing the value linearly inside the bucket that holds it, so the error is at most one bucket. Histograms hold no visitor ids and are kept for good, like the totals.

- `engaged_seconds`: the active time of a session, which is the sum of its `engagement` events. A session where the tracker never sent `engagement` (the visitor left too early) has nothing measured and is not counted, so the median is of measured sessions. Bounds: 5, 10, 20, 30, 60, 120, 180, 300, 600, 1200, 1800 and 3600 seconds, plus one bucket above.
- Changing the bounds of a metric would change what the stored days mean: only add metrics.
- Like the totals, today's histograms are recomputed when a range ends today, and the daily job settles yesterday and the day before.

The query API returns them as `distributions` (`{ engaged_seconds: { samples, p50, p75 } }`, a metric with no samples is missing) and, with `compare=previous`, the previous period's in `comparison.distributions` plus `comparison.changes.medianEngagedSeconds`.

## Speed of the page (Core Web Vitals)

The tracker sends one `web_vital` event per page view, the first time the page is hidden (a tab switch or leaving). `props` has the measures the browser could take: `lcp`, `inp`, `fcp` and `ttfb` in milliseconds and `cls` as a score (rounded to three decimals). A browser that does not support a measure leaves it out (Safari has no LCP, INP or CLS), so each metric has its own sample count. Nothing is sent when nothing was measured, or when the visit may not be measured at all.

The daily job turns them into histograms in `analytics_distributions`, with the limit of "good" and of "poor" of each metric as bucket bounds: LCP 2500 and 4000, INP 200 and 500, CLS 0.1 and 0.25, FCP 1800 and 3000, TTFB 800 and 1800. The query API gives the median and p75 of each in `distributions`. INP follows the usual rule: the slowest interaction, ignoring one for every 50. CLS is the worst window of shifts (at most 5 seconds, less than 1 second between shifts).

## Sessions

A session is the same visitor id with less than 30 minutes without events (`SESSION_GAP_MINUTES` in `src/server/analytics/rollup.js`). Sessions are computed by the daily job and stored only as counts.
