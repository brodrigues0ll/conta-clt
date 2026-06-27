import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nome: String,
  tamanho: Number,
  totalRegistros: Number,
  dados: mongoose.Schema.Types.Mixed
}, { timestamps: true })
export default mongoose.models.Backup || mongoose.model('Backup', schema)
