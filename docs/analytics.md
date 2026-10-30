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

Not sent yet: `web_vital` (real-user speed) and the `chat_*` events, which arrive with their own tickets.

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
| `web_vital`                                                                              | Real-user speed (`props.name`, `props.value`)            |

Any other event name is rejected. `props` has at most 8 keys and short values.

## Channels

UTM parameters win; otherwise the referrer host decides: `google_maps`, `google_search`, `bing`, `instagram`, `facebook`, `whatsapp`, `other_site`, `direct`, `internal` (navigation inside the site) and `campaign` (any other UTM source). A visit from Google Maps looks like normal Google traffic unless the link in the Business Profile has `?utm_source=google&utm_medium=maps`; the same goes for the Instagram, Facebook and WhatsApp profiles.

## The daily job

A Cloudflare Cron Trigger (`wrangler.jsonc`, `triggers.crons`: 07:30 UTC, which is 01:30 in Monterrey) calls the `scheduled` handler of `src/worker.js`, which runs `runDailyJob` (`src/server/analytics/jobs.js`). In this order:

1. **Totals.** It recomputes yesterday and the day before into `analytics_daily` (one row per day, dimension and key). Recomputing a day gives the same result and replaces the old rows in one statement, so a failed run leaves nothing half done and a rerun is safe. A "day" starts at midnight in Monterrey, the same boundary as the visitor salt.
2. **Salts.** It deletes the salts of earlier days, so the visitor ids of those days can no longer be recomputed.
3. **Retention.** It deletes raw events older than 13 months (`RAW_EVENT_RETENTION_MONTHS`). The daily totals stay for good because they hold no visitor ids.

It logs counts only. If it fails, the run is recorded as failed in Cloudflare (Worker, Settings, Triggers or Observability).

`analytics_daily` dimensions: `total`, `event`, `path`, `channel`, `referrer_host`, `country`, `region`, `city`, `device`, `browser`, `os`, `locale`, `section`, `service`, `faq` and `whatsapp` (by placement). Each row has visitors, sessions, page views, events, engaged seconds and bounces (one page view and less than 10 seconds engaged). Monthly and yearly "visitors" will be the sum of the daily ones: the design cannot recognize the same person on two days.

## The query API

`GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month|year&compare=previous` (`src/pages/api/admin/analytics.js`, logic in `src/server/analytics/query.js`). It is behind the admin guard like every `/api/admin` route and the query is validated with Zod: a wrong one answers `400`. `from` and `to` are swapped when reversed, `to` is cut at today, `from` at the launch day, and a range is at most 1830 days.

The answer has `range`, `through` (the last day with totals), `totals`, `series` (one point per day, week starting Monday, month or year that has data), `breakdowns` (the top 20 keys of each dimension, by visitors) and `comparison` (the previous period of the same length with the change of each number, when `compare=previous`). `bounceRate` is bounces over sessions and `avgEngagedSeconds` is engaged seconds per session.

- **Today is not in the totals.** The daily job writes yesterday and the day before, so the numbers reach yesterday (`through`). Only `live` includes today.
- **`live`** is the count of distinct visitors with an event in the last 30 minutes, read from the raw events and never cached.
- Totals are cached for 3 minutes inside the Worker instance, which is enough because the data changes once a day.
- A monthly or yearly `visitors` is the sum of the daily ones: show it as such.

Not built yet (the rest of REL-50): the CSV export, the median of active time and the speed percentiles.

## Sessions

A session is the same visitor id with less than 30 minutes without events (`SESSION_GAP_MINUTES` in `src/server/analytics/rollup.js`). Sessions are computed by the daily job and stored only as counts.
