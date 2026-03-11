import express from 'express';
import Message from '../models/Message.js';
import { protect } from '../middleware/auth.js';
import multer from 'multer';

const router = express.Router();
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

router.get('/:userId', protect, async (req, res) => {
  const messages = await Message.find({
    $or: [
      { sender: req.user._id, recipient: req.params.userId },
      { sender: req.params.userId, recipient: req.user._id }
    ]
  }).sort({ createdAt: 1 }).populate('replyTo');
  res.json(messages);
});

router.post('/upload', protect, upload.array('files'), (req, res) => {
  const files = req.files.map(f => ({
    url: `/uploads/${f.filename}`,
    name: f.originalname,
    type: f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('audio/') ? 'audio' : 'file'
  }));
  res.json(files);
});

router.delete('/:id', protect, async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  await message.deleteOne();
  res.json({ id: req.params.id });
});

router.put('/:id', protect, async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  message.content = req.body.content;
  await message.save();
  res.json(message);
});

export default router;
