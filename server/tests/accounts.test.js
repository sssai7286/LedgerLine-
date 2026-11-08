const request = require('supertest');
const app     = require('../app');

// Helper: register + return token
async function registerAndLogin(overrides = {}) {
  const payload = {
    name: 'Acct User', email: `acct_${Date.now()}@test.com`, password: 'password123',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  return { token: res.body.token, user: res.body.user };
}

describe('Account Management', () => {
  describe('POST /api/accounts', () => {
    it('creates an account for authenticated user', async () => {
      const { token } = await registerAndLogin();
      const res = await request(app).post('/api/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ account_name: 'Savings', currency: 'USD' });
      expect(res.status).toBe(201);
      expect(res.body.account_name).toBe('Savings');
      expect(res.body.balance_cents).toBe(0);
      expect(res.body.currency).toBe('USD');
    });

    it('rejects request without auth token', async () => {
      const res = await request(app).post('/api/accounts')
        .send({ account_name: 'Savings', currency: 'USD' });
      expect(res.status).toBe(401);
    });

    it('rejects invalid currency code', async () => {
      const { token } = await registerAndLogin();
      const res = await request(app).post('/api/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ account_name: 'Bad', currency: 'USDX' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/accounts', () => {
    it('ACCOUNT_HOLDER sees only own accounts', async () => {
      const { token: t1 } = await registerAndLogin({ email: 'u1@test.com' });
      const { token: t2 } = await registerAndLogin({ email: 'u2@test.com' });

      await request(app).post('/api/accounts').set('Authorization', `Bearer ${t1}`)
        .send({ account_name: 'A1', currency: 'USD' });
      await request(app).post('/api/accounts').set('Authorization', `Bearer ${t2}`)
        .send({ account_name: 'A2', currency: 'USD' });

      const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${t1}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].account_name).toBe('A1');
    });
  });

  describe('GET /api/accounts/:id/balance', () => {
    it('returns zero balance for new account', async () => {
      const { token } = await registerAndLogin();
      const acct = await request(app).post('/api/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ account_name: 'Checking', currency: 'USD' });

      const res = await request(app)
        .get(`/api/accounts/${acct.body._id}/balance`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.balance_cents).toBe(0);
    });

    it('blocks ACCOUNT_HOLDER from viewing another user\'s account', async () => {
      const { token: t1 } = await registerAndLogin({ email: 'own1@test.com' });
      const { token: t2 } = await registerAndLogin({ email: 'own2@test.com' });

      const acct = await request(app).post('/api/accounts')
        .set('Authorization', `Bearer ${t1}`)
        .send({ account_name: 'Private', currency: 'USD' });

      const res = await request(app)
        .get(`/api/accounts/${acct.body._id}/balance`)
        .set('Authorization', `Bearer ${t2}`);
      expect(res.status).toBe(403);
    });
  });
});
