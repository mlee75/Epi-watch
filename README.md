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

The `/videos` page carries outbreak briefings and field reports published by
health authorities. **"Verified" here means one specific thing: the video was
published by a channel on an explicit allowlist**, every entry of which belongs
to a named health authority. It attests to *who published a video* — it is not
a fact-check of the contents, and topic labels are inferred from titles.

| Authority | Channel | Language |
|-----------|---------|----------|
| WHO | World Health Organization (WHO) | en |
| CDC | Centers for Disease Control and Prevention | en |
| PAHO | PAHO TV | es |
| WHO EMRO | WHO Eastern Mediterranean Region | ar |

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

To add a channel: confirm the channel ID resolves to the authority you expect
by fetching its feed and reading the `<name>` element, then record that name in
the allowlist entry so it can be re-checked later.

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

## Known Limitations

- Several upstream WHO, ECDC and ProMED RSS endpoints now return 404; the cron uses the
  three verified feeds listed above.
- Headline-only count extraction is deliberately conservative and leaves many records
  without figures.
- Video topic classification depends on a disease name appearing in the title or
  description. Much of what these channels publish is general health content that names
  no specific disease, so most videos carry no topic label and therefore no outbreak
  link. That is accurate output, not a gap in coverage.
- `components/Map.tsx` (Leaflet) is not rendered anywhere — the homepage uses the 3D
  globe. It remains in the tree along with its dependencies.
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
