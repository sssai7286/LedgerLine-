const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
});

const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof name !== 'string' || !name.trim()
    || typeof email !== 'string' || !email.trim()
    || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (name.trim().length > 120 || email.trim().length > 255) {
    return res.status(400).json({ error: 'name must be at most 120 characters and email at most 255 characters' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'ACCOUNT_HOLDER')
         RETURNING id, name, email, role, created_at`,
        [name.trim(), normalizedEmail, hashedPassword]
      );
      const user = rows[0];

      await client.query(
        `INSERT INTO audit_logs (user_id, user_email, role, action, resource, resource_id, ip, status)
         VALUES ($1,$2,$3,'AUTH_REGISTER','User',$4,$5,'SUCCESS')`,
        [user.id, user.email, user.role, user.id, req.ip]
      );
      await client.query('COMMIT');

      res.status(201).json({ token: signToken(user.id), user });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Registration rollback failed:', rollbackError.message);
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Registration failed:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  const { email, password, login_type: loginType } = req.body;
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (loginType != null && !['user', 'admin', 'auditor'].includes(loginType)) {
    return res.status(400).json({ error: 'login_type must be user, admin, or auditor' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [normalizedEmail]
    );
    const user = rows[0];

    const validPassword = user && await bcrypt.compare(password, user.password);
    const matchesLoginType = !loginType
      || (loginType === 'user' && user?.role === 'ACCOUNT_HOLDER')
      || (loginType === 'admin' && ['ADMIN', 'AUDITOR'].includes(user?.role))
      || (loginType === 'auditor' && user?.role === 'AUDITOR');

    if (!validPassword || !matchesLoginType) {
      await pool.query(
        `INSERT INTO audit_logs (user_email, action, ip, status, meta)
         VALUES ($1,'AUTH_LOGIN',$2,'FAILURE',$3)`,
        [normalizedEmail, req.ip, JSON.stringify({ reason: 'Invalid credentials or login type mismatch' })]
      );
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user.id);
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_email, role, action, resource, resource_id, ip, status)
       VALUES ($1,$2,$3,'AUTH_LOGIN','User',$4,$5,'SUCCESS')`,
      [user.id, user.email, user.role, user.id, req.ip]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

const getMe = (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role });
};

module.exports = { register, login, getMe };
