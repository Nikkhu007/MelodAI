/**
 * Quick fix - resets demo account passwords
 * Run: node fix_login.js (from backend folder)
 */
require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  const User = require('./models/User')

  // Find all demo accounts
  const accounts = [
    { email: 'test@melodai.com',  password: 'test123',  username: 'testuser' },
    { email: 'admin@melodai.com', password: 'admin123', username: 'admin', role: 'admin' },
  ]

  for (const acc of accounts) {
    const hash = await bcrypt.hash(acc.password, 12)

    const result = await User.findOneAndUpdate(
      { email: acc.email },
      {
        $set: {
          password:   hash,
          username:   acc.username,
          isActive:   true,
          role:       acc.role || 'user',
        }
      },
      { upsert: true, new: true }
    )

    console.log(`✅ ${acc.email} / ${acc.password}  →  ${result._id}`)
  }

  console.log('\nDone! Try logging in now.')
  process.exit(0)
}

fix().catch(err => {
  console.error('Failed:', err.message)
  process.exit(1)
})