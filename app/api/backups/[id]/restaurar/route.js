import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Backup from '@/models/Backup'
import Registro from '@/models/Registro'
import Config from '@/models/Config'

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const backup = await Backup.findOne({ _id: id, userId: session.user.id })
  if (!backup) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { registros, config } = backup.dados || {}

  // Restaurar registros: apaga todos os do usuário e recria
  await Registro.deleteMany({ userId: session.user.id })

  if (registros && Array.isArray(registros)) {
    const novosRegistros = registros.map(r => ({
      userId: session.user.id,
      data: r.data,
      batidas: r.batidas || [],
      observacao: r.observacao || ''
    }))
    if (novosRegistros.length > 0) {
      await Registro.insertMany(novosRegistros, { ordered: false })
    }
  }

  // Restaurar config
  if (config) {
    const { _id, userId, __v, createdAt, updatedAt, ...configData } = config
    await Config.findOneAndUpdate(
      { userId: session.user.id },
      { $set: configData },
      { upsert: true }
    )
  }

  return NextResponse.json({ ok: true, totalRestaurados: registros?.length || 0 })
}
