# PostgreSQL database layer

LedgerLine stores users, accounts, transactions, journal entries, and audit logs in PostgreSQL. `config/db.js` creates a shared `pg` connection pool and applies `schema.sql` before the API starts.

## Money movement

Each money operation runs in one SQL transaction:

1. Lock the affected accounts and validate ownership, currency, and balance.
2. Insert the transaction and its journal entries.
3. Update account balances and append the audit event.
4. Commit, or roll back all changes on failure.

The deferred constraint trigger checks that each transaction's journal entries sum to zero. Deposits and withdrawals balance against an external clearing leg (`journal_entries.account_id IS NULL`); transfers and manual journal transactions balance between accounts. Account balances sum only entries assigned to that account.

## Amounts and concurrency

Amounts are stored as integer cents (or the currency's smallest unit). Account rows are locked during writes so concurrent withdrawals cannot spend the same funds. A unique idempotency key prevents duplicate postings.

## Schema and setup

`schema.sql` is applied on backend startup. Configure `DATABASE_URL` for the application and a separate `DATABASE_TEST_URL` for tests. The test suite truncates tables in the configured test database.

`npm run seed` clears and reloads the configured application database with demo users and accounts; do not run it against data you need to keep.
