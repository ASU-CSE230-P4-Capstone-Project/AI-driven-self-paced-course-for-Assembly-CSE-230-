import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const databaseUrl = process.env.DATABASE_URL
  const jwtSecret = process.env.JWT_SECRET

  if (!databaseUrl || !jwtSecret) {
    return res.status(500).json({ error: 'Server auth configuration is missing' })
  }

  const { username, password, role } = req.body ?? {}

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT id, username, role, password_hash
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const user = rows[0]

    if (role && user.role !== role) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        username: user.username,
      },
      jwtSecret,
      { expiresIn: '24h' },
    )

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login failed', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
