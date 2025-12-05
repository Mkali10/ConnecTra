const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const authenticateJWT = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'ConnecTra: No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    
    if (!user || new Date() > new Date(user.subscription_end)) {
      return res.status(403).json({ error: 'ConnecTra: Subscription expired' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: 'ConnecTra: Invalid token' });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'ConnecTra: Admin access required' });
    }
    next();
  } catch (err) {
    res.status(403).json({ error: 'ConnecTra: Admin verification failed' });
  }
};

module.exports = { authenticateJWT, authenticateAdmin };
