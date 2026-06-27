import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Registro from '@/models/Registro'

/**
 * POST /api/registros/importar
 * body: { registros: [...], modo: 'merge' | 'replace' }
 *
 * merge:   importa apenas datas novas (ignora conflitos)
 * replace: importa todos, substituindo registros existentes
 *
 * Usa bulkWrite para processar centenas de registros em 2 roundtrips
 * ao invés de N×2 queries sequenciais.
 */
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { registros, modo = 'merge' } = body

  if (!Array.isArray(registros)) {
    return NextResponse.json({ error: 'registros deve ser um array' }, { status: 400 })
  }

  await connectDB()
  const userId = session.user.id

  // Filtrar registros válidos
  const validos = registros.filter(r => r.data && Array.isArray(r.batidas) && r.batidas.some(b => b && b.trim()))

  if (validos.length === 0) {
    return NextResponse.json({ importados: 0, ignorados: 0, substituidos: 0 })
  }

  const datas = validos.map(r => r.data)

  if (modo === 'merge') {
    // 1 query: buscar quais datas já existem
    const existentes = await Registro.find({ userId, data: { $in: datas } }).select('data').lean()
    const existentesSet = new Set(existentes.map(e => e.data))

    const novos = validos.filter(r => !existentesSet.has(r.data))
    const ignorados = validos.length - novos.length

    if (novos.length > 0) {
      await Registro.insertMany(
        novos.map(r => ({
          userId,
          data: r.data,
          batidas: r.batidas.filter(b => b && b.trim()),
          observacao: r.observacao || ''
        })),
        { ordered: false }
      )
    }

    return NextResponse.json({ importados: novos.length, ignorados, substituidos: 0 })
  }

  // replace: upsert de todos com bulkWrite
  const ops = validos.map(r => ({
    updateOne: {
      filter: { userId, data: r.data },
      update: {
        $set: {
          batidas: r.batidas.filter(b => b && b.trim()),
          observacao: r.observacao || ''
        },
        $setOnInsert: { userId, data: r.data }
      },
      upsert: true
    }
  }))

  const result = await Registro.bulkWrite(ops, { ordered: false })

  return NextResponse.json({
    importados:   result.upsertedCount,
    ignorados:    0,
    substituidos: result.modifiedCount
  })
}
