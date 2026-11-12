# LedgerLine

LedgerLine is a PERN (PostgreSQL, Express, React, Node.js) financial ledger for double-entry bookkeeping.

## Features

- JWT authentication and server-enforced role-based access for account holders, admins, and auditors.
- Account creation, balance checks, account statements, deposits, withdrawals, and same-currency transfers.
- Balanced double-entry journal entries and database checks that reject unbalanced transactions.
- Atomic PostgreSQL transactions, idempotency keys, row locking, and server-side overdraft protection.
- Append-only audit records enforced by database triggers and available to admins and auditors.
- Responsive React dashboard, currency dropdowns, transaction search and type filters, and API-backed operation forms.
- Automated authentication, authorization, account ownership, transaction, idempotency, and concurrency tests.
- Docker Compose deployment, seeded demo users/accounts, and interactive OpenAPI documentation.

## Requirements

- Node.js 18 or later
- PostgreSQL 14 or later

## Local setup

1. Create a PostgreSQL user and the application databases:

   ```sql
   CREATE USER ledgerline WITH PASSWORD 'ledgerline';
   CREATE DATABASE ledgerline OWNER ledgerline;
   CREATE DATABASE ledgerline_test OWNER ledgerline;
   ```

2. If `.env` does not exist, copy `.env.example` to `.env`. Otherwise, add `DATABASE_URL`, `DATABASE_TEST_URL`, and `DATABASE_SSL` from the example without replacing your existing `JWT_SECRET`. Keep the test URL pointed at a dedicated database.
3. Install dependencies:

   ```powershell
   Set-Location server
   npm install
   Set-Location ..\client
   npm install
   ```

4. Start the API (it creates or updates the database schema on startup):

   ```powershell
   Set-Location server
   npm run dev
   ```

5. In another terminal, start React:

   ```powershell
   Set-Location client
   npm start
   ```

6. Optionally add demo users and accounts:

   ```powershell
   Set-Location server
   npm run seed
   ```

   **Warning:** seeding truncates existing application data. Demo users share the password `password123`; change it after local testing.

The React app runs at `http://localhost:3000`; the API runs at `http://localhost:5000`. Registration creates account-holder users only. At sign-in, choose **User login**, **Admin login**, or **Auditor login**. The API checks that the selected login type matches the account's assigned role; choosing a login type does not grant that role.

## API

All protected routes use `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register an account holder |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Get the current user |
| GET, POST | `/api/accounts` | List or create accounts |
| GET | `/api/accounts/:id/balance` | Read a balance and verify it against journal entries |
| GET | `/api/accounts/:id/statement` | Read an account statement |
| POST | `/api/ledger/deposit` | Deposit funds |
| POST | `/api/ledger/withdraw` | Withdraw funds |
| POST | `/api/ledger/transfer` | Transfer between accounts |
| GET, POST | `/api/transactions` | List transactions or post balanced journal entries |
| GET | `/api/transactions/:id/entries` | Read a transaction and its entries |
| GET | `/api/audit` | Read audit logs (admin/auditor only) |
| GET | `/api/health` | Check API and database connectivity |

Interactive API documentation is available at `http://localhost:5000/api/docs`.

All amounts are integer cents. Positive journal amounts are debits; negative amounts are credits. Each transaction's entries sum to zero. Account balances exclude external clearing entries.

On the dashboard, use **Statement** on an account card to view that account's ledger activity. The Operations screen filters available accounts to the selected currency; transfers require both accounts to use the same currency.

The repository does not currently include a recorded demo video.

## Tests

Set `DATABASE_TEST_URL` to a dedicated test database before running:

```powershell
Set-Location server
npm test
```

The test setup truncates tables in the configured test database.

## Docker

Set `JWT_SECRET` in the environment (or root `.env`) and run:

```powershell
docker compose up --build
```

The bundled PostgreSQL database and production React/API server are available at `http://localhost:5000`.
