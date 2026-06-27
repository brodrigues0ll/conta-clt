import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Backup from '@/models/Backup'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const backup = await Backup.findOne({ _id: id, userId: session.user.id }).lean()
  if (!backup) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({ backup })
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const backup = await Backup.findOneAndDelete({ _id: id, userId: session.user.id })
  if (!backup) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
