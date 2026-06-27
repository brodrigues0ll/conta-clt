import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Registro from '@/models/Registro'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const mes    = searchParams.get('mes')
  const ano    = searchParams.get('ano')
  const search = searchParams.get('search')
  const page   = parseInt(searchParams.get('page') || '1')
  const limit  = parseInt(searchParams.get('limit') || '50')

  const filter = { userId: session.user.id }

  if (mes && ano) {
    const prefix = `${ano}-${String(mes).padStart(2,'0')}`
    filter.data = { $regex: `^${prefix}` }
  } else if (ano) {
    filter.data = { $regex: `^${ano}-` }
  }

  if (search) {
    filter.$or = [
      { data: { $regex: search, $options: 'i' } },
      { observacao: { $regex: search, $options: 'i' } }
    ]
  }

  const total = await Registro.countDocuments(filter)
  const registros = await Registro.find(filter)
    .sort({ data: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  return NextResponse.json({ registros, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { data, batidas, observacao } = body

  if (!data) return NextResponse.json({ error: 'Data obrigatória' }, { status: 400 })
  if (!batidas || !Array.isArray(batidas)) return NextResponse.json({ error: 'Batidas inválidas' }, { status: 400 })

  await connectDB()

  const existing = await Registro.findOne({ userId: session.user.id, data })
  if (existing) return NextResponse.json({ error: 'Registro já existe para esta data' }, { status: 409 })

  const registro = await Registro.create({
    userId: session.user.id,
    data,
    batidas: batidas.filter(b => b && b.trim()),
    observacao: observacao || ''
  })

  return NextResponse.json({ registro }, { status: 201 })
}
