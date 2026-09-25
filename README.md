# Quantish

A small bill of quantities platform, built for the ImagineY Quantus code assignment.

Architects organise a bill of quantities as a tree of **articles** (for example `20.` Masonry, `20.10.` Load-bearing walls, `20.10.10.` Interior walls). Objects from the drawing, such as walls, doors and windows, are assigned to those articles. Each object has a unit, a measured quantity and a unit price, and every article's total is the sum of its own objects plus everything underneath it.

The project is a NestJS REST API on PostgreSQL, a Vue frontend, and a Docker Compose file that starts all of it.

---

## Contents

1. [Quick start](#quick-start)
2. [What to try first](#what-to-try-first)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Local development](#local-development)
6. [Tests](#tests)
7. [API reference](#api-reference)
8. [Data model](#data-model)
9. [Decisions and reasoning](#decisions-and-reasoning)
10. [Assumptions](#assumptions)
11. [Known limitations](#known-limitations)
12. [Future improvements](#future-improvements)
13. [About this submission](#about-this-submission)

---

## Quick start

The only requirement is Docker (Docker Desktop, or Docker Engine with Compose v2).

```bash
git clone <repo-url> quantish
cd quantish

# Create your environment file from the example
cp .env.example .env
# (Windows PowerShell: Copy-Item .env.example .env)

# Build and start the database, API and frontend
docker compose up --build -d

# Load the demo bill of quantities
docker compose exec api npm run db:seed
```

Then open

| What         | Where                        |
| ------------ | ---------------------------- |
| Frontend     | http://localhost:8080        |
| API          | http://localhost:3000        |
| Health check | http://localhost:3000/health |

The services start in order. Postgres has a health check, the API waits until the database accepts connections, runs any pending migrations and then starts, and the frontend waits until the API's own health check passes. The first build takes a few minutes.

The seed script **resets** the database to the demo data every time it runs. To remove everything, including the database volume, run `docker compose down -v`.

---

## What to try first

1. Open the **Bill of quantities** page. The demo bill describes a small detached house with masonry, concrete works and joinery. Notice the blue notice saying three objects are not yet assigned.
2. Open **20.10.10. Interior walls, 14cm snelbouw** to see its objects with quantities, unit prices and line totals.
3. Try **bulk assignment by criteria**, the brief's own example ("all walls with a thickness of 14cm go to this article"). Find the id of `20.10.10.` with `GET /articles`, then

   ```bash
   curl -X POST http://localhost:3000/objects/assign \
     -H "Content-Type: application/json" \
     -d '{"articleId":"<id of 20.10.10.>","type":"wall","properties":{"thickness":0.14}}'
   ```

   Two walls are assigned (the unassigned window is not, because it isn't a wall), and the totals on the Summary page go up.
4. Delete an article and check its objects. They survive as unassigned objects rather than disappearing.

`api/requests.http` contains ready-made requests for every endpoint. With the VS Code REST Client extension installed, each one can be sent with a click.

---

## Tech stack

| Layer     | Choice                                        |
| --------- | --------------------------------------------- |
| API       | NestJS, TypeScript, ES modules                |
| Database  | PostgreSQL 16                                 |
| ORM       | Drizzle ORM with drizzle-kit migrations       |
| Money     | Postgres `numeric` and `decimal.js`           |
| Frontend  | Vue 3 (Composition API), TypeScript, Vite     |
| Serving   | nginx for the built frontend                  |
| Tests     | Vitest and Supertest                            |
| Runtime   | Node.js 26.10 (pinned in `.nvmrc`)            |

---

## Project structure

```
quantish/
├── docker-compose.yml       db, api and web services
├── .env.example             copy to .env
├── .nvmrc                   Node version
├── api/                     NestJS backend
│   ├── Dockerfile           multi-stage build, runs as a non-root user
│   ├── drizzle/             generated SQL migrations (committed)
│   ├── drizzle.config.ts
│   ├── requests.http        example requests for every endpoint
│   ├── src/
│   │   ├── main.ts          bootstrap and startup migrations
│   │   ├── app.setup.ts     shared app configuration (used by tests too)
│   │   ├── config/          environment validation
│   │   ├── db/              schema, database module, seed, error helpers
│   │   ├── articles/        articles CRUD and code rules
│   │   ├── objects/         objects CRUD, type rules and bulk assignment
│   │   ├── summary/         totals roll-up and the /summary endpoint
│   │   └── health/          health check
│   └── test/                end-to-end tests
└── web/                     Vue frontend
    ├── Dockerfile           builds the app, serves it with nginx
    ├── nginx.conf           serves files and forwards /api to the API
    └── src/
        ├── api/             typed API client and response types
        ├── composables/     loading and error state helper
        ├── components/      shared components
        ├── lib/             formatting, code and text helpers
        └── views/           the four screens
```

The backend is organised by feature rather than by layer, so everything about articles (controller, service, DTOs, rules) lives together.

---

## Local development

For day-to-day work, run the database in Docker and the API and frontend directly on your machine. You get instant reloads without rebuilding images.

Use Node 26.10 (`nvm use` picks it up from `.nvmrc`).

```bash
# 1. Database only
docker compose up -d db

# 2. API on http://localhost:3000
cd api
npm install
npm run start:dev

# 3. Frontend on http://localhost:5173 (in a second terminal)
cd web
npm install
npm run dev
```

In development, Vite forwards every `/api/...` request to the API on port 3000. In Docker, nginx does the same. The frontend code is identical in both and never needs to know where the API lives, and since the browser only ever talks to one origin, no CORS configuration is needed.

### Useful API scripts

| Script                  | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run start:dev`     | Start the API with reload on change                     |
| `npm run build`         | Compile to `dist/`                                      |
| `npm test`              | Unit tests                                              |
| `npm run test:e2e`      | End-to-end tests against the test database              |
| `npm run db:generate`   | Generate a migration after changing `schema.ts`         |
| `npm run db:studio`     | Browse the tables in the browser                        |
| `npm run db:seed:local` | Build and seed from your machine                        |
| `npm run db:seed`       | Seed from inside the container (expects a built `dist`) |

### Environment variables

| Variable            | Used by                        | Purpose                                         |
| ------------------- | ------------------------------ | ----------------------------------------------- |
| `POSTGRES_USER`     | Postgres container, Compose    | Database user                                   |
| `POSTGRES_PASSWORD` | Postgres container, Compose    | Database password                               |
| `POSTGRES_DB`       | Postgres container, Compose    | Database name                                   |
| `POSTGRES_PORT`     | Compose                        | Port Postgres is published on, on your machine  |
| `DATABASE_URL`      | API and tools run on your host | Connection string pointing at `localhost`       |
| `TEST_DATABASE_URL` | End-to-end tests               | A separate database that the tests may wipe     |

Inside Docker, Compose builds the API's `DATABASE_URL` itself from the Postgres variables, pointing at the `db` service instead of `localhost`. Real environment variables take priority over the `.env` file, so the same code picks up the right value in both places. The API refuses to start if `DATABASE_URL` is missing or isn't a Postgres URL.

---

## Tests

The end-to-end tests truncate tables before every test, so they use their own database. Create it once

```bash
docker compose up -d db
docker compose exec db createdb -U quantish quantish_test
```

and make sure `TEST_DATABASE_URL` is set in `.env` (it is in `.env.example`). Then, from `api/`

```bash
npm test            # unit tests
npm run test:e2e    # end-to-end tests
```

The e2e suite refuses to run if `TEST_DATABASE_URL` is missing or equal to `DATABASE_URL`, so it can never wipe development data by accident.

### What's covered

**Unit tests for the roll-up** (`src/summary/rollup.spec.ts`), the function that turns per-article sums into totals including all sub-articles.

- An article's total includes its own objects and every descendant, three levels deep
- Separate branches stay separate
- An article without objects totals zero
- Decimal addition is exact (`0.1 + 0.2` gives `0.3`, not `0.30000000000000004`)
- A cycle in the data throws instead of looping forever

**End-to-end tests for `GET /summary`** (`test/summary.e2e-spec.ts`), which run the real app, with its real validation, against a real database over HTTP.

- An empty bill returns zero
- Nested articles roll up into their top-level subtotal, in code order, and unassigned objects are excluded from the grand total
- Each line is rounded before summing (three lines of 1.5 × €1.11 total €5.01, not €5.00)
- Deleting a sub-article removes its amounts from the totals but keeps its objects as unassigned

---

## API reference

All requests and responses are JSON.

### Articles

| Method   | Path            | Description                                                    |
| -------- | --------------- | -------------------------------------------------------------- |
| `GET`    | `/articles`     | The whole bill as a nested tree, each article with its `total` |
| `GET`    | `/articles/:id` | One article with its total, sub-articles and own objects       |
| `POST`   | `/articles`     | Create an article                                              |
| `PATCH`  | `/articles/:id` | Update any subset of fields                                    |
| `DELETE` | `/articles/:id` | Delete an article and its sub-articles, keeping their objects  |

```json
{
  "code": "20.10.30.",
  "title": "Interior walls, 9cm",
  "description": "<p>Optional rich text</p>",
  "parentId": "5b0c...optional, omit for a top-level article"
}
```

### Objects

| Method   | Path              | Description                                               |
| -------- | ----------------- | --------------------------------------------------------- |
| `GET`    | `/objects`        | List objects, filtered by `articleId`, `type`, `unassigned=true` |
| `GET`    | `/objects/:id`    | One object                                                |
| `POST`   | `/objects`        | Create an object, optionally with its UUID from the drawing |
| `POST`   | `/objects/assign` | Assign every object matching a type and properties to an article |
| `PATCH`  | `/objects/:id`    | Update, reassign (`articleId`) or unassign (`articleId: null`) |
| `DELETE` | `/objects/:id`    | Delete an object                                          |

```json
{
  "id": "3f1c2b8e-1111-4a5b-9c3d-000000000001",
  "articleId": "5b0c...",
  "name": "W-01 Living room partition",
  "type": "wall",
  "unit": "m2",
  "quantity": 18.36,
  "unitPrice": 92.5,
  "properties": { "thickness": 0.14, "height": 2.7 }
}
```

Types are `wall`, `door`, `window` and `slab`. Units are `m`, `m2`, `m3`, `kg` and `piece`.

### Summary and health

| Method | Path       | Description                                             |
| ------ | ---------- | ------------------------------------------------------- |
| `GET`  | `/summary` | Subtotal for every top-level article and a grand total  |
| `GET`  | `/health`  | Liveness check, used by Docker                          |

```json
{
  "currency": "EUR",
  "articles": [
    { "id": "...", "code": "20.", "title": "Masonry", "subtotal": "28915.05" },
    { "id": "...", "code": "30.", "title": "Concrete works", "subtotal": "6301.10" }
  ],
  "grandTotal": "35216.15"
}
```

(Illustrative values.)

### Conventions

- **Decimals go in as numbers and come out as strings.** Quantities and prices are accepted as plain JSON numbers for convenience. Every decimal in a response (`quantity`, `unitPrice`, `lineTotal`, `total`, `subtotal`, `grandTotal`) is a string, so no precision is lost to floating point on the way to the client.
- **Validation** rejects unknown properties rather than silently dropping them, so a typo like `tittle` is caught.
- **Errors** follow Nest's standard shape, `{ "statusCode", "message", "error" }`, where `message` lists every failed rule for validation errors.

| Status | When                                                                   |
| ------ | ---------------------------------------------------------------------- |
| `400`  | Invalid body or query, a code that doesn't fit its parent, a parent or article that doesn't exist |
| `404`  | The article or object in the URL doesn't exist                         |
| `409`  | Duplicate article code or object UUID, or moving an article that has sub-articles |

---

## Data model

```
articles                                 objects
────────────────────────────────         ──────────────────────────────────────
id           uuid         PK             id          uuid           PK
parent_id    uuid         FK, nullable   article_id  uuid           FK, nullable
code         text         unique         name        text
title        text                        type        text
description  text         nullable       unit        enum           m, m2, m3, kg, piece
created_at   timestamptz                 quantity    numeric(14,3)
updated_at   timestamptz                 unit_price  numeric(12,4)
                                         line_total  numeric(14,2)  generated
                                         properties  jsonb
                                         created_at  timestamptz
                                         updated_at  timestamptz
```

- `articles.parent_id` points at another article. `NULL` means a top-level article. Deleting an article **cascades** to its sub-articles.
- `objects.article_id` points at the article an object is assigned to. `NULL` means unassigned. Deleting an article **sets it to `NULL`**, so objects are kept.
- `line_total` is a generated column, `round(quantity * unit_price, 2)`, computed by Postgres on every insert and update.
- `parent_id` and `article_id` are indexed, since tree walks and "objects in this article" use them constantly. Postgres indexes primary keys and unique columns automatically, but not foreign keys.
- Check constraints reject negative quantities and prices, and any `piece` object whose quantity isn't 1, even if the API is bypassed.

The generated SQL is in `api/drizzle/` and the TypeScript definition in `api/src/db/schema.ts`.

---

## Decisions and reasoning

### Articles form a tree with a `parent_id` column

This is the simplest tree representation (an adjacency list). Moving an article is a one-column update, and it maps directly onto the brief's folder analogy. The alternatives are Postgres `ltree` or storing the full path on every row, which make some subtree queries faster but add complexity that a bill of a few hundred articles doesn't need.

### Articles have an `id` separate from their `code`

Codes are what people see and they do get renumbered. If the code were the primary key, every renumbering would ripple through every foreign key. A generated UUID never changes.

### Totals are calculated, never stored

A stored total goes stale the moment someone edits an object. Calculating on read means the totals are always correct. The cost is some work on every request, which is negligible at this size (see [Known limitations](#known-limitations)).

### Money is exact from database to screen

Money never passes through a JavaScript float.

1. Quantities and prices are stored as Postgres `numeric`, which is exact decimal arithmetic.
2. Postgres calculates each line total in a generated column and rounds it to cents there.
3. One `GROUP BY` query sums the line totals per article.
4. A pure function rolls those sums up the tree using `decimal.js`.
5. The API returns every amount as a string.
6. The frontend only formats numbers for display. Its one sum (an article's own objects) adds whole cents, which are integers and therefore exact.

### Each line is rounded before summing

A bill of quantities prints an amount on every line, and the printed lines must add up to the printed total. Rounding only the final total can break that. Three lines of 1.5 × €1.11 each show €1.67, so the total must be €5.01, while rounding only at the end would give €5.00. Postgres rounds half away from zero. This case has its own test.

### One roll-up function feeds every screen

The summary endpoint, the article tree and the article detail page all use the same `rollUpTotals` function, so they can never disagree. Because it's a pure function with no database, it's also easy to unit test.

### Deleting an article keeps its objects

Objects mirror real elements in the drawing. Removing a line from the cost document doesn't remove the wall from the building, so the objects become unassigned and wait to be allocated elsewhere. Sub-articles, on the other hand, only exist inside the bill, so they are deleted with their parent.

### Quantity is stored as measured, not calculated

The brief says quantities are derived from the object's properties in the drawing and that this part may be mocked. The API therefore stores the measured quantity directly, as if supplied by the drawing. Recalculating it from dimensions would be wrong, because the IFC standard's base quantities distinguish between gross values and net values that account for openings. A wall with a window in it has a net area smaller than length × height, and Vectorworks already calculates that. See [Qto_WallBaseQuantities](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/Qto_WallBaseQuantities.htm).

For the same reason, a small set of descriptive properties (a wall's thickness, a door's width) is stored for **assignment criteria and display**, not for the quantity.

### Units are a database enum, types are validated in the API

The unit drives the calculation, so the database itself enforces the list and "m2" can never drift into "m²". Object types don't affect any calculation and the list will grow, so they're validated in the API, where adding one is a one-line change with no migration.

### Type-specific properties live in a JSONB column

Walls have a thickness, doors have a width. The options were nullable columns on `objects` (a table full of mostly empty columns), a table per type (a new table and extra joins for every new type), or JSONB. JSONB stays flexible, and Postgres can still query inside it, which is exactly what bulk assignment needs (`properties @> '{"thickness": 0.14}'`). The trade-off is that the database doesn't enforce the shape, so the API validates it per type.

### Article codes are validated against their parent

A code is groups of one to three digits, each ending in a dot, such as `20.` or `20.11.10.`, matching the brief's examples. A top-level article has one group, and a sub-article extends its parent's code by exactly one group. Codes are unique, and the uniqueness is enforced by the database, so two simultaneous requests can't both succeed. The frontend repeats these rules for instant feedback, but the API has the final say.

### Articles with sub-articles can't be moved or renumbered yet

Moving or renumbering an article would leave its children's codes inconsistent. Renumbering a whole subtree is possible but not trivial, so for this version the API returns a `409` instead. This rule also makes cycles impossible, since an article can only be moved under one of its own descendants if it has descendants. The roll-up function still guards against cycles in case bad data ever gets in.

### Bulk assignment only picks up unassigned objects by default

A broad rule such as "all walls" could otherwise silently pull objects out of articles they were deliberately placed in. `includeAssigned: true` opts in.

### Migrations run when the API starts

This keeps "clone and `docker compose up`" to a single command. Drizzle records which migrations have run, so it's safe on every start. If several API replicas started at once they would race, which is fine for a single-instance deployment and listed under limitations.

### ES modules on Node 26

Recent NestJS packages ship as ES modules, and the project uses ES modules throughout to match. Node 26 was chosen over Node 24 LTS because the tooling needed a newer Node to load those packages cleanly. The version is pinned in `.nvmrc`, in the `engines` field of both `package.json` files, and in both Dockerfiles, so a mismatch fails early with a clear message.

### The frontend is served by nginx, not the Vite dev server

Docker runs what would actually be deployed. Vite builds static files (after a type check, so type errors fail the build), and nginx serves them and forwards `/api` to the API container. The dev server remains a local development tool.

### No global store in the frontend

Each screen loads its own data through a small `useAsync` helper that handles loading, errors and retries. With no state shared between screens, a store like Pinia would be machinery without a job.

### Design

A bill of quantities is a document, not a dashboard, so every screen uses the same ledger style. Article codes on the left in a monospaced face, titles in the middle, amounts right-aligned in tabular figures so the digits line up. Hierarchy is shown through indentation and weight rather than nested boxes. One accent colour marks everything clickable. Amounts are never coloured, because in a cost document colour suggests good or bad, and a subtotal is neither.

Numbers and currency use Belgian formatting (`€ 1.234,56`), units are shown as people write them (`m²` rather than `m2`), and new article codes are suggested in steps of 10, as bills usually leave room to insert articles later. Every screen has loading, empty and error states, keyboard focus is always visible, tables scroll within their own box on small screens, and the summary prints cleanly.

---

## Assumptions

The brief leaves some gaps deliberately. These are the assumptions I made, and why.

| Assumption | Reasoning |
| --- | --- |
| An object belongs to at most one article. | The brief compares articles to folders and objects to files, and a file lives in one folder. Counting an object twice would also double its cost. |
| An article can hold objects and sub-articles at the same time. | Folders can hold both files and folders, and the brief doesn't restrict it. Totals include both. |
| An article's total includes every sub-article, at any depth. | That's what a subtotal means in a bill of quantities, and it's how the brief's nesting example reads. |
| The unit price is a property of the object. | The brief says an object defines a name, type, unit and unit price. |
| Quantities come from the drawing and are mocked. | The brief allows mocking this. The API stores the measured value as if supplied by the drawing (see [Decisions](#quantity-is-stored-as-measured-not-calculated)). |
| Object UUIDs are created by the drawing, not by this system. | The brief says each object in the drawing is identified by a UUID. The API accepts it, and generates one only if none is supplied. |
| Codes follow the brief's format, including the trailing dot. | Taken directly from the examples `20.`, `20.11.` and `20.11.10.`. |
| Unassigned objects are not part of the bill. | An object only has a place in the cost document once it's assigned to an article. They're listed separately in the UI. |
| Everything is priced in euros. | Quantus is used in Belgium. |
| A `piece` object has a quantity of 1. | Each object represents one physical element. |
| Descriptive properties are in metres. | One unit keeps criteria like "thickness 0.14" unambiguous. |
| The description's rich text is stored as sanitised HTML. | The brief says rich text, and HTML is what rich text editors produce. It's sanitised on the way in, so it's safe to render. |
| There is a single bill and a single user, with no authentication. | Out of scope for this exercise. |

The demo data describes a small detached house. Masonry prices are based on published Belgian price ranges for snelbouw blocks and facing brick. Prices in the other chapters are illustrative.

---

## Known limitations

- **The UI covers the brief's three screens plus a summary.** Viewing the bill, creating articles and viewing an article's objects are in the frontend. Editing articles, creating and editing objects, and bulk assignment are available through the API only.
- **Articles with sub-articles can't be moved or renumbered** (see [Decisions](#articles-with-sub-articles-cant-be-moved-or-renumbered-yet)).
- **Totals are recalculated on every request**, loading all articles each time. That's instant for hundreds of articles but would need caching or a SQL-side roll-up at a much larger scale.
- **The summary reads articles and objects in two queries** outside a transaction, so a write landing between them could produce a momentarily inconsistent result.
- **Migrations run on startup**, which would race with several API replicas.
- **Descriptions are entered as plain text** in the UI and converted to paragraphs. There is no rich text editor yet.
- **Node 26** is the current release line and moves to long-term support in October 2026.

---

## Future improvements

**Closer to the real product**

- A sync endpoint that accepts an export from Vectorworks and creates or updates objects by UUID
- Stored assignment rules that are re-applied automatically after every sync, with a preview of which objects match
- Multiple projects and bills, with authentication and permissions

**Features**

- Object management in the UI, including drag and drop between articles and bulk assignment
- Editing articles in the UI, with a proper rich text editor such as Tiptap
- Moving and renumbering whole subtrees
- Export to CSV and PDF
- Dutch and French interface labels
- Soft delete or an audit trail on articles and objects
- Dark mode

**Engineering**

- Read the summary inside a single transaction for a consistent snapshot
- Cache or materialise totals if bills grow very large, and measure the summary query with a large seed
- OpenAPI documentation generated from the DTOs
- Frontend component tests
- A CI pipeline running lint, type checks and tests on every push
- Run migrations as a separate one-off step in deployment rather than on startup
- Pagination on the objects endpoint

---

## About this submission

NestJS and Vue were both new to me when I started, and I had only used TypeScript and PostgreSQL lightly. This took longer than the suggested four hours as a result, and the commit history shows that learning curve honestly.

I used an AI assistant as a tutor and reviewer while learning the stack. I've gone through every file, and I'm happy to walk through any part of the code and the reasoning behind each decision.
