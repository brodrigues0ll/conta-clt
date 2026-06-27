import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function POST(req) {
  const { name, email, password } = await req.json()
  if (!name || !email || !password) return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })
  await connectDB()
  const exists = await User.findOne({ email: email.toLowerCase() })
  if (exists) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
  const passwordHash = await bcrypt.hash(password, 12)
  await User.create({ name, email, passwordHash })
  return NextResponse.json({ ok: true }, { status: 201 })
}
