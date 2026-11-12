const request = require('supertest');
const app     = require('../app');
const { pool } = require('../config/db');

async function registerAs(role, suffix = Date.now()) {
  const res = await request(app).post('/api/auth/register').send({
    name: `${role} User`, email: `${role.toLowerCase()}_${suffix}@test.com`, password: 'password123',
  });
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, res.body.user.id]);
  return { token: res.body.token, user: res.body.user };
}

describe('RBAC — Role-Based Access Control', () => {
  it('AUDITOR cannot deposit', async () => {
    const { token: auditorToken } = await registerAs('AUDITOR', 'aud1');
    const { token: holderToken } = await registerAs('ACCOUNT_HOLDER', 'aud1-holder');
    const acct = await request(app).post('/api/accounts')
      .set('Authorization', `Bearer ${holderToken}`)
      .send({ account_name: 'X', currency: 'USD' });
    const res = await request(app).post('/api/ledger/deposit')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        account_id: acct.body.id,
        amount_cents: 100,
        currency: 'USD',
        idempotency_key: 'auditor-deposit-attempt',
      });
    expect(res.status).toBe(403);
  });

  it('AUDITOR can access audit logs', async () => {
    const { token } = await registerAs('AUDITOR', 'aud2');
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('ACCOUNT_HOLDER cannot access audit logs', async () => {
    const { token } = await registerAs('ACCOUNT_HOLDER', 'ah1');
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('ACCOUNT_HOLDER cannot access another user\'s account', async () => {
    const { token: t1 } = await registerAs('ACCOUNT_HOLDER', 'ah2');
    const { token: t2 } = await registerAs('ACCOUNT_HOLDER', 'ah3');

    const acct = await request(app).post('/api/accounts')
      .set('Authorization', `Bearer ${t1}`)
      .send({ account_name: 'Mine', currency: 'USD' });

    const res = await request(app).get(`/api/accounts/${acct.body.id}/balance`)
      .set('Authorization', `Bearer ${t2}`);
    expect(res.status).toBe(403);
  });

  it('ADMIN can view all accounts', async () => {
    const { token: adminTok } = await registerAs('ADMIN', 'adm1');
    const { token: userTok  } = await registerAs('ACCOUNT_HOLDER', 'ah4');

    await request(app).post('/api/accounts').set('Authorization', `Bearer ${userTok}`)
      .send({ account_name: 'UserAcct', currency: 'USD' });

    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    // Admin sees all accounts (at least the one just created)
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
