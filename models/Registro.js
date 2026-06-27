import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  data: { type: String, required: true }, // 'YYYY-MM-DD'
  batidas: [String],
  observacao: String
}, { timestamps: true })
schema.index({ userId: 1, data: 1 }, { unique: true })
export default mongoose.models.Registro || mongoose.model('Registro', schema)
