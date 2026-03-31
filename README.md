# Epi-Watch — Global Disease Outbreak Intelligence

Real-time surveillance of infectious disease outbreaks worldwide. Automatically tracks,
classifies, and visualizes events from WHO, CDC, and ProMED — styled as a professional
intelligence dashboard.

---

## Screenshots

- **Map** — Dark CartoDB map with color-coded severity markers
- **Intelligence Feed** — Card-based outbreak reports with filtering & live refresh
- **Stats Bar** — Global totals: cases, deaths, countries affected

---

## Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Map       | Leaflet.js · CartoDB Dark Matter tiles (free, no key) |
| Database  | Prisma ORM · SQLite (local) · PostgreSQL (production) |
| Scraping  | Axios · Cheerio |
| Deploy    | Vercel (frontend + API) · Vercel Cron (hourly scrape) |

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm 9+

### 1 — Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/epi-watch.git
cd epi-watch
npm install
```

### 2 — Environment

```bash
cp .env.example .env.local
# No changes needed for local development with SQLite
```

### 3 — Database

```bash
# Push schema to SQLite
npm run db:push

# Seed with 20 realistic outbreak examples
npm run db:seed
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
# SQLite for local dev (no setup required)
DATABASE_URL="file:./dev.db"

# Secret for manual scrape triggers
SCRAPE_SECRET="your-random-secret"

# Optional: richer AI summaries (leave blank to use rule-based)
OPENAI_API_KEY=""

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Triggering a Scrape

**Manually** (via HTTP):
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"secret":"your-random-secret"}'
```

**Response:**
```json
{
  "success": true,
  "durationMs": 12450,
  "added": 7,
  "skipped": 3,
  "sources": { "WHO": 8, "CDC": 2, "ProMED": 0 }
}
```

---

## API Reference

### `GET /api/outbreaks`

| Param | Values | Default |
|-------|--------|---------|
| `severity` | `CRITICAL\|HIGH\|MEDIUM\|LOW\|ALL` | `ALL` |
| `region` | `AFRO\|AMRO\|EMRO\|EURO\|SEARO\|WPRO\|ALL` | `ALL` |
| `search` | string | — |
| `sort` | `recent\|severity\|cases\|deaths` | `recent` |
| `limit` | 1–200 | `50` |
| `offset` | integer | `0` |

### `GET /api/outbreaks/:id`

Single outbreak by ID.

### `GET /api/stats`

Aggregate statistics: totals by severity, total cases/deaths, countries affected.

### `GET /api/scrape` *(Vercel Cron)*

Triggered by Vercel Cron every hour. Requires `Authorization: Bearer <CRON_SECRET>` header.

### `POST /api/scrape`

Manual scrape trigger. Body: `{ "secret": "your-scrape-secret" }`

---

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**
2. **Import to Vercel** at vercel.com/new
3. **Add environment variables** in Vercel dashboard:
   ```
   DATABASE_URL=postgresql://...   # see below
   SCRAPE_SECRET=<random string>
   CRON_SECRET=<same or different random string>
   ```
4. **Database — Neon (free PostgreSQL)**:
   - Create account at neon.tech
   - Create a project → copy the connection string
   - In `prisma/schema.prisma`, change `provider = "sqlite"` → `provider = "postgresql"`
   - Run `npx prisma db push` (from your local machine with the production DATABASE_URL)
   - Run `npm run db:seed` to populate initial data
5. **Deploy** → Vercel will build and deploy automatically

> The `vercel.json` already configures a cron job that calls `/api/scrape` every hour.

### Railway (Alternative backend)

1. Create a Railway project
2. Add a PostgreSQL service
3. Set `DATABASE_URL` from Railway's connection string
4. Deploy the repo — Railway auto-detects Next.js

### Render (Alternative)

Similar to Railway. Use Render's free PostgreSQL (90-day free tier) and deploy the
Next.js app as a Web Service.

---

## Switching from SQLite to PostgreSQL

1. Change `prisma/schema.prisma`:
   ```diff
   datasource db {
   -  provider = "sqlite"
   +  provider = "postgresql"
      url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` to your PostgreSQL connection string in `.env.local`
3. Run `npm run db:push` to migrate schema
4. Run `npm run db:seed` to seed data

---

## Severity Classification

| Severity | Cases | Deaths |
|----------|-------|--------|
| 🔴 CRITICAL | > 10,000 | > 1,000 |
| 🟠 HIGH | > 1,000 | > 100 |
| 🟡 MEDIUM | > 100 | > 10 |
| 🟢 LOW | ≤ 100 | ≤ 10 |

---

## Data Sources

| Source | URL | Frequency |
|--------|-----|-----------|
| WHO Disease Outbreak News | who.int/emergencies/disease-outbreak-news | Daily |
| CDC Outbreak Reports | cdc.gov/outbreaks | Daily |
| ProMED Mail | promedmail.org | Multiple/day |

---

## License

MIT — free to use, modify, and deploy.

---

*Data is aggregated from public health authorities. For official health guidance,
always consult WHO, CDC, or your national health authority.*
