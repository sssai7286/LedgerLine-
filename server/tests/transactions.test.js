const request = require('supertest');
const app     = require('../app');

// Register user and create an account, return token + accountId
async function setup(email = `tx_${Date.now()}@test.com`) {
  const reg = await request(app).post('/api/auth/register')
    .send({ name: 'TX User', email, password: 'password123' });
  const token = reg.body.token;

  const acct = await request(app).post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ account_name: 'Wallet', currency: 'USD' });

  return { token, accountId: acct.body._id };
}

describe('Deposit', () => {
  it('increases account balance correctly', async () => {
    const { token, accountId } = await setup();
    const res = await request(app).post('/api/ledger/deposit')
      .set('Authorization', `Bearer ${token}`)
      .send({ account_id: accountId, amount_cents: 5000, currency: 'USD', idempotency_key: `dep-${Date.now()}` });

    expect(res.status).toBe(201);

    const bal = await request(app).get(`/api/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`);
    expect(bal.body.balance_cents).toBe(5000);
  });

  it('rejects deposit with non-integer amount', async () => {
    const { token, accountId } = await setup(`dep2_${Date.now()}@t.com`);
    const res = await request(app).post('/api/ledger/deposit')
      .set('Authorization', `Bearer ${token}`)
      .send({ account_id: accountId, amount_cents: 10.5, currency: 'USD', idempotency_key: `dep2-${Date.now()}` });
    expect(res.status).toBe(400);
  });

  it('is idempotent — duplicate key returns same transaction', async () => {
    const { token, accountId } = await setup(`dep3_${Date.now()}@t.com`);
    const key = `idem-dep-${Date.now()}`;
    const body = { account_id: accountId, amount_cents: 1000, currency: 'USD', idempotency_key: key };

    const r1 = await request(app).post('/api/ledger/deposit').set('Authorization', `Bearer ${token}`).send(body);
    const r2 = await request(app).post('/api/ledger/deposit').set('Authorization', `Bearer ${token}`).send(body);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    expect(r2.body.idempotent).toBe(true);
    expect(r1.body.transaction._id).toBe(r2.body.transaction._id);

    // Balance should only be incremented once
    const bal = await request(app).get(`/api/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`);
    expect(bal.body.balance_cents).toBe(1000);
  });
});

describe('Withdrawal', () => {
  it('decreases balance correctly', async () => {
    const { token, accountId } = await setup(`wd1_${Date.now()}@t.com`);
    await request(app).post('/api/ledger/deposit').set('Authorization', `Bearer ${token}`)
      .send({ account_id: accountId, amount_cents: 10000, currency: 'USD', idempotency_key: `seed-${Date.now()}` });

    const res = await request(app).post('/api/ledger/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ account_id: accountId, amount_cents: 3000, currency: 'USD', idempotency_key: `wd-${Date.now()}` });
    expect(res.status).toBe(201);

    const bal = await request(app).get(`/api/accounts/${accountId}/balance`).set('Authorization', `Bearer ${token}`);
    expect(bal.body.balance_cents).toBe(7000);
  });

  it('prevents negative balance', async () => {
    const { token, accountId } = await setup(`wd2_${Date.now()}@t.com`);
    await request(app).post('/api/ledger/deposit').set('Authorization', `Bearer ${token}`)
      .send({ account_id: accountId, amount_cents: 500, currency: 'USD', idempotency_key: `seedwd2-${Date.now()}` });

    const res = await request(app).post('/api/ledger/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ account_id: accountId, amount_cents: 9999, currency: 'USD', idempotency_key: `over-${Date.now()}` });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient/i);

    // Balance unchanged
    const bal = await request(app).get(`/api/accounts/${accountId}/balance`).set('Authorization', `Bearer ${token}`);
    expect(bal.body.balance_cents).toBe(500);
  });
});

describe('Transfer', () => {
  it('moves money between accounts with double-entry balance', async () => {
    const { token, accountId: fromId } = await setup(`tr1_${Date.now()}@t.com`);
    const acct2 = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ account_name: 'Savings', currency: 'USD' });
    const toId = acct2.body._id;

    await request(app).post('/api/ledger/deposit').set('Authorization', `Bearer ${token}`)
      .send({ account_id: fromId, amount_cents: 20000, currency: 'USD', idempotency_key: `seed-tr1-${Date.now()}` });

    const res = await request(app).post('/api/ledger/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({ from_account_id: fromId, to_account_id: toId, amount_cents: 5000, currency: 'USD', idempotency_key: `xfer-${Date.now()}` });
    expect(res.status).toBe(201);

    const [b1, b2] = await Promise.all([
      request(app).get(`/api/accounts/${fromId}/balance`).set('Authorization', `Bearer ${token}`),
      request(app).get(`/api/accounts/${toId}/balance`).set('Authorization', `Bearer ${token}`),
    ]);
    expect(b1.body.balance_cents).toBe(15000);
    expect(b2.body.balance_cents).toBe(5000);

    // Money conservation: total unchanged
    expect(b1.body.balance_cents + b2.body.balance_cents).toBe(20000);
  });

  it('blocks transfer when source has insufficient funds', async () => {
    const { token, accountId: fromId } = await setup(`tr2_${Date.now()}@t.com`);
    const acct2 = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ account_name: 'Target', currency: 'USD' });

    const res = await request(app).post('/api/ledger/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({ from_account_id: fromId, to_account_id: acct2.body._id, amount_cents: 999, currency: 'USD', idempotency_key: `xfail-${Date.now()}` });
    expect(res.status).toBe(400);
  });

  it('blocks self-transfer', async () => {
    const { token, accountId } = await setup(`tr3_${Date.now()}@t.com`);
    const res = await request(app).post('/api/ledger/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({ from_account_id: accountId, to_account_id: accountId, amount_cents: 100, currency: 'USD', idempotency_key: `self-${Date.now()}` });
    expect(res.status).toBe(400);
  });
});

describe('Concurrency Protection', () => {
  it('prevents double-spend under simultaneous withdrawal requests', async () => {
    const { token, accountId } = await setup(`conc_${Date.now()}@t.com`);
    await request(app).post('/api/ledger/deposit').set('Authorization', `Bearer ${token}`)
      .send({ account_id: accountId, amount_cents: 1000, currency: 'USD', idempotency_key: `conc-seed-${Date.now()}` });

    // Fire 5 concurrent withdrawals of 800 cents each — only 1 should succeed
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(app).post('/api/ledger/withdraw')
          .set('Authorization', `Bearer ${token}`)
          .send({ account_id: accountId, amount_cents: 800, currency: 'USD', idempotency_key: `conc-wd-${Date.now()}-${i}` })
      )
    );

    const successes = results.filter((r) => r.status === 201);
    const failures  = results.filter((r) => r.status === 400);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(4);

    // Balance must be 200 (1000 - 800), never negative
    const bal = await request(app).get(`/api/accounts/${accountId}/balance`)
      .set('Authorization', `Bearer ${token}`);
    expect(bal.body.balance_cents).toBe(200);
    expect(bal.body.balance_cents).toBeGreaterThanOrEqual(0);
  });
});
