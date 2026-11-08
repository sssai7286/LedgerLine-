const request = require('supertest');
const app     = require('../app');

async function registerAs(role, suffix = Date.now()) {
  const res = await request(app).post('/api/auth/register').send({
    name: `${role} User`, email: `${role.toLowerCase()}_${suffix}@test.com`, password: 'password123', role,
  });
  return { token: res.body.token, user: res.body.user };
}

describe('RBAC — Role-Based Access Control', () => {
  it('AUDITOR cannot deposit', async () => {
    const { token } = await registerAs('AUDITOR', 'aud1');
    const acct = await request(app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ account_name: 'X', currency: 'USD' });
    // AUDITOR cannot create accounts
    expect([403, 401]).toContain(acct.status);
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

    const res = await request(app).get(`/api/accounts/${acct.body._id}/balance`)
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
