const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (user && await bcrypt.compare(password, user.password_hash) && 
        new Date() <= new Date(user.subscription_end)) {
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.json({ 
        token, 
        user: { id: user.id, email: user.email, role: user.role, subscription_end: user.subscription_end }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials or expired subscription' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, company_id } = req.body;
    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, subscription_end, company_id) VALUES ($1, $2, $3, $4) RETURNING id, email',
      [email, password_hash, '2025-12-31', company_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

module.exports = router;
