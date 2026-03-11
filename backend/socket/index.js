import User from '../models/User.js';
import Message from '../models/Message.js';

const users = new Map(); // userId -> socketId

export default (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', async (userId) => {
      users.set(userId, socket.id);
      socket.userId = userId;
      await User.findByIdAndUpdate(userId, { online: true });
      io.emit('userStatus', { userId, online: true });
    });

    socket.on('sendMessage', async (data) => {
      const { recipientId, groupId, content, type, fileUrl, fileName, replyTo } = data;
      
      const message = await Message.create({
        sender: socket.userId,
        recipient: recipientId,
        group: groupId,
        content,
        type,
        fileUrl,
        fileName,
        replyTo
      });

      const populatedMessage = await Message.findById(message._id).populate('sender', 'name profilePic').populate('replyTo');

      if (groupId) {
        io.to(groupId).emit('newMessage', populatedMessage);
      } else {
        const recipientSocketId = users.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('newMessage', populatedMessage);
        }
        socket.emit('newMessage', populatedMessage);
      }
    });

    socket.on('joinGroup', (groupId) => {
      socket.join(groupId);
    });

    socket.on('typing', (data) => {
      const { recipientId, groupId, isTyping } = data;
      if (groupId) {
        socket.to(groupId).emit('userTyping', { userId: socket.userId, groupId, isTyping });
      } else {
        const recipientSocketId = users.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('userTyping', { userId: socket.userId, isTyping });
        }
      }
    });

    // WebRTC Signaling
    socket.on('callUser', (data) => {
      const { userToCall, signalData, from, name } = data;
      const recipientSocketId = users.get(userToCall);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('callUser', { signal: signalData, from, name });
      }
    });

    socket.on('answerCall', (data) => {
      const recipientSocketId = users.get(data.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('callAccepted', data.signal);
      }
    });

    socket.on('disconnect', async () => {
      if (socket.userId) {
        users.delete(socket.userId);
        await User.findByIdAndUpdate(socket.userId, { online: false, lastSeen: new Date() });
        io.emit('userStatus', { userId: socket.userId, online: false });
      }
      console.log('User disconnected');
    });
  });
};
