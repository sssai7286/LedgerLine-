-- ============================================================
-- Financial Ledger System – PostgreSQL DDL
-- Double-Entry Bookkeeping Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. accounts
--    Stores each account belonging to a user.
--    currency uses ISO 4217 (e.g. 'USD', 'EUR', 'INR').
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID            NOT NULL,
    currency    VARCHAR(3)      NOT NULL CHECK (char_length(currency) = 3),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index for fast look-ups by owner
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON accounts (owner_id);

-- ------------------------------------------------------------
-- 2. transactions
--    A logical financial event (e.g. "Pay vendor invoice #42").
--    idempotency_key prevents duplicate submissions from clients.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key  VARCHAR(255)    NOT NULL UNIQUE,
    description      TEXT,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index for idempotency look-up
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions (idempotency_key);

-- ------------------------------------------------------------
-- 3. journal_entries
--    Each row is one "leg" of a double-entry transaction.
--
--    amount is BIGINT representing the smallest currency unit
--    (cents for USD, paise for INR, etc.) to eliminate all
--    floating-point rounding errors.
--
--    Convention:
--      amount > 0  →  DEBIT  (money coming into the account)
--      amount < 0  →  CREDIT (money leaving the account)
--
--    The critical invariant for double-entry integrity is:
--      SUM(amount) = 0  for all entries in a transaction
--    This is enforced by the application layer (see transactionController)
--    and optionally by a deferred constraint trigger below.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id      UUID        NOT NULL REFERENCES accounts(id)     ON DELETE RESTRICT,
    amount          BIGINT      NOT NULL CHECK (amount <> 0),  -- zero-amount legs are meaningless
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_je_transaction_id ON journal_entries (transaction_id);
CREATE INDEX IF NOT EXISTS idx_je_account_id     ON journal_entries (account_id);

-- ------------------------------------------------------------
-- 4. Balanced-transaction enforcement (database level)
--
--    A DEFERRED CONSTRAINT TRIGGER fires after each transaction
--    is committed. It verifies that SUM(amount) = 0 for every
--    transaction that was touched in the current statement.
--    If not balanced, the entire transaction is rolled back.
--
--    This is the gold-standard approach: it lets you insert all
--    legs first, then validates the invariant once at commit time.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_transaction_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql AS
$$
DECLARE
    v_sum BIGINT;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
      INTO v_sum
      FROM journal_entries
     WHERE transaction_id = NEW.transaction_id;

    IF v_sum <> 0 THEN
        RAISE EXCEPTION
            'Unbalanced transaction: transaction_id=% has a net amount of % (must be 0).',
            NEW.transaction_id, v_sum;
    END IF;

    RETURN NEW;
END;
$$;

-- Fires AFTER INSERT OR UPDATE on journal_entries,
-- DEFERRABLE so it runs at COMMIT time, not row-by-row.
CREATE CONSTRAINT TRIGGER trg_journal_entries_balanced
    AFTER INSERT OR UPDATE ON journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION check_transaction_balanced();


-- ============================================================
-- Example — a balanced transaction
-- ============================================================
-- BEGIN;
--
-- INSERT INTO transactions (idempotency_key, description)
--   VALUES ('inv-001-2026', 'Pay vendor invoice #001');
--
-- -- Debit  "Cash" account  by $100.00  (10000 cents)
-- INSERT INTO journal_entries (transaction_id, account_id, amount)
--   VALUES ('<transaction_uuid>', '<cash_account_uuid>', -10000);
--
-- -- Credit "Expense" account by $100.00 (10000 cents)
-- INSERT INTO journal_entries (transaction_id, account_id, amount)
--   VALUES ('<transaction_uuid>', '<expense_account_uuid>', 10000);
--
-- COMMIT;  -- trigger fires here; SUM = -10000 + 10000 = 0 ✓
-- ============================================================
