const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const recipientId = urlParams.get('userId');
let messages = [];
let replyTo = null;

// DOM Elements
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatUserName = document.getElementById('chat-user-name');
const chatUserImg = document.getElementById('chat-user-img');
const chatUserStatus = document.getElementById('chat-user-status');
const chatTypingStatus = document.getElementById('chat-typing-status');
const replyPreview = document.getElementById('reply-preview');
const replyText = document.getElementById('reply-text');
const cancelReply = document.getElementById('cancel-reply');
const fileInput = document.getElementById('file-input');

// Initialize
if (currentUser && recipientId) {
    socket.emit('join', currentUser.id);
    loadRecipientInfo();
    loadMessages();
}

async function loadRecipientInfo() {
    const res = await apiFetch(`/api/users/friends`);
    const friends = await res.json();
    const friend = friends.find(f => f._id === recipientId);
    if (friend) {
        chatUserName.textContent = friend.name;
        chatUserImg.src = getAvatar(friend.profilePic);
        chatUserStatus.className = `status-dot absolute bottom-0 right-0 border border-black ${friend.online ? 'status-online' : 'status-offline'}`;
    }
}

async function loadMessages() {
    const res = await apiFetch(`/api/chats/${recipientId}`);
    messages = await res.json();
    renderMessages();
    scrollToBottom();
}

function renderMessages() {
    messagesContainer.innerHTML = messages.map(msg => renderMessageItem(msg)).join('');
}

function renderMessageItem(msg) {
    const isMe = msg.sender === currentUser.id || msg.sender?._id === currentUser.id;
    return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}" id="msg-${msg._id || msg.id}">
            ${msg.replyTo ? `
                <div class="text-[10px] opacity-30 mb-1 px-2 border-l border-green-500 ml-2">
                    REPLYING_TO: ${msg.replyTo.content || 'FILE'}
                </div>
            ` : ''}
            <div class="message-bubble ${isMe ? 'message-sent' : 'message-received'} group relative">
                ${msg.type === 'text' ? `<p>${msg.content}</p>` : ''}
                ${msg.type === 'image' ? `<img src="${msg.fileUrl}" class="max-w-full rounded cursor-pointer" onclick="window.open('${msg.fileUrl}')">` : ''}
                ${msg.type === 'audio' ? `<audio src="${msg.fileUrl}" controls class="max-w-full"></audio>` : ''}
                ${msg.type === 'file' ? `<a href="${msg.fileUrl}" target="_blank" class="flex items-center gap-2 text-xs underline"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14.5 2 14.5 7.5 20 7.5"/></svg> ${msg.fileName}</a>` : ''}
                
                <div class="flex justify-between items-center mt-1 gap-4">
                    <span class="text-[8px] opacity-30">${formatDate(msg.createdAt || Date.now())}</span>
                    ${isMe ? `<span class="text-[8px] status-text ${msg.status === 'seen' ? 'text-green-400' : 'opacity-30'}">${msg.status.toUpperCase()}</span>` : ''}
                </div>

                <!-- Actions -->
                <div class="absolute ${isMe ? '-left-12' : '-right-12'} top-0 hidden group-hover:flex flex-col gap-1 bg-black/80 p-1 border border-green-900 z-10">
                    <button onclick="setReply('${msg._id}', '${msg.content || 'FILE'}')" class="p-1 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
                    ${isMe ? `
                        <button onclick="deleteMessage('${msg._id}')" class="p-1 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Sending Messages
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content && !fileInput.files.length) return;

    if (!navigator.onLine) {
        const offlineMsg = {
            id: Date.now(),
            sender: currentUser.id,
            recipientId,
            content,
            type: 'text',
            replyTo,
            createdAt: new Date()
        };
        await saveToOutbox(offlineMsg);
        messages.push(offlineMsg);
        renderMessages();
        scrollToBottom();
        messageInput.value = '';
        clearReply();
        return;
    }

    socket.emit('sendMessage', {
        recipientId,
        content,
        type: 'text',
        replyTo
    });

    messageInput.value = '';
    clearReply();
}

// File Upload
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const res = await apiFetch('/api/chats/upload', {
        method: 'POST',
        headers: {},
        body: formData
    });

    const uploadedFiles = await res.json();
    uploadedFiles.forEach(file => {
        socket.emit('sendMessage', {
            recipientId,
            type: file.type,
            fileUrl: file.url,
            fileName: file.name
        });
    });
    fileInput.value = '';
});

// Reply Logic
function setReply(id, text) {
    replyTo = id;
    replyText.textContent = text;
    replyPreview.classList.remove('hidden');
    messageInput.focus();
}

function clearReply() {
    replyTo = null;
    replyPreview.classList.add('hidden');
}

cancelReply.addEventListener('click', clearReply);

// Typing Indicator
let typingTimeout;
messageInput.addEventListener('input', () => {
    socket.emit('typing', { recipientId, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { recipientId, isTyping: false });
    }, 2000);
});

// Socket Events
socket.on('newMessage', (msg) => {
    if (msg.sender._id === recipientId || msg.sender === recipientId || msg.sender._id === currentUser.id || msg.sender === currentUser.id) {
        messages.push(msg);
        renderMessages();
        scrollToBottom();
    }
});

socket.on('userTyping', ({ userId, isTyping }) => {
    if (userId === recipientId) {
        chatTypingStatus.textContent = isTyping ? 'TYPING...' : '';
    }
});

socket.on('userStatus', ({ userId, online }) => {
    if (userId === recipientId) {
        chatUserStatus.className = `status-dot absolute bottom-0 right-0 border border-black ${online ? 'status-online' : 'status-offline'}`;
    }
});

// Offline Sync
window.addEventListener('online', async () => {
    const outbox = await getOutbox();
    for (const msg of outbox) {
        socket.emit('sendMessage', msg);
        await clearOutboxItem(msg.id);
    }
});

// Voice Recording
let mediaRecorder;
let audioChunks = [];
const voiceBtn = document.getElementById('voice-btn');

voiceBtn.addEventListener('mousedown', startRecording);
voiceBtn.addEventListener('mouseup', stopRecording);
voiceBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('files', audioBlob, `voice_${Date.now()}.webm`);
            
            const res = await apiFetch('/api/chats/upload', {
                method: 'POST',
                headers: {},
                body: formData
            });
            
            const uploaded = await res.json();
            socket.emit('sendMessage', {
                recipientId,
                type: 'audio',
                fileUrl: uploaded[0].url,
                fileName: 'VOICE_MSG'
            });
        };
        
        mediaRecorder.start();
        voiceBtn.classList.add('text-red-500', 'animate-pulse');
    } catch (err) {
        alert('MICROPHONE_ACCESS_DENIED');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        voiceBtn.classList.remove('text-red-500', 'animate-pulse');
    }
}

// WebRTC Call Logic (Simple-Peer)
let peer;
let stream;
const callOverlay = document.getElementById('call-overlay');
const callName = document.getElementById('call-name');
const callStatus = document.getElementById('call-status');
const endCallBtn = document.getElementById('end-call-btn');
const acceptCallBtn = document.getElementById('accept-call-btn');

document.getElementById('call-btn').addEventListener('click', startCall);

async function startCall() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        callOverlay.classList.remove('hidden');
        callName.textContent = chatUserName.textContent;
        callStatus.textContent = 'CALLING...';
        
        peer = new SimplePeer({ initiator: true, trickle: false, stream });
        
        peer.on('signal', data => {
            socket.emit('callUser', {
                userToCall: recipientId,
                signalData: data,
                from: currentUser.id,
                name: currentUser.name
            });
        });
        
        peer.on('stream', remoteStream => {
            const audio = document.createElement('audio');
            audio.srcObject = remoteStream;
            audio.play();
            callStatus.textContent = 'CONNECTED';
        });
    } catch (err) {
        alert('MICROPHONE_ACCESS_DENIED');
    }
}

socket.on('callUser', ({ signal, from, name }) => {
    if (from !== recipientId) return; // Only accept calls from current chat for simplicity
    
    callOverlay.classList.remove('hidden');
    acceptCallBtn.classList.remove('hidden');
    callName.textContent = name;
    callStatus.textContent = 'INCOMING_CALL...';
    
    acceptCallBtn.onclick = async () => {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        peer = new SimplePeer({ initiator: false, trickle: false, stream });
        
        peer.on('signal', data => {
            socket.emit('answerCall', { signal: data, to: from });
        });
        
        peer.on('stream', remoteStream => {
            const audio = document.createElement('audio');
            audio.srcObject = remoteStream;
            audio.play();
            callStatus.textContent = 'CONNECTED';
        });
        
        peer.signal(signal);
        acceptCallBtn.classList.add('hidden');
    };
});

socket.on('callAccepted', signal => {
    peer.signal(signal);
});

endCallBtn.addEventListener('click', () => {
    if (peer) peer.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    callOverlay.classList.add('hidden');
    acceptCallBtn.classList.add('hidden');
});

async function deleteMessage(id) {
    if (confirm('DELETE_FOR_EVERYONE?')) {
        const res = await apiFetch(`/api/chats/${id}`, { method: 'DELETE' });
        if (res.ok) {
            messages = messages.filter(m => m._id !== id);
            renderMessages();
        }
    }
}
