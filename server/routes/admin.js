const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/users', authenticateAdmin, async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, subscription_end, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(result.rows);
});

router.post('/users/:id/extend', authenticateAdmin, async (req, res) => {
  await pool.query(
    'UPDATE users SET subscription_end = subscription_end + INTERVAL \'30 days\' WHERE id = $1',
    [req.params.id]
  );
  res.json({ success: true });
});

router.get('/analytics', authenticateAdmin, async (req, res) => {
  const sessions = await pool.query('SELECT COUNT(*) as total_sessions FROM sessions');
  const users = await pool.query('SELECT COUNT(*) as total_users FROM users');
  res.json({ sessions: sessions.rows[0], users: users.rows[0] });
});

module.exports = router;
