require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const multer = require('multer');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { 
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const s3 = new AWS.S3({ 
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('../client'));
app.use('/admin', express.static('../admin'));
app.use('/assets', express.static('../assets'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/auth/', limiter);

// JWT Auth Middleware
const authenticateJWT = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token.' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    
    if (!user || new Date() > new Date(user.subscription_end)) {
      return res.status(403).json({ error: 'Subscription expired. Please renew.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// 🔐 Authentication Routes
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (user && await bcrypt.compare(password, user.password_hash) && 
        new Date() <= new Date(user.subscription_end)) {
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { 
        expiresIn: '24h' 
      });
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          subscription_end: user.subscription_end 
        } 
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials or expired subscription' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/admin', async (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Admin access denied' });
  }
});

// 🚀 Session Management
app.post('/sessions/create', authenticateJWT, async (req, res) => {
  const { ai_agent = false } = req.body;
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  
  await pool.query(
    'INSERT INTO sessions (id, host_id, ai_agent, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionId, req.user.id, ai_agent, expiresAt]
  );
  
  res.json({ 
    sessionId, 
    signalingUrl: `wss://${req.get('host')}`,
    expiresAt: expiresAt.toISOString()
  });
});

app.get('/sessions/:id', authenticateJWT, async (req, res) => {
  const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
});

// 💾 File Transfer (Local + S3)
app.post('/files/transfer', authenticateJWT, upload.single('file'), async (req, res) => {
  try {
    const fileKey = `connec-tra/${Date.now()}-${req.file.originalname}`;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: fileKey,
      Body: require('fs').createReadStream(req.file.path),
      ContentType: req.file.mimetype
    };
    
    const result = await s3.upload(params).promise();
    require('fs').unlinkSync(req.file.path);
    
    res.json({ 
      url: result.Location,
      localPath: req.file.path,
      size: req.file.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗓️ Calendar/Meetings
app.post('/meetings/schedule', authenticateJWT, async (req, res) => {
  const { title, start_time, ppt_url, ai_config } = req.body;
  const result = await pool.query(
    'INSERT INTO meetings (title, start_time, ppt_url, ai_config, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, start_time, ppt_url, ai_config, req.user.id]
  );
  res.json(result.rows[0]);
});

// 👨‍💼 Admin Routes
app.get('/admin/users', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!jwt.verify(token, process.env.JWT_SECRET)?.role === 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  const result = await pool.query('SELECT id, email, subscription_end, role, created_at FROM users');
  res.json(result.rows);
});

app.post('/admin/users/:id/extend', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!jwt.verify(token, process.env.JWT_SECRET)?.role === 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  await pool.query(
    'UPDATE users SET subscription_end = subscription_end + INTERVAL \'30 days\' WHERE id = $1',
    [req.params.id]
  );
  res.json({ success: true });
});

// 🌐 WebSocket Signaling - ConnecTra Core [web:21]
const activeSessions = new Map();
io.on('connection', (socket) => {
  console.log(`🔗 ConnecTra Client connected: ${socket.id}`);
  
  // Session joining
  socket.on('join-session', async ({ sessionId, sdp, isOffer, userId }) => {
    socket.join(sessionId);
    console.log(`📡 ConnecTra session ${sessionId} joined by ${socket.id}`);
    
    // Notify other participants
    socket.to(sessionId).emit('connec-tra-offer', { sdp, from: socket.id, userId });
    
    // Update session guest
    if (isOffer && userId) {
      await pool.query(
        'UPDATE sessions SET guest_id = $1 WHERE id = $2 AND status = \'active\'',
        [userId, sessionId]
      );
    }
  });

  // WebRTC Signaling
  socket.on('connec-tra-answer', ({ to, sdp }) => {
    socket.to(to).emit('connec-tra-answer', { sdp });
  });

  socket.on('connec-tra-ice', ({ to, candidate }) => {
    socket.to(to).emit('connec-tra-ice', { candidate });
  });

  // 🎮 Remote Control
  socket.on('connec-tra-control', (data) => {
    socket.to(data.sessionId).emit('connec-tra-remote-control', {
      ...data,
      timestamp: Date.now()
    });
  });

  // 💬 Chat
  socket.on('connec-tra-chat', (data) => {
    socket.to(data.sessionId).emit('connec-tra-chat', {
      text: data.text,
      sender: data.sender,
      timestamp: new Date().toISOString()
    });
  });

  // 📹 Recording events
  socket.on('connec-tra-recording-start', (sessionId) => {
    socket.to(sessionId).emit('connec-tra-recording-active');
  });

  socket.on('disconnect', () => {
    console.log(`🔌 ConnecTra Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ConnecTra Server v1.0.0 running on http://localhost:${PORT}`);
  console.log(`📱 ConnecTra Client: http://localhost:${PORT}`);
  console.log(`👨‍💼 ConnecTra Admin: http://localhost:${PORT}/admin`);
  console.log(`🌐 LAN Mode: node client/lan.js`);
  console.log(`🔐 Admin: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASS}`);
});
