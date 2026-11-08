# Database Layer

LedgerLine uses **MongoDB** with **Mongoose** ODM.

## Models

| Model | Collection | Maps to (PostgreSQL equivalent) |
|-------|------------|----------------------------------|
| `Account` | `accounts` | `accounts` table |
| `Transaction` | `transactions` | `transactions` table |
| `JournalEntry` | `journalentries` | `journal_entries` table |

## Double-Entry Invariant

MongoDB does not have deferred triggers, so balance is enforced at two layers:

1. **Controller** (`transactionController.js`) — rejects any request where `SUM(entries.amount) ≠ 0` before touching the DB.
2. **MongoDB Session** — all inserts (Transaction + JournalEntries) run inside a single session with `startTransaction()` / `commitTransaction()`. If anything fails, `abortTransaction()` rolls everything back atomically.

## Amount Storage

`amount` is stored as a plain **integer** representing the **smallest currency unit**:

| Currency | Unit | Example |
|----------|------|---------|
| USD | cents | $1.99 → `199` |
| INR | paise | ₹1.50 → `150` |
| JPY | yen (no sub-unit) | ¥500 → `500` |

This avoids all floating-point rounding errors.

## Indexes

- `Account`: `owner_id`
- `Transaction`: `idempotency_key` (unique)
- `JournalEntry`: `transaction_id`, `account_id`
