import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For 1:1
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // For Group
  content: { type: String },
  type: { type: String, enum: ['text', 'image', 'audio', 'file'], default: 'text' },
  fileUrl: { type: String },
  fileName: { type: String },
  status: { type: String, enum: ['sending', 'sent', 'seen'], default: 'sent' },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
