# Epi-Watch — Global Disease Outbreak Intelligence

Surveillance dashboard for infectious disease outbreaks worldwide. Tracks, classifies, and
visualises events on a 3D globe with a filterable intelligence feed.

**Live:** https://epi-watch-three.vercel.app

---

## Stack

| Layer      | Technology |
|------------|-----------|
| Frontend   | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Globe      | react-globe.gl · three.js |
| Database   | Prisma ORM · PostgreSQL (Neon) |
| Ingestion  | rss-parser · Axios · Cheerio |
| Video      | YouTube channel Atom feeds (no API key) · `youtube-nocookie` embeds |
| Health     | Daily automated check — see below |
| Monitoring | Sentry (errors, tracing, session replay) |
| Deploy     | Vercel · Vercel Cron (daily) |

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A PostgreSQL database — [Neon](https://neon.tech) has a free tier

### 1 — Clone and install

```bash
git clone https://github.com/mlee75/Epi-watch.git
cd Epi-watch
npm install
```

### 2 — Environment

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` to your PostgreSQL connection string. The schema targets
`postgresql`; there is no SQLite fallback.

### 3 — Database

```bash
npm run db:push   # create tables
npm run db:seed   # load 39 curated outbreak records
```

### 4 — Start

```bash
npm run dev
# → http://localhost:3000
```

---

## Configuration

### `.env.local`

```env
# PostgreSQL connection string (Neon, Supabase, Railway, …)
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# Protects the manual scrape endpoint
SCRAPE_SECRET="your-random-secret"

# Protects the Vercel Cron endpoint
CRON_SECRET="your-random-secret"

# Optional — richer AI summaries; falls back to rule-based when unset
OPENAI_API_KEY=""

# Optional — required only by /api/travel/risk-assessment
ANTHROPIC_API_KEY=""

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Sentry is configured in `sentry.server.config.ts`, `sentry.edge.config.ts` and
`instrumentation-client.ts`. The DSN in those files is public by design. Source-map
upload needs a `SENTRY_AUTH_TOKEN`, supplied by the
[Sentry Vercel integration](https://vercel.com/integrations/sentry) — the wizard also
writes one to `.env.sentry-build-plugin` for local builds, which is gitignored and
excluded from Vercel uploads via `.vercelignore`.

---

## API Reference

### `GET /api/outbreaks`

| Param | Values | Default |
|-------|--------|---------|
| `severity` | `CRITICAL\|HIGH\|MEDIUM\|LOW\|ALL` | `ALL` |
| `region` | `AFRO\|AMRO\|EMRO\|EURO\|SEARO\|WPRO\|ALL` | `ALL` |
| `search` | string (case-insensitive) | — |
| `sort` | `recent\|severity\|cases\|deaths` | `recent` |
| `limit` | clamped to 1–200 | `50` |
| `offset` | clamped to ≥ 0 | `0` |
| `active` | `false` to include inactive | `true` |

Non-numeric or out-of-range `limit`/`offset` fall back to the defaults rather than erroring.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/outbreaks/:id` | Single outbreak |
| `GET /api/outbreaks/:id/sources` | Linked source articles |
| `GET /api/stats` | Aggregate totals by severity, region, disease |
| `GET /api/countries-map` | Per-country severity shading for the globe |
| `GET /api/countries/:code/intelligence` | Country-level detail |
| `GET /api/news/live-feed` | Aggregated outbreak news |
| `GET /api/videos` | Verified video intelligence — see below |
| `GET /api/ai/summary`, `/api/ai/overview`, `/api/ai/chat` | AI narrative layers |
| `GET /api/travel/risk-assessment` | Travel risk scoring (needs `ANTHROPIC_API_KEY`) |

### Protected endpoints

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /api/cron/update` | `Authorization: Bearer <CRON_SECRET>` | Called by Vercel Cron daily at 06:00 UTC |
| `GET /api/scrape` | `Authorization: Bearer <CRON_SECRET>` | Full scraper run |
| `POST /api/scrape` | body `{ "secret": "<SCRAPE_SECRET>" }` | Manual trigger |

```bash
curl -X POST https://epi-watch-three.vercel.app/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"secret":"your-scrape-secret"}'
```

---

## Severity Classification

Derived from reported case and death counts (`lib/classifiers.ts`):

| Severity | Cases | Deaths |
|----------|-------|--------|
| 🔴 CRITICAL | > 10,000 | > 1,000 |
| 🟠 HIGH | > 1,000 | > 100 |
| 🟡 MEDIUM | > 100 | > 10 |
| 🟢 LOW | ≤ 100 | ≤ 10 |

---

## Data Sources

The daily cron (`/api/cron/update`) reads these feeds:

| Source | Feed |
|--------|------|
| CDC — Outbreaks, US Based | `tools.cdc.gov/api/v2/resources/media/285676.rss` |
| Outbreak News Today | `outbreaknewstoday.com/feed/` |
| Google News — outbreak query | `news.google.com/rss/search?q=disease+outbreak` |

The broader scraper (`/api/scrape`, `lib/scrapers/`) additionally targets WHO, PAHO,
CDC MMWR and ProMED. Several of those upstream endpoints have since moved or been
retired, so coverage from that path is partial.

### Verified video intelligence

Outbreak briefings, epidemiological reports and field coverage appear on the
`/videos` page and in a rail beside the article feed on `/news`.

**"Verified" here means one specific thing: the video was published by a
channel on an explicit allowlist.** It attests to *who published a video* — it
is not a fact-check of the contents, and topic labels are inferred from titles.

Sources sit in two tiers, kept distinct because they warrant different trust.
Collapsing them would let a news segment read as an official position, so the
tier is stored on every row and shown as a badge in the UI.

**`OFFICIAL` — public health authorities.** Everything they publish is
health-relevant by definition, so all of it is ingested.

| Authority | Channel | Language |
|-----------|---------|----------|
| WHO | World Health Organization (WHO) | en |
| CDC | Centers for Disease Control and Prevention | en |
| PAHO | PAHO TV | es |
| WHO EMRO | WHO Eastern Mediterranean Region | ar |
| WHO WPRO | WHO Regional Office for the Western Pacific | en |

**`NEWS` — established newsrooms.** Reporting rather than official guidance.
These channels cover every beat, so an item is only ingested when its
**headline** is about health — judged on the headline alone, because
descriptions carry incidental references ("its best year since the pandemic")
that read as topicality but are not.

| Source | Channel | Language |
|--------|---------|----------|
| Reuters | Reuters | en |
| Associated Press | Associated Press | en |
| Al Jazeera English | Al Jazeera English | en |
| DW News | DW News | en |
| franceinfo | franceinfo | fr |
| africanews | africanews | en |
| NHK WORLD-JAPAN | NHK WORLD-JAPAN | en |
| CNA Insider | CNA Insider | en |

Nothing is pulled from open search — there is no code path by which arbitrary
internet video reaches the database. Channels are hardcoded in
`lib/videoSources.ts` rather than resolved from handles at runtime, because
handle resolution was tested and silently returned the wrong channel
(`youtube.com/@WHO` resolves to WHO's regional EMRO channel, not the global
one). Ingestion additionally discards any feed entry whose `channelId` does not
match the allowlist entry that produced the request.

Sourcing uses YouTube's per-channel Atom feeds, so no API key or quota is
needed. Embeds use `youtube-nocookie` and load only on click, so viewing the
page sets no third-party cookies.

A video is linked to an outbreak only when **both** disease and country match
an active record. A disease-only match would attach a general WHO cholera
explainer to an unrelated country's outbreak. Where nothing matches, the topic
fields are stored as `null` rather than a placeholder, so an inference is never
rendered as a claim.

To add a channel: confirm the channel ID resolves to the source you expect by
fetching its feed and reading the `<name>` element, then record that name in
the allowlist entry so it can be re-checked later.

### Live regional TV

A small collapsible panel at the top-left of the globe carries one continuous
news channel per WHO region:

| Region | Channel |
|--------|---------|
| Africa | africanews |
| Americas | ABC News |
| Middle East | Al Jazeera English |
| Europe | DW News |
| Asia-Pacific | NHK WORLD-JAPAN |

Streams are embedded through YouTube's `live_stream?channel=` endpoint, which
resolves whatever a channel is currently broadcasting without an API key. The
panel is collapsed to a strip until a region is selected, so nothing loads from
the video host on page view.

These are **general news channels, not outbreak coverage**, and a stream may be
off air. The panel states both rather than implying continuous outbreak video.

### How counts are handled

Case and death counts are read **only from a source's own headline**. Article bodies
quote many incidental figures, and scanning them reliably picks the wrong one — so
anything a source does not state is stored as `0` and rendered as `—` (unreported)
rather than a confirmed zero. Cron-ingested records are flagged `verified: false` and
carry an **UNVERIFIED** badge in the UI; the 39 seeded records are curated.

---

## Deployment

### Vercel

1. Push to GitHub and import at [vercel.com/new](https://vercel.com/new)
2. Add a PostgreSQL database — the
   [Neon integration](https://vercel.com/marketplace/neon) wires `DATABASE_URL`
   automatically
3. Set `SCRAPE_SECRET` and `CRON_SECRET` in project environment variables
4. Run `npm run db:push && npm run db:seed` locally against the production
   `DATABASE_URL` to create and populate the schema
5. Deploy

`vercel.json` registers one cron job hitting `/api/cron/update` at 06:00 UTC daily.
Vercel's Hobby plan permits only daily crons — a more frequent schedule fails the
deployment and requires Pro.

### Railway / Render

Both auto-detect Next.js. Provision PostgreSQL, set `DATABASE_URL`, and deploy the repo.

---

## Automated health check

A scheduled cloud agent runs a full check every day at **08:00 UTC**, two hours
after the ingestion cron, so a failed ingestion surfaces the same day. It runs
against a fresh checkout plus the public API — it has no database credentials,
so data health is judged from what the site actually serves.

It covers build and typecheck, dead-code candidates, live endpoint and auth
checks, input validation, data freshness (`stats.lastUpdated` against a 26h /
50h threshold), data sanity, upstream feed reachability, and `npm audit`.

Several checks are regression guards for defects this codebase has actually
had, and exist to stop them returning silently:

| Guard | Defect it watches for |
|-------|----------------------|
| `?search=NIGERIA` and `?search=nigeria` must return equal counts | Postgres `contains` is case-sensitive where SQLite was not |
| Non-zero counts whose summary contains no digit | Ingestion once generated random case numbers |
| Every video `channelId` must be on the allowlist | The provenance guarantee of the video feature |
| `stats.total` must equal the `/api/outbreaks` row count | Route handlers prerendered at build time, freezing the counters |

The agent reports only; it does not commit, push, or modify files.

## Known Limitations

- Several upstream WHO, ECDC and ProMED RSS endpoints now return 404; the cron uses the
  three verified feeds listed above.
- Headline-only count extraction is deliberately conservative and leaves many records
  without figures.
- Video topic classification depends on a disease name appearing in the title or
  description. Much of what these channels publish is general health content that names
  no specific disease, so most videos carry no topic label and therefore no outbreak
  link. That is accurate output, not a gap in coverage.
- `/api/outbreaks/:id/sources` is served by a model nothing populates — the
  `OutbreakSource` table is empty. Either wire the scrapers to write to it or remove
  both the route and the model.
- `next@14.2.21` carries a published security advisory; `axios` and `undici` have open
  advisories and are used by the scrapers. Patching means a breaking upgrade to Next 15.
- ESLint is not configured — `npm run lint` drops into Next's interactive setup.

---

## License

No licence file is currently included, so default copyright applies and the code is
**not** licensed for reuse. Add a `LICENSE` file to change that.

---

*Data is aggregated from public health authorities and news sources, and is not a
substitute for official guidance. For authoritative information, consult WHO, CDC, or
your national health authority.*
