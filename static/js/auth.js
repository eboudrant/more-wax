// ─────────────────────────────────────────────────────────────────
//  AUTH — Google OAuth login gate & user avatar
// ─────────────────────────────────────────────────────────────────

let _authUser = null;
let _authEnabled = false;

async function checkAuth() {
  try {
    const res = await fetch('/auth/status');
    if (!res.ok) return true; // if auth endpoint fails, don't block
    const data = await res.json();
    _authEnabled = data.auth_enabled;
    if (!_authEnabled) return true; // auth disabled, proceed
    if (data.authenticated && data.user) {
      _authUser = data.user;
      _showUserAvatar();
      return true;
    }
    // Not authenticated — show login overlay
    _showLoginOverlay();
    return false;
  } catch {
    return true; // network error — don't block the app
  }
}

function _showLoginOverlay() {
  // Remove any existing overlay
  const existing = document.getElementById('auth-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-bg';
  overlay.innerHTML = `
    <div class="text-center space-y-6 px-6 max-w-sm">
      <img src="/static/logo.svg" alt="More'Wax" class="h-16 w-16 mx-auto rounded-full">
      <h1 class="font-headline italic font-bold text-on-surface text-2xl tracking-tighter">More'Wax</h1>
      <p class="text-on-surface-v text-sm">${t('auth.signIn')}</p>
      <a href="/auth/login"
         class="inline-flex items-center gap-3 px-6 py-3 bg-white text-gray-700 rounded-full
                font-medium text-sm shadow-lg hover:shadow-xl transition-shadow">
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        ${t('auth.signInWithGoogle')}
      </a>
    </div>
  `;
  document.body.appendChild(overlay);
}

function _showUserAvatar() {
  if (!_authUser) return;
  const avatar = document.getElementById('auth-avatar');
  if (!avatar) return;

  // Build avatar UI safely — no user data in innerHTML
  const btn = document.createElement('button');
  btn.className = 'relative flex items-center';
  btn.onclick = () => document.getElementById('auth-menu')?.classList.toggle('hidden');

  const img = document.createElement('img');
  img.src = _authUser.picture || '';
  img.alt = _authUser.name || '';
  img.className = 'h-7 w-7 rounded-full border border-outline-v/30 object-cover';
  img.onerror = () => { img.style.display = 'none'; };
  btn.appendChild(img);

  const menu = document.createElement('div');
  menu.id = 'auth-menu';
  menu.className = 'hidden absolute right-0 top-full mt-2 w-48 bg-surface rounded-xl shadow-xl border border-outline-v/20 py-2 z-50';

  const info = document.createElement('div');
  info.className = 'px-3 py-2 border-b border-outline-v/10';
  const nameP = document.createElement('p');
  nameP.className = 'text-sm font-medium text-on-surface truncate';
  nameP.textContent = _authUser.name || '';
  const emailP = document.createElement('p');
  emailP.className = 'text-xs text-on-surface-v truncate';
  emailP.textContent = _authUser.email || '';
  info.appendChild(nameP);
  info.appendChild(emailP);

  const signOut = document.createElement('a');
  signOut.href = '/auth/logout';
  signOut.className = 'block px-3 py-2 text-sm text-on-surface-v hover:text-on-surface hover:bg-surface-high transition-colors';
  signOut.textContent = t('auth.signOut');

  menu.appendChild(info);
  menu.appendChild(signOut);

  avatar.innerHTML = '';
  avatar.appendChild(btn);
  avatar.appendChild(menu);
  avatar.classList.remove('hidden');

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('auth-menu');
    if (menu && !avatar.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
}
