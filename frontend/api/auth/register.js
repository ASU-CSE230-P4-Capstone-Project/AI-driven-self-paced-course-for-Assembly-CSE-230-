import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'

const ALLOWED_ROLES = new Set(['student'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    return res.status(500).json({ error: 'Server auth configuration is missing' })
  }

  const { username, password, role } = req.body ?? {}

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }

  if (!ALLOWED_ROLES.has(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const sql = neon(databaseUrl)

    const inserted = await sql`
      INSERT INTO users (username, password_hash, role)
      VALUES (${username}, ${passwordHash}, ${role})
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username, role
    `

    if (!inserted.length) {
      return res.status(409).json({ error: 'Username already exists' })
    }

    return res.status(201).json({ user: inserted[0] })
  } catch (error) {
    console.error('Register failed', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
