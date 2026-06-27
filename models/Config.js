import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  salario: { type: Number, default: 0 },
  horasMensais: { type: Number, default: 220 },
  jornadaDiaria: { type: Number, default: 8 },
  percentualHoraExtra: { type: Number, default: 50 },
  nomeEmpresa: { type: String, default: '' },
  nomeFuncionario: { type: String, default: '' },
  toleranciaHoraExtra: { type: Number, default: 0 },
  sabadoHoraExtra: { type: Boolean, default: true },
  adicionalSabado: { type: Boolean, default: true },
  percentualAdicionalSabado: { type: Number, default: 50 },
  domingoHoraExtra: { type: Boolean, default: true },
  adicionalDomingo: { type: Boolean, default: true },
  percentualAdicionalDomingo: { type: Number, default: 100 },
  adicionalFeriado: { type: Boolean, default: true },
  percentualAdicionalFeriado: { type: Number, default: 100 },
  calcularNoturno: { type: Boolean, default: true },
  percentualAdicionalNoturno: { type: Number, default: 20 },
  horaNoturnaReduzida: { type: Boolean, default: true },
  verificarIntrajornada: { type: Boolean, default: true },
  exibirTotalDia: { type: Boolean, default: true },
  feriadosPersonalizados: { type: Array, default: [] }
}, { timestamps: true })
export default mongoose.models.Config || mongoose.model('Config', schema)
