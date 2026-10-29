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

## Sessions and daily numbers

A session is the same visitor id with less than 30 minutes without events. Sessions and daily rollups are computed from the events by the aggregation job (REL-50), together with the retention rules.
