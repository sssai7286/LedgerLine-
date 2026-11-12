const { pool } = require('../config/db');

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

class OperationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const performOperation = async (req, res, type) => {
  const {
    account_id,
    from_account_id,
    to_account_id,
    amount_cents,
    currency,
    idempotency_key,
    description,
  } = req.body;

  const transfer = type === 'TRANSFER';
  const requestedAccountIds = transfer ? [from_account_id, to_account_id] : [account_id];
  if (requestedAccountIds.some((id) => !isUuid(id))) {
    return res.status(400).json({ error: 'A valid account ID is required' });
  }
  if (transfer && from_account_id === to_account_id) {
    return res.status(400).json({ error: 'Cannot transfer to the same account' });
  }
  if (!Number.isSafeInteger(amount_cents) || amount_cents <= 0) {
    return res.status(400).json({ error: 'amount_cents must be a positive safe integer' });
  }
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/i.test(currency)) {
    return res.status(400).json({ error: 'currency must be a 3-letter ISO 4217 code' });
  }
  if (typeof idempotency_key !== 'string' || !idempotency_key.trim() || idempotency_key.length > 255) {
    return res.status(400).json({ error: 'idempotency_key is required and must be at most 255 characters' });
  }
  if (description != null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be a string' });
  }

  const accountIds = requestedAccountIds.map((id) => id.toLowerCase());
  if (transfer && accountIds[0] === accountIds[1]) {
    return res.status(400).json({ error: 'Cannot transfer to the same account' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM transactions WHERE idempotency_key = $1',
      [idempotency_key.trim()]
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return res.status(200).json({ transaction: existing.rows[0], idempotent: true });
    }

    const accountResult = await client.query(
      `SELECT * FROM accounts
       WHERE id = ANY($1::uuid[]) AND is_active = TRUE
       ORDER BY id FOR UPDATE`,
      [accountIds]
    );
    if (accountResult.rows.length !== accountIds.length) {
      throw new OperationError(404, 'Account not found or inactive');
    }

    const accounts = new Map(accountResult.rows.map((account) => [account.id, account]));
    const source = accounts.get(accountIds[0]);
    const destination = transfer ? accounts.get(accountIds[1]) : null;

    if (req.user.role === 'ACCOUNT_HOLDER' && source.user_id !== req.user.id) {
      throw new OperationError(403, 'Access denied: you do not own the source account');
    }
    if (source.currency !== currency.toUpperCase()
      || (destination && destination.currency !== currency.toUpperCase())) {
      throw new OperationError(400, 'Currency must match all involved accounts');
    }
    if (type !== 'DEPOSIT' && Number(source.balance_cents) < amount_cents) {
      throw new OperationError(400, 'Insufficient balance');
    }
    if ((type === 'DEPOSIT' && !Number.isSafeInteger(Number(source.balance_cents) + amount_cents))
      || (destination && !Number.isSafeInteger(Number(destination.balance_cents) + amount_cents))) {
      throw new OperationError(400, 'Resulting balance exceeds the supported range');
    }

    const defaultDescription = type === 'DEPOSIT'
      ? `Deposit to ${source.account_name}`
      : type === 'WITHDRAWAL'
        ? `Withdrawal from ${source.account_name}`
        : `Transfer: ${source.account_name} to ${destination.account_name}`;
    const txResult = await client.query(
      `INSERT INTO transactions
         (idempotency_key, type, description, initiated_by, amount_cents, currency)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        idempotency_key.trim(),
        type,
        description?.trim() || defaultDescription,
        req.user.id,
        amount_cents,
        currency.toUpperCase(),
      ]
    );
    const transaction = txResult.rows[0];

    if (type === 'DEPOSIT') {
      await client.query(
        `INSERT INTO journal_entries (transaction_id, account_id, amount)
         VALUES ($1,$2,$3),($1,NULL,$4)`,
        [transaction.id, source.id, amount_cents, -amount_cents]
      );
      await client.query(
        'UPDATE accounts SET balance_cents = balance_cents + $1, updated_at = NOW() WHERE id = $2',
        [amount_cents, source.id]
      );
    } else if (type === 'WITHDRAWAL') {
      await client.query(
        `INSERT INTO journal_entries (transaction_id, account_id, amount)
         VALUES ($1,$2,$3),($1,NULL,$4)`,
        [transaction.id, source.id, -amount_cents, amount_cents]
      );
      await client.query(
        `UPDATE accounts SET balance_cents = balance_cents - $1, updated_at = NOW()
         WHERE id = $2 AND balance_cents >= $1`,
        [amount_cents, source.id]
      );
    } else {
      await client.query(
        `INSERT INTO journal_entries (transaction_id, account_id, amount)
         VALUES ($1,$2,$3),($1,$4,$5)`,
        [transaction.id, source.id, -amount_cents, destination.id, amount_cents]
      );
      await client.query(
        'UPDATE accounts SET balance_cents = balance_cents - $1, updated_at = NOW() WHERE id = $2',
        [amount_cents, source.id]
      );
      await client.query(
        'UPDATE accounts SET balance_cents = balance_cents + $1, updated_at = NOW() WHERE id = $2',
        [amount_cents, destination.id]
      );
    }

    await client.query(
      `INSERT INTO audit_logs
         (user_id,user_email,role,action,resource,resource_id,ip,status,meta)
       VALUES ($1,$2,$3,$4,'Transaction',$5,$6,'SUCCESS',$7)`,
      [
        req.user.id,
        req.user.email,
        req.user.role,
        type,
        transaction.id,
        req.ip,
        JSON.stringify({ accountIds, amount_cents, currency: currency.toUpperCase() }),
      ]
    );
    await client.query('COMMIT');
    return res.status(201).json({ transaction });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Ledger transaction rollback failed:', rollbackError.message);
    }

    if (err.code === '23505') {
      const existing = await pool.query(
        'SELECT * FROM transactions WHERE idempotency_key = $1',
        [idempotency_key.trim()]
      );
      if (existing.rows[0]) {
        return res.status(200).json({ transaction: existing.rows[0], idempotent: true });
      }
    }
    if (err instanceof OperationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(`${type} failed:`, err.message);
    return res.status(500).json({ error: `${type.toLowerCase()} failed` });
  } finally {
    client.release();
  }
};

const deposit = (req, res) => performOperation(req, res, 'DEPOSIT');
const withdraw = (req, res) => performOperation(req, res, 'WITHDRAWAL');
const transfer = (req, res) => performOperation(req, res, 'TRANSFER');

module.exports = { deposit, withdraw, transfer };
