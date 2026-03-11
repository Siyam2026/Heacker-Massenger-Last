import express from 'express';
import Group from '../models/Group.js';
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

router.post('/', protect, upload.single('image'), async (req, res) => {
  const { name, members } = req.body;
  const memberIds = JSON.parse(members);
  memberIds.push(req.user._id);
  
  const group = await Group.create({
    name,
    image: req.file ? `/uploads/${req.file.filename}` : undefined,
    creator: req.user._id,
    members: memberIds
  });
  res.status(201).json(group);
});

router.get('/', protect, async (req, res) => {
  const groups = await Group.find({ members: req.user._id });
  res.json(groups);
});

router.get('/:id/messages', protect, async (req, res) => {
  const messages = await Message.find({ group: req.params.id }).sort({ createdAt: 1 }).populate('sender', 'name profilePic').populate('replyTo');
  res.json(messages);
});

export default router;
