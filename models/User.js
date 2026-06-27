import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true })
export default mongoose.models.User || mongoose.model('User', schema)
