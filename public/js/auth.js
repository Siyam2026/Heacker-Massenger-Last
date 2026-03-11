function checkAuth() {
    const user = localStorage.getItem('user');
    const path = window.location.pathname;
    
    if (!user && path !== '/login.html' && path !== '/register.html') {
        window.location.href = '/login.html';
    } else if (user && (path === '/login.html' || path === '/register.html')) {
        window.location.href = '/';
    }
    
    return user ? JSON.parse(user) : null;
}

const currentUser = checkAuth();

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

if (document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').addEventListener('click', logout);
}
