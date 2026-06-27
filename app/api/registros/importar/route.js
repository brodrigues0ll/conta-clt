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

  let importados  = 0
  let ignorados   = 0
  let substituidos = 0

  for (const r of registros) {
    if (!r.data || !Array.isArray(r.batidas)) continue

    const batidas = r.batidas.filter(b => b && b.trim())
    if (batidas.length === 0) continue

    const existing = await Registro.findOne({ userId, data: r.data })

    if (existing) {
      if (modo === 'replace') {
        await Registro.updateOne(
          { userId, data: r.data },
          { $set: { batidas, observacao: r.observacao || '' } }
        )
        substituidos++
      } else {
        ignorados++
      }
    } else {
      await Registro.create({ userId, data: r.data, batidas, observacao: r.observacao || '' })
      importados++
    }
  }

  return NextResponse.json({ importados, ignorados, substituidos })
}
