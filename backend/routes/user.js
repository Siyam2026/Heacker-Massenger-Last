import express from 'express';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
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

router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

router.put('/profile', protect, upload.single('profilePic'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.name) user.name = req.body.name;
    if (req.body.password) user.password = req.body.password;
    if (req.file) user.profilePic = `/uploads/${req.file.filename}`;
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/search', protect, async (req, res) => {
  const { q } = req.query;
  const users = await User.find({ 
    username: { $regex: q, $options: 'i' },
    _id: { $ne: req.user._id }
  }).select('name username profilePic');
  res.json(users);
});

router.post('/friend-request', protect, async (req, res) => {
  const { recipientId } = req.body;
  const existing = await FriendRequest.findOne({ sender: req.user._id, recipient: recipientId, status: 'pending' });
  if (existing) return res.status(400).json({ message: 'Request already sent' });
  
  const request = await FriendRequest.create({ sender: req.user._id, recipient: recipientId });
  res.json(request);
});

router.get('/notifications', protect, async (req, res) => {
  const requests = await FriendRequest.find({ recipient: req.user._id, status: 'pending' }).populate('sender', 'name username profilePic');
  res.json(requests);
});

router.post('/friend-request/:id/respond', protect, async (req, res) => {
  const { status } = req.body; // 'accepted' or 'rejected'
  const request = await FriendRequest.findById(req.id || req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  
  request.status = status;
  await request.save();

  if (status === 'accepted') {
    await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.recipient } });
    await User.findByIdAndUpdate(request.recipient, { $addToSet: { friends: request.sender } });
  }
  res.json(request);
});

router.get('/friends', protect, async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends', 'name username profilePic online lastSeen');
  res.json(user.friends);
});

export default router;
