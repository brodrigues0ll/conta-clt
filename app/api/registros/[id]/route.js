import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Registro from '@/models/Registro'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const registro = await Registro.findOne({ _id: id, userId: session.user.id }).lean()
  if (!registro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({ registro })
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { data, batidas, observacao } = body

  await connectDB()
  const { id } = await params
  const registro = await Registro.findOne({ _id: id, userId: session.user.id })
  if (!registro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  if (data) registro.data = data
  if (batidas) registro.batidas = batidas.filter(b => b && b.trim())
  if (observacao !== undefined) registro.observacao = observacao

  await registro.save()
  return NextResponse.json({ registro })
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const registro = await Registro.findOneAndDelete({ _id: id, userId: session.user.id })
  if (!registro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
