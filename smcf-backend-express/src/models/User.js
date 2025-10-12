const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String, index: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  age: { type: Number }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
