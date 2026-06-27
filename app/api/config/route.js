import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Config from '@/models/Config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  let config = await Config.findOne({ userId: session.user.id }).lean()

  if (!config) {
    config = await Config.create({ userId: session.user.id })
    config = config.toObject()
  }

  return NextResponse.json({ config })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  await connectDB()

  const config = await Config.findOneAndUpdate(
    { userId: session.user.id },
    { $set: body },
    { new: true, upsert: true }
  ).lean()

  return NextResponse.json({ config })
}
