const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/schedule', authenticateJWT, async (req, res) => {
  const { title, start_time, ppt_url, ai_config } = req.body;
  const result = await pool.query(
    'INSERT INTO meetings (title, start_time, ppt_url, ai_config, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, start_time, ppt_url, ai_config, req.user.id]
  );
  res.json(result.rows[0]);
});

router.get('/scheduled', authenticateJWT, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM meetings WHERE created_by = $1 ORDER BY start_time DESC',
    [req.user.id]
  );
  res.json(result.rows);
});

module.exports = router;
