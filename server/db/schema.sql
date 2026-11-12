-- ================================================================
-- LedgerLine – PostgreSQL Schema (PERN stack)
-- Double-Entry Bookkeeping
-- ================================================================

-- ----------------------------------------------------------------
-- users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(120) NOT NULL,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password     TEXT         NOT NULL,
    role         VARCHAR(20)  NOT NULL DEFAULT 'ACCOUNT_HOLDER'
                              CHECK (role IN ('ADMIN','ACCOUNT_HOLDER','AUDITOR')),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ----------------------------------------------------------------
-- accounts
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_name   VARCHAR(120) NOT NULL,
    account_type   VARCHAR(10)  NOT NULL DEFAULT 'ASSET'
                                CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
    currency       VARCHAR(3)   NOT NULL CHECK (char_length(currency) = 3),
    balance_cents  BIGINT       NOT NULL DEFAULT 0
                                CHECK (balance_cents BETWEEN -9007199254740991 AND 9007199254740991),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);

-- ----------------------------------------------------------------
-- transactions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key  VARCHAR(255) NOT NULL UNIQUE,
    type             VARCHAR(15)  NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAWAL','TRANSFER')),
    description      TEXT,
    initiated_by     UUID         NOT NULL REFERENCES users(id),
    amount_cents     BIGINT       NOT NULL
                                  CHECK (amount_cents BETWEEN 1 AND 9007199254740991),
    currency         VARCHAR(3)   NOT NULL,
    status           VARCHAR(10)  NOT NULL DEFAULT 'COMPLETED'
                                  CHECK (status IN ('PENDING','COMPLETED','FAILED')),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency  ON transactions (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_initiated_by ON transactions (initiated_by);

-- ----------------------------------------------------------------
-- journal_entries  (double-entry legs)
-- amount > 0 = DEBIT, amount < 0 = CREDIT
-- SUM(amount) per transaction must = 0  (enforced by trigger below)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id      UUID        REFERENCES accounts(id)     ON DELETE RESTRICT,
    amount          BIGINT      NOT NULL
                                CHECK (amount <> 0 AND amount BETWEEN -9007199254740991 AND 9007199254740991),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_entries ALTER COLUMN account_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_je_transaction_id ON journal_entries (transaction_id);
CREATE INDEX IF NOT EXISTS idx_je_account_id     ON journal_entries (account_id);

-- Deferred trigger: enforces SUM(amount) = 0 per transaction at COMMIT time
CREATE OR REPLACE FUNCTION fn_check_balanced()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_sum BIGINT;
BEGIN
    SELECT COALESCE(SUM(amount),0) INTO v_sum
    FROM journal_entries WHERE transaction_id = NEW.transaction_id;
    IF v_sum <> 0 THEN
        RAISE EXCEPTION 'UNBALANCED TRANSACTION id=% net=% (must be 0)',
            NEW.transaction_id, v_sum;
    END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_journal_balanced ON journal_entries;
CREATE CONSTRAINT TRIGGER trg_journal_balanced
    AFTER INSERT OR UPDATE ON journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_check_balanced();

-- ----------------------------------------------------------------
-- audit_logs  (append-only)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    user_email   VARCHAR(255),
    role         VARCHAR(20),
    action       VARCHAR(50)  NOT NULL,
    resource     VARCHAR(50),
    resource_id  TEXT,
    meta         JSONB        DEFAULT '{}',
    ip           VARCHAR(60),
    status       VARCHAR(10)  NOT NULL DEFAULT 'SUCCESS'
                              CHECK (status IN ('SUCCESS','FAILURE')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION fn_reject_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only';
END; $$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_reject_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
    BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION fn_reject_audit_log_mutation();
