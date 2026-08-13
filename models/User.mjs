import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: String,
  verificationCode: String,
  verified: { type: Boolean, default: false },
  name: { type: String },
  preferredLang: { type: String, default: 'EN' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);