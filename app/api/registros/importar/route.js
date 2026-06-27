import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Registro from '@/models/Registro'

function horaParaMin(h) {
  const [hh, mm] = h.split(':').map(Number)
  return hh * 60 + mm
}

/* Mesma lógica do frontend: remove batidas dentro de 3 min da anterior */
function deduplicarBatidas(batidas, tol = 3) {
  const sorted = [...batidas].sort((a, b) => horaParaMin(a) - horaParaMin(b))
  const result = []
  for (const b of sorted) {
    const min  = horaParaMin(b)
    const prev = result.length > 0 ? horaParaMin(result[result.length - 1]) : -999
    if (min - prev > tol) result.push(b)
  }
  return result
}

/**
 * POST /api/registros/importar
 * body: { registros: [...], modo: 'completar' | 'substituir' }
 *
 * completar  (padrão): insere dias novos + completa com pontos faltantes
 *                      dias que já existem mas têm menos batidas
 * substituir:          insere dias novos + sobrescreve todos os existentes
 */
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { registros, modo = 'completar' } = body

  if (!Array.isArray(registros)) {
    return NextResponse.json({ error: 'registros deve ser um array' }, { status: 400 })
  }

  await connectDB()
  const userId = session.user.id

  const validos = registros.filter(r =>
    r.data && Array.isArray(r.batidas) && r.batidas.some(b => b && b.trim())
  )

  if (validos.length === 0) {
    return NextResponse.json({ importados: 0, completados: 0, substituidos: 0, ignorados: 0 })
  }

  const datas = validos.map(r => r.data)

  /* ── substituir: upsert completo de todos os registros ── */
  if (modo === 'substituir') {
    const ops = validos.map(r => ({
      updateOne: {
        filter: { userId, data: r.data },
        update: {
          $set: { batidas: r.batidas.filter(b => b && b.trim()), observacao: r.observacao || '' },
          $setOnInsert: { userId, data: r.data }
        },
        upsert: true
      }
    }))
    const result = await Registro.bulkWrite(ops, { ordered: false })
    return NextResponse.json({
      importados:   result.upsertedCount,
      completados:  0,
      substituidos: result.modifiedCount,
      ignorados:    0
    })
  }

  /* ── completar (padrão): smart merge ── */

  // 1 query para buscar todos os registros existentes das datas relevantes
  const existentes = await Registro.find({ userId, data: { $in: datas } })
    .select('data batidas')
    .lean()
  const existentesMap = new Map(existentes.map(e => [e.data, e.batidas || []]))

  const novos       = validos.filter(r => !existentesMap.has(r.data))
  let   importados  = 0
  let   completados = 0
  let   ignorados   = 0

  const opsCompletar = []

  for (const r of validos.filter(r => existentesMap.has(r.data))) {
    const eb     = existentesMap.get(r.data)
    const novas  = r.batidas.filter(b => b && b.trim())
    const merged = deduplicarBatidas([...eb, ...novas])

    if (merged.length > eb.length) {
      // Tem pontos novos a acrescentar
      opsCompletar.push({
        updateOne: {
          filter: { userId, data: r.data },
          update: { $set: { batidas: merged } }
        }
      })
    } else {
      ignorados++
    }
  }

  // Inserir dias novos em lote
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
    importados = novos.length
  }

  // Completar dias existentes com pontos faltantes
  if (opsCompletar.length > 0) {
    await Registro.bulkWrite(opsCompletar, { ordered: false })
    completados = opsCompletar.length
  }

  return NextResponse.json({ importados, completados, substituidos: 0, ignorados })
}
