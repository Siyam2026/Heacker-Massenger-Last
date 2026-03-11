const API_URL = '';

async function apiFetch(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const response = await fetch(`${API_URL}${endpoint}`, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        return;
    }
    
    return response;
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getAvatar(path) {
    return path || '/uploads/default-avatar.png';
}

// IndexedDB for Offline Support
const dbName = 'HackerMessengerDB';
const dbVersion = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('outbox')) {
                db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('messages')) {
                db.createObjectStore('messages', { keyPath: '_id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveToOutbox(message) {
    const db = await openDB();
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').add({ ...message, status: 'sending', timestamp: Date.now() });
    return tx.complete;
}

async function getOutbox() {
    const db = await openDB();
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

async function clearOutboxItem(id) {
    const db = await openDB();
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').delete(id);
    return tx.complete;
}
