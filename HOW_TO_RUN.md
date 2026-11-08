# How to Run LedgerLine Locally

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 18 | https://nodejs.org |
| MongoDB | ≥ 6 (Community) | https://www.mongodb.com/try/download/community |
| npm | ≥ 9 | Comes with Node.js |

---

## Step 1 — Install MongoDB (Required)

MongoDB is not installed on this machine. Install it:

### Option A — MongoDB Community Server (local, recommended)
1. Download from https://www.mongodb.com/try/download/community
2. Install with default settings (installs as a Windows service)
3. MongoDB will auto-start on port `27017`

### Option B — MongoDB Atlas (free cloud, no install needed)
1. Go to https://cloud.mongodb.com → create a free M0 cluster
2. Create a database user (username + password)
3. Get your connection string:  
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/ledgerline`
4. Paste it into `.env` as `MONGO_URI`

---

## Step 2 — Configure Environment

Copy `.env.example` to `.env` (already done) and set your values:

```
# .env
MONGO_URI=mongodb://localhost:27017/ledgerline    ← or your Atlas URI
JWT_SECRET=change_this_to_something_long_and_random
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

---

## Step 3 — Seed Demo Data (optional but recommended)

```powershell
cd server
npm run seed
```

This creates:
| Email | Password | Role |
|-------|----------|------|
| admin@ledgerline.com | password123 | ADMIN |
| alice@ledgerline.com | password123 | ACCOUNT_HOLDER |
| bob@ledgerline.com | password123 | ACCOUNT_HOLDER |
| auditor@ledgerline.com | password123 | AUDITOR |

---

## Step 4 — Start the Backend

Open a terminal:

```powershell
cd C:\Users\Hp\Documents\snovyasis\server
npm run dev
```

Expected output:
```
LedgerLine API running → http://localhost:5000
API Docs            → http://localhost:5000/api/docs
Health check        → http://localhost:5000/api/health
MongoDB connected: localhost
```

---

## Step 5 — Start the Frontend

Open a **second** terminal:

```powershell
cd C:\Users\Hp\Documents\snovyasis\client
npm start
```

Frontend opens at: **http://localhost:3000**

---

## Step 6 — Run Tests

```powershell
cd C:\Users\Hp\Documents\snovyasis\server
npm test
```

Runs 28 tests across auth, accounts, transactions (deposit/withdraw/transfer),
idempotency, negative balance prevention, concurrency, and RBAC.

---

## URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | React frontend |
| http://localhost:5000/api/health | Backend health check |
| http://localhost:5000/api/docs | Swagger API documentation |

---

## Docker (alternative — runs everything together)

Requires Docker Desktop installed:

```powershell
# In the project root
docker-compose up --build
```

Services:
- MongoDB on port 27017
- Backend on port 5000
- Frontend on port 3000

---

## Project Structure

```
snovyasis/
├── server/
│   ├── app.js                    # Express app (imported by tests)
│   ├── index.js                  # DB connect + listen
│   ├── models/                   # Mongoose models
│   │   ├── User.js
│   │   ├── Account.js
│   │   ├── Transaction.js
│   │   ├── JournalEntry.js
│   │   └── AuditLog.js
│   ├── controllers/              # Route handlers
│   ├── routes/                   # Express routers
│   ├── middleware/auth.js         # JWT protect + RBAC authorize
│   ├── docs/swagger.js           # OpenAPI 3.0 spec
│   ├── db/seed.js                # Demo data seeder
│   └── tests/                    # Jest + Supertest tests
│       ├── setup.js
│       ├── auth.test.js
│       ├── accounts.test.js
│       ├── transactions.test.js
│       └── rbac.test.js
├── client/
│   └── src/
│       ├── components/           # React UI components
│       ├── context/AuthContext.jsx
│       ├── api/api.js
│       └── App.jsx
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── HOW_TO_RUN.md
```
