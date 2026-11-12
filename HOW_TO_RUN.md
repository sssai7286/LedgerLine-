# Run LedgerLine locally

LedgerLine uses PostgreSQL, Express, React, and Node.js. Install Node.js 18+ and PostgreSQL 14+ first.

## 1. Create the databases

Connect to PostgreSQL as an administrator and run:

```sql
CREATE USER ledgerline WITH PASSWORD 'ledgerline';
CREATE DATABASE ledgerline OWNER ledgerline;
CREATE DATABASE ledgerline_test OWNER ledgerline;
```

Use your own local-only password if desired, then update the database URLs in `.env`.

## 2. Configure the environment

From the project root:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Add `DATABASE_URL`, `DATABASE_TEST_URL`, and `DATABASE_SSL` from `.env.example` to `.env`. Keep any existing `JWT_SECRET`, set a unique secret if needed, and point the test URL at a dedicated database; tests truncate its tables.

## 3. Install packages

```powershell
Set-Location server
npm install
Set-Location ..\client
npm install
```

## 4. Start PostgreSQL and the backend

Make sure PostgreSQL is running, then from the project root:

```powershell
Set-Location server
npm run dev
```

The API applies `server/db/schema.sql` at startup. The API listens at `http://localhost:5000`.

## 5. Start the frontend

Open a second terminal at the project root:

```powershell
Set-Location client
npm start
```

The React app opens at `http://localhost:3000` and proxies `/api` requests to the backend.

## 6. Optional demo data

From a terminal at the project root:

```powershell
Set-Location server
npm run seed
```

**Warning:** seeding truncates all application data. Demo users use `password123`; change those passwords after local testing.

## 7. Run tests

Ensure `DATABASE_TEST_URL` in `.env` points to the dedicated test database, then:

```powershell
Set-Location server
npm test
```

## Useful URLs

| URL | Description |
|---|---|
| `http://localhost:3000` | React frontend |
| `http://localhost:5000/api/health` | API/database health |
| `http://localhost:5000/api/docs` | Swagger API docs |

For Docker, set `JWT_SECRET` and run `docker compose up --build`; the production React app and API are served at `http://localhost:5000`.
