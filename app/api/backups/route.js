import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Backup from '@/models/Backup'
import Registro from '@/models/Registro'
import Config from '@/models/Config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  const backups = await Backup.find({ userId: session.user.id })
    .select('-dados')
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json({ backups })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome } = body

  await connectDB()

  const registros = await Registro.find({ userId: session.user.id }).lean()
  const config    = await Config.findOne({ userId: session.user.id }).lean()

  const dados = { registros, config, exportedAt: new Date().toISOString(), version: '1.0' }
  const dadosStr = JSON.stringify(dados)
  const tamanho = Buffer.byteLength(dadosStr, 'utf8')

  const backup = await Backup.create({
    userId: session.user.id,
    nome: nome || `Backup ${new Date().toLocaleDateString('pt-BR')}`,
    tamanho,
    totalRegistros: registros.length,
    dados
  })

  return NextResponse.json({ backup }, { status: 201 })
}
