const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LedgerLine API',
      version: '2.0.0',
      description: `
## LedgerLine – Double-Entry Financial Ledger API

### Authentication
All protected routes require a **Bearer JWT token** in the \`Authorization\` header.
Get a token via \`POST /api/auth/login\` or \`POST /api/auth/register\`.

### Roles
| Role | Permissions |
|------|-------------|
| \`ADMIN\` | Full access to all resources |
| \`ACCOUNT_HOLDER\` | Own accounts and transactions only |
| \`AUDITOR\` | Read-only access to all transactions and audit logs |

### Money amounts
All amounts are in **integer cents** (smallest currency unit).  
$10.00 = \`1000\`  ·  ₹1.50 = \`150\`  ·  ¥500 = \`500\`

### Idempotency
Supply a unique \`idempotency_key\` on every deposit/withdrawal/transfer.  
Retrying with the same key returns the original transaction — money is never double-posted.
      `,
      contact: { name: 'LedgerLine', email: 'sssai7286@gmail.com' },
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:         { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            name:       { type: 'string', example: 'Alice Smith' },
            email:      { type: 'string', example: 'alice@example.com' },
            role:       { type: 'string', enum: ['ADMIN','ACCOUNT_HOLDER','AUDITOR'] },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id:             { type: 'string', format: 'uuid' },
            account_name:  { type: 'string', example: 'Main Checking' },
            account_type:  { type: 'string', enum: ['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'] },
            currency:      { type: 'string', example: 'USD' },
            balance_cents: { type: 'integer', example: 150000 },
            created_at:    { type: 'string', format: 'date-time' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id:               { type: 'string', format: 'uuid' },
            type:            { type: 'string', enum: ['DEPOSIT','WITHDRAWAL','TRANSFER'] },
            idempotency_key: { type: 'string', example: 'dep-user123-1720000000' },
            description:     { type: 'string', example: 'Monthly savings deposit' },
            amount_cents:    { type: 'integer', example: 5000 },
            currency:        { type: 'string', example: 'USD' },
            status:          { type: 'string', enum: ['PENDING','COMPLETED','FAILED'] },
            created_at:      { type: 'string', format: 'date-time' },
          },
        },
        JournalEntry: {
          type: 'object',
          properties: {
            id:              { type: 'string', format: 'uuid' },
            transaction_id: { type: 'string' },
            account_id:     { type: 'string', nullable: true, description: 'Null for external clearing entries' },
            amount:         { type: 'integer', example: -5000, description: 'Positive=Debit, Negative=Credit' },
            created_at:     { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Insufficient balance' } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',         description: 'Registration, login, profile' },
      { name: 'Accounts',     description: 'Account CRUD and balance' },
      { name: 'Ledger',       description: 'Deposit, Withdraw, Transfer' },
      { name: 'Transactions', description: 'Transaction history and journal entries' },
      { name: 'Audit',        description: 'Append-only audit trail (Admin/Auditor only)' },
    ],
    paths: {
      '/api/auth/register': {
        post: {
          tags: ['Auth'], summary: 'Register a new user', security: [],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['name','email','password'],
            properties: {
              name:     { type: 'string', example: 'Alice Smith' },
              email:    { type: 'string', example: 'alice@example.com' },
              password: { type: 'string', example: 'securepassword123' },
            },
          }}}},
          responses: {
            201: { description: 'Registered successfully', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } } } } } },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            409: { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Login and get JWT token', security: [],
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object', required: ['email','password'],
            properties: { email: { type: 'string', example: 'alice@example.com' }, password: { type: 'string', example: 'securepassword123' } },
          }}}},
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } } } } } },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'], summary: 'Get current user profile',
          responses: { 200: { description: 'Current user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } }, 401: { description: 'Unauthorized' } },
        },
      },
      '/api/accounts': {
        get: {
          tags: ['Accounts'], summary: 'List accounts (own for ACCOUNT_HOLDER, all for ADMIN/AUDITOR)',
          responses: { 200: { description: 'List of accounts', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Account' } } } } } },
        },
        post: {
          tags: ['Accounts'], summary: 'Create a new account',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_name','currency'], properties: {
            account_name: { type: 'string', example: 'Main Checking' },
            account_type: { type: 'string', enum: ['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'], default: 'ASSET' },
            currency:     { type: 'string', example: 'USD' },
          }}}}},
          responses: { 201: { description: 'Account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } } },
        },
      },
      '/api/accounts/{id}/balance': {
        get: {
          tags: ['Accounts'], summary: 'Get account balance',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Balance info', content: { 'application/json': { schema: { type: 'object', properties: { account_id: { type: 'string' }, balance_cents: { type: 'integer' }, live_balance: { type: 'integer' }, balanced: { type: 'boolean' }, currency: { type: 'string' } } } } } } },
        },
      },
      '/api/accounts/{id}/statement': {
        get: {
          tags: ['Accounts'], summary: 'Get full transaction statement for an account',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Account statement with journal entries' } },
        },
      },
      '/api/ledger/deposit': {
        post: {
          tags: ['Ledger'], summary: 'Deposit money into an account',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_id','amount_cents','currency','idempotency_key'], properties: {
            account_id:      { type: 'string', example: '64f1a...' },
            amount_cents:    { type: 'integer', example: 5000, description: '$50.00' },
            currency:        { type: 'string', example: 'USD' },
            idempotency_key: { type: 'string', example: 'dep-user1-1720000000' },
            description:     { type: 'string', example: 'Monthly salary' },
          }}}}},
          responses: { 201: { description: 'Deposit successful', content: { 'application/json': { schema: { type: 'object', properties: { transaction: { $ref: '#/components/schemas/Transaction' } } } } } }, 400: { description: 'Validation / insufficient balance' }, 409: { description: 'Duplicate idempotency_key' } },
        },
      },
      '/api/ledger/withdraw': {
        post: {
          tags: ['Ledger'], summary: 'Withdraw money from an account',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_id','amount_cents','currency','idempotency_key'], properties: {
            account_id:      { type: 'string' }, amount_cents: { type: 'integer', example: 2000 },
            currency:        { type: 'string', example: 'USD' }, idempotency_key: { type: 'string' }, description: { type: 'string' },
          }}}}},
          responses: { 201: { description: 'Withdrawal successful' }, 400: { description: 'Insufficient balance or validation error' } },
        },
      },
      '/api/ledger/transfer': {
        post: {
          tags: ['Ledger'], summary: 'Transfer money between two accounts (double-entry)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['from_account_id','to_account_id','amount_cents','currency','idempotency_key'], properties: {
            from_account_id: { type: 'string' }, to_account_id: { type: 'string' },
            amount_cents:    { type: 'integer', example: 1000 }, currency: { type: 'string', example: 'USD' },
            idempotency_key: { type: 'string' }, description: { type: 'string' },
          }}}}},
          responses: { 201: { description: 'Transfer successful' }, 400: { description: 'Insufficient balance, same account, or validation error' } },
        },
      },
      '/api/transactions': {
        post: {
          tags: ['Transactions'], summary: 'Post a balanced journal transaction',
          requestBody: { required: true, content: { 'application/json': { schema: {
            type: 'object',
            required: ['idempotency_key', 'entries'],
            properties: {
              idempotency_key: { type: 'string', maxLength: 255 },
              description: { type: 'string' },
              entries: {
                type: 'array',
                minItems: 2,
                items: {
                  type: 'object',
                  required: ['account_id', 'amount'],
                  properties: {
                    account_id: { type: 'string', format: 'uuid' },
                    amount: { type: 'integer', description: 'Positive=debit, negative=credit' },
                  },
                },
              },
            },
          }}}},
          responses: {
            201: { description: 'Balanced transaction posted' },
            400: { description: 'Validation or balance error' },
            403: { description: 'Account access denied' },
          },
        },
        get: {
          tags: ['Transactions'], summary: 'List transactions (own for ACCOUNT_HOLDER, all for ADMIN/AUDITOR)',
          responses: { 200: { description: 'List of transactions', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } } } } } },
        },
      },
      '/api/transactions/{id}/entries': {
        get: {
          tags: ['Transactions'], summary: 'Get journal entries for a transaction',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Transaction with journal entry legs' } },
        },
      },
      '/api/audit': {
        get: {
          tags: ['Audit'], summary: 'Get audit logs (ADMIN / AUDITOR only)',
          parameters: [
            { name: 'action', in: 'query', schema: { type: 'string', example: 'DEPOSIT' } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['SUCCESS','FAILURE'] } },
            { name: 'page',   in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit',  in: 'query', schema: { type: 'integer', default: 50 } },
          ],
          responses: { 200: { description: 'Paginated audit log entries' }, 403: { description: 'Insufficient role' } },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
