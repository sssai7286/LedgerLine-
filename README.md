# Financial Ledger System

A MERN stack application with PostgreSQL implementing a **double-entry bookkeeping** system for financial integrity.

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (double-entry bookkeeping schema)
- **ORM**: pg (node-postgres)

## Double-Entry Bookkeeping

Every transaction creates two or more journal entries where:
- The sum of all **debits** equals the sum of all **credits**
- `amount > 0` = debit, `amount < 0` = credit
- Amounts stored as **BIGINT** (cents) to avoid floating-point errors
- A database-level **CHECK constraint** ensures every transaction balances to zero

## Project Structure

```
snovyasis/
├── server/                  # Express API
│   ├── config/
│   │   └── db.js            # PostgreSQL connection
│   ├── controllers/
│   │   ├── accountController.js
│   │   └── transactionController.js
│   ├── routes/
│   │   ├── accountRoutes.js
│   │   └── transactionRoutes.js
│   ├── db/
│   │   └── schema.sql       # PostgreSQL DDL
│   └── index.js             # Entry point
├── client/                  # React frontend
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── AccountList.jsx
│       │   ├── TransactionForm.jsx
│       │   └── JournalEntries.jsx
│       ├── api/
│       │   └── api.js
│       ├── App.jsx
│       └── index.js
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 14

### Setup

1. Clone the repo
2. Create a PostgreSQL database
3. Run the schema:
   ```bash
   psql -U postgres -d your_db -f server/db/schema.sql
   ```
4. Copy `.env.example` to `.env` and fill in your values
5. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
6. Start the backend:
   ```bash
   cd server && npm run dev
   ```
7. Start the frontend:
   ```bash
   cd client && npm start
   ```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/accounts` | List all accounts |
| POST | `/api/accounts` | Create account |
| GET | `/api/accounts/:id/balance` | Get account balance |
| POST | `/api/transactions` | Create a balanced transaction |
| GET | `/api/transactions` | List all transactions |
| GET | `/api/transactions/:id/entries` | Get journal entries for a transaction |

## Schema Overview

### accounts
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| owner_id | UUID | User reference |
| currency | VARCHAR(3) | ISO 4217 (USD, EUR…) |
| created_at | TIMESTAMPTZ | Auto-set |

### transactions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| idempotency_key | VARCHAR(255) | Unique, prevents duplicate posts |
| description | TEXT | Human-readable memo |
| created_at | TIMESTAMPTZ | Auto-set |

### journal_entries
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| transaction_id | UUID | FK → transactions |
| account_id | UUID | FK → accounts |
| amount | BIGINT | Cents; positive=debit, negative=credit |
