# LedgerLine – Financial Ledger System

A MERN stack application implementing **double-entry bookkeeping** for financial integrity.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 |
| Backend | Node.js + Express |
| Database | **MongoDB** + Mongoose |
| HTTP client | Axios |

## Double-Entry Bookkeeping

Every transaction creates two or more journal entries where:
- `SUM(entries.amount) = 0` — debits always equal credits
- `amount > 0` = **debit** (value flows into the account)
- `amount < 0` = **credit** (value flows out of the account)
- Amounts stored as **integers (cents)** to avoid floating-point errors
- All writes are wrapped in a **MongoDB session** (atomic — all or nothing)

## Project Structure

```
snovyasis/
├── server/
│   ├── config/db.js               # Mongoose connection
│   ├── models/
│   │   ├── Account.js             # accounts collection
│   │   ├── Transaction.js         # transactions collection
│   │   └── JournalEntry.js        # journalentries collection
│   ├── controllers/
│   │   ├── accountController.js
│   │   └── transactionController.js
│   ├── routes/
│   │   ├── accountRoutes.js
│   │   └── transactionRoutes.js
│   ├── db/README.md               # DB layer docs
│   └── index.js
├── client/
│   └── src/
│       ├── components/
│       │   ├── AccountList.jsx
│       │   ├── TransactionForm.jsx
│       │   └── JournalEntries.jsx
│       ├── api/api.js
│       ├── App.jsx
│       └── index.js
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB >= 6 (local) **or** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### Setup

1. Clone the repo
2. Copy `.env.example` → `.env` and set `MONGO_URI`
3. Install server dependencies:
   ```bash
   cd server && npm install
   ```
4. Install client dependencies:
   ```bash
   cd ../client && npm install
   ```
5. Start the backend:
   ```bash
   cd server && npm run dev
   ```
6. Start the frontend:
   ```bash
   cd client && npm start
   ```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/accounts` | List all accounts |
| POST | `/api/accounts` | Create account |
| GET | `/api/accounts/:id/balance` | Get account balance (cents) |
| POST | `/api/transactions` | Create a balanced transaction |
| GET | `/api/transactions` | List all transactions |
| GET | `/api/transactions/:id/entries` | Get journal entries for a transaction |

### POST /api/transactions — example payload

```json
{
  "idempotency_key": "inv-vendor-001",
  "description": "Pay vendor invoice #001",
  "entries": [
    { "account_id": "<cash_account_id>",    "amount": -10000 },
    { "account_id": "<expense_account_id>", "amount":  10000 }
  ]
}
```

`SUM(-10000 + 10000) = 0` → balanced ✓

## Schema Overview

### accounts
| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | Auto-generated |
| owner_id | String | User reference |
| account_name | String | e.g. "Cash", "Revenue" |
| account_type | String | ASSET / LIABILITY / EQUITY / INCOME / EXPENSE |
| currency | String | ISO 4217 (USD, EUR…) |
| created_at | Date | Auto-set |

### transactions
| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | Auto-generated |
| idempotency_key | String | Unique — prevents duplicate posts |
| description | String | Human-readable memo |
| created_at | Date | Auto-set |

### journalentries
| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | Auto-generated |
| transaction_id | ObjectId | Ref → Transaction |
| account_id | ObjectId | Ref → Account |
| amount | Number (int) | Cents; positive=debit, negative=credit |
| created_at | Date | Auto-set |
