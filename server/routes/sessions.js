const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateJWT } = require('../middleware/auth');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/create', authenticateJWT, async (req, res) => {
  const { ai_agent = false } = req.body;
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await pool.query(
    'INSERT INTO sessions (id, host_id, ai_agent, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionId, req.user.id, ai_agent, expiresAt]
  );
  
  res.json({ sessionId, signalingUrl: `wss://${req.get('host')}`, expiresAt });
});

router.get('/:id', authenticateJWT, async (req, res) => {
  const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [req.params.id]);
  if (result.rows[0]) res.json(result.rows[0]);
  else res.status(404).json({ error: 'Session not found' });
});

router.post('/:id/end', authenticateJWT, async (req, res) => {
  await pool.query('UPDATE sessions SET status = $1 WHERE id = $2', ['ended', req.params.id]);
  res.json({ success: true });
});

module.exports = router;
