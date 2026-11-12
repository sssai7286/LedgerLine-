const request = require('supertest');
const app     = require('../app');

describe('Authentication', () => {
  const user = { name: 'Test User', email: 'test@ledger.com', password: 'password123' };

  // ── Register ────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('registers a new user and returns token', async () => {
      const res = await request(app).post('/api/auth/register').send(user);
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.role).toBe('ACCOUNT_HOLDER');
    });

    it('rejects duplicate email with 409', async () => {
      await request(app).post('/api/auth/register').send(user);
      const res = await request(app).post('/api/auth/register').send(user);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/i);
    });

    it('rejects missing fields with 400', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
    });

    it('rejects weak password (< 8 chars)', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ name: 'X', email: 'x@x.com', password: 'short' });
      expect(res.status).toBe(400);
    });

    it('does not allow public registration to assign privileged roles', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ ...user, email: 'admin-choice@ledger.com', role: 'ADMIN' });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('ACCOUNT_HOLDER');
    });
  });

  // ── Login ───────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(user);
    });

    it('returns token on valid credentials', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('rejects wrong password with 401', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: user.email, password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('rejects unknown email with 401', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'nobody@x.com', password: 'anything' });
      expect(res.status).toBe(401);
    });
  });

  // ── Protected route ─────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns user info with valid token', async () => {
      const reg = await request(app).post('/api/auth/register').send(user);
      const res = await request(app).get('/api/auth/me')
        .set('Authorization', `Bearer ${reg.body.token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(user.email);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app).get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });
});
