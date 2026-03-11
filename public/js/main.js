const socket = io();
let currentView = 'home';
let friends = [];
let groups = [];

// DOM Elements
const friendsList = document.getElementById('friends-list');
const groupsList = document.getElementById('groups-list');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const notiBadge = document.getElementById('noti-badge');
const notiList = document.getElementById('notifications-list');

// Initialize
if (currentUser) {
    socket.emit('join', currentUser.id);
    loadFriends();
    loadGroups();
    loadNotifications();
    updateProfileUI();
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        switchView(view);
    });
});

function switchView(view) {
    document.querySelectorAll('#main-content > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${view}-view`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
    
    currentView = view;
}

document.getElementById('search-btn').addEventListener('click', () => {
    switchView('search');
});

document.getElementById('noti-btn').addEventListener('click', () => {
    switchView('notifications');
});

// Search
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (!q) {
        searchResults.innerHTML = '';
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        const res = await apiFetch(`/api/users/search?q=${q}`);
        const users = await res.json();
        renderSearchResults(users);
    }, 500);
});

function renderSearchResults(users) {
    if (users.length === 0) {
        searchResults.innerHTML = '<p class="text-center opacity-50">USER_NOT_FOUND</p>';
        return;
    }
    
    searchResults.innerHTML = users.map(user => `
        <div class="flex items-center justify-between p-3 border border-green-900 bg-green-900/5">
            <div class="flex items-center gap-3">
                <img src="${getAvatar(user.profilePic)}" class="w-10 h-10 rounded-full border border-green-500">
                <div>
                    <div class="font-bold">${user.name}</div>
                    <div class="text-xs opacity-50">@${user.username}</div>
                </div>
            </div>
            <button onclick="sendFriendRequest('${user._id}')" class="text-xs border border-green-500 px-2 py-1 hover:bg-green-500 hover:text-black transition-all">SEND_REQ</button>
        </div>
    `).join('');
}

async function sendFriendRequest(recipientId) {
    const res = await apiFetch('/api/users/friend-request', {
        method: 'POST',
        body: JSON.stringify({ recipientId })
    });
    if (res.ok) {
        alert('REQUEST_SENT');
    } else {
        const data = await res.json();
        alert(data.message);
    }
}

// Friends & Groups Loading
async function loadFriends() {
    const res = await apiFetch('/api/users/friends');
    friends = await res.json();
    renderFriends();
}

function renderFriends() {
    friendsList.innerHTML = friends.map(friend => `
        <div onclick="openChat('${friend._id}')" class="flex items-center gap-4 p-3 border border-green-900/30 hover:border-green-500 cursor-pointer transition-all bg-green-900/5">
            <div class="relative">
                <img src="${getAvatar(friend.profilePic)}" class="w-12 h-12 rounded-full border border-green-900 object-cover">
                <span class="status-dot absolute bottom-0 right-0 border-2 border-black ${friend.online ? 'status-online' : 'status-offline'}"></span>
            </div>
            <div class="flex-1">
                <div class="font-bold flex justify-between">
                    <span>${friend.name}</span>
                    <span class="text-[10px] opacity-30">${friend.online ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
                <div class="text-xs opacity-50 italic">@${friend.username}</div>
            </div>
        </div>
    `).join('');
}

async function loadGroups() {
    const res = await apiFetch('/api/groups');
    groups = await res.json();
    renderGroups();
}

function renderGroups() {
    groupsList.innerHTML = groups.map(group => `
        <div onclick="openGroupChat('${group._id}')" class="flex items-center gap-4 p-3 border border-green-900/30 hover:border-green-500 cursor-pointer transition-all bg-green-900/5">
            <img src="${getAvatar(group.image)}" class="w-12 h-12 rounded-full border border-green-900 object-cover">
            <div class="flex-1">
                <div class="font-bold">${group.name}</div>
                <div class="text-xs opacity-50">${group.members.length} MEMBERS</div>
            </div>
        </div>
    `).join('');
}

// Notifications
async function loadNotifications() {
    const res = await apiFetch('/api/users/notifications');
    const requests = await res.json();
    renderNotifications(requests);
}

function renderNotifications(requests) {
    if (requests.length > 0) {
        notiBadge.textContent = requests.length;
        notiBadge.classList.remove('hidden');
    } else {
        notiBadge.classList.add('hidden');
    }
    
    notiList.innerHTML = requests.map(req => `
        <div class="flex items-center justify-between p-3 border border-green-900 bg-green-900/5">
            <div class="flex items-center gap-3">
                <img src="${getAvatar(req.sender.profilePic)}" class="w-10 h-10 rounded-full border border-green-500">
                <div>
                    <div class="font-bold">${req.sender.name}</div>
                    <div class="text-xs opacity-50">WANTS_TO_CONNECT</div>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="respondRequest('${req._id}', 'accepted')" class="bg-green-500 text-black text-[10px] font-bold px-2 py-1">ACCEPT</button>
                <button onclick="respondRequest('${req._id}', 'rejected')" class="border border-red-500 text-red-500 text-[10px] px-2 py-1">REJECT</button>
            </div>
        </div>
    `).join('');
}

async function respondRequest(id, status) {
    await apiFetch(`/api/users/friend-request/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status })
    });
    loadNotifications();
    loadFriends();
}

// Profile
function updateProfileUI() {
    document.getElementById('profile-img').src = getAvatar(currentUser.profilePic);
    document.getElementById('profile-name').value = currentUser.name;
}

document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value;
    const password = document.getElementById('profile-pass').value;
    const fileInput = document.getElementById('profile-pic-input');
    
    const formData = new FormData();
    formData.append('name', name);
    if (password) formData.append('password', password);
    if (fileInput.files[0]) formData.append('profilePic', fileInput.files[0]);
    
    const res = await apiFetch('/api/users/profile', {
        method: 'PUT',
        headers: {}, // Let browser set boundary
        body: formData
    });
    
    if (res.ok) {
        const updated = await res.json();
        localStorage.setItem('user', JSON.stringify(updated));
        alert('PROFILE_UPDATED');
        location.reload();
    }
});

// Group Creation
document.getElementById('create-group-btn').addEventListener('click', () => {
    document.getElementById('group-modal').classList.remove('hidden');
    const select = document.getElementById('group-members-select');
    select.innerHTML = friends.map(f => `
        <label class="flex items-center gap-3 p-2 hover:bg-green-900/20 cursor-pointer">
            <input type="checkbox" value="${f._id}" class="accent-green-500">
            <img src="${getAvatar(f.profilePic)}" class="w-6 h-6 rounded-full">
            <span class="text-sm">${f.name}</span>
        </label>
    `).join('');
});

document.getElementById('cancel-group-btn').addEventListener('click', () => {
    document.getElementById('group-modal').classList.add('hidden');
});

document.getElementById('confirm-group-btn').addEventListener('click', async () => {
    const name = document.getElementById('group-name-input').value;
    const members = Array.from(document.querySelectorAll('#group-members-select input:checked')).map(i => i.value);
    
    if (!name || members.length === 0) return alert('NAME_AND_MEMBERS_REQUIRED');
    
    const res = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name, members: JSON.stringify(members) })
    });
    
    if (res.ok) {
        document.getElementById('group-modal').classList.add('hidden');
        loadGroups();
    }
});

// Navigation Functions
function openChat(userId) {
    window.location.href = `/chat.html?userId=${userId}`;
}

function openGroupChat(groupId) {
    window.location.href = `/group-chat.html?groupId=${groupId}`;
}

// Socket Events
socket.on('userStatus', ({ userId, online }) => {
    const friend = friends.find(f => f._id === userId);
    if (friend) {
        friend.online = online;
        renderFriends();
    }
});

socket.on('newMessage', (msg) => {
    // Show notification if not in chat
    if (!window.location.pathname.includes('chat.html')) {
        // Simple notification logic
        console.log('New message:', msg);
    }
});
