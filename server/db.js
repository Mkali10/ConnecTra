require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initConnecTraDB() {
  console.log('🚀 Initializing ConnecTra Database...');
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      subscription_end DATE NOT NULL,
      company_id INT,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      logo_url TEXT,
      branding JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      host_id INT REFERENCES users(id),
      guest_id INT REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'active',
      recording_local TEXT,
      recording_s3 TEXT,
      ai_agent BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      start_time TIMESTAMP,
      ppt_url TEXT,
      ai_config JSONB,
      created_by INT REFERENCES users(id)
    );
  `);

  // ConnecTra Admin User
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASS || 'ConnecTra2025!', 12);
  await pool.query(`
    INSERT INTO users (email, password_hash, subscription_end, role) 
    VALUES ('${process.env.ADMIN_EMAIL}', $1, '2026-12-31', 'admin')
    ON CONFLICT (email) DO NOTHING`, [adminHash]);

  // Demo Company
  await pool.query(`
    INSERT INTO companies (name, logo_url, branding) 
    VALUES ('ConnecTra Inc.', 'https://via.placeholder.com/150x50/00aaff/ffffff?text=ConnecTra', 
    '{"name": "ConnecTra Inc.", "designation": "CEO", "details": "Remote Access Leader", "theme": "blue"}')
    ON CONFLICT (name) DO NOTHING`);

  console.log('✅ ConnecTra Database Ready!');
}

initConnecTraDB().catch(console.error);
