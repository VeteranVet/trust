/* =============================================================
   TrustBridge Auth  —  API-backed (works on ALL devices)
   ============================================================= */
(function () {

  // Token lives in localStorage — it's just a random string, not sensitive
  function getToken()       { try { return localStorage.getItem('tb_token') || null; } catch { return null; } }
  function setToken(t)      { try { t ? localStorage.setItem('tb_token', t) : localStorage.removeItem('tb_token'); } catch {} }
  function getStoredUser()  { try { return JSON.parse(localStorage.getItem('tb_user') || 'null'); } catch { return null; } }
  function setStoredUser(u) { try { u ? localStorage.setItem('tb_user', JSON.stringify(u)) : localStorage.removeItem('tb_user'); } catch {} }

  async function api(endpoint, options) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const res = await fetch('/api' + endpoint, { headers, ...options });
      return await res.json();
    } catch {
      return { ok: false, err: 'Network error. Please check your connection.' };
    }
  }

  window.TBAuth = {
    isLoggedIn() { return !!(getToken() && getStoredUser()); },
    getUser()    { return getStoredUser(); },

    async register(username, password) {
      const r = await api('/register', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (r.ok) { setToken(r.token); setStoredUser(r.user); }
      return r;
    },

    async login(username, password) {
      const r = await api('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (r.ok) { setToken(r.token); setStoredUser(r.user); }
      return r;
    },

    async logout() {
      try { await api('/logout', { method: 'POST' }); } catch {}
      setToken(null); setStoredUser(null);
    },

    async saveTransaction(txId, txData) {
      if (!this.isLoggedIn()) return;
      await api('/transactions', { method: 'POST', body: JSON.stringify({ txId, txData }) });
    },

    async getTransactions() {
      if (!this.isLoggedIn()) return [];
      const r = await api('/transactions');
      return r.ok ? r.transactions : [];
    },

    async verifySession() {
      if (!getToken()) return false;
      const r = await api('/me');
      if (!r.ok) { setToken(null); setStoredUser(null); return false; }
      setStoredUser(r.user);
      return true;
    }
  };

  // ── MODAL ────────────────────────────────────────────────────────────────────
  const modalHTML = `
<div id="tb-auth-overlay" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(7,26,53,0.85);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:1rem;">
  <div style="background:white;border-radius:20px;width:100%;max-width:400px;box-shadow:0 40px 100px rgba(0,0,0,0.4);overflow:hidden;">
    <div style="display:flex;border-bottom:1px solid #e8edf5;">
      <button id="tb-tab-login" onclick="TBAuthUI.showTab('login')" style="flex:1;padding:1.1rem;border:none;background:none;font-family:'DM Sans',sans-serif;font-size:0.92rem;font-weight:700;color:#2477d4;border-bottom:3px solid #2477d4;cursor:pointer;">Sign In</button>
      <button id="tb-tab-register" onclick="TBAuthUI.showTab('register')" style="flex:1;padding:1.1rem;border:none;background:none;font-family:'DM Sans',sans-serif;font-size:0.92rem;font-weight:600;color:#8a99b3;border-bottom:3px solid transparent;cursor:pointer;">Create Account</button>
    </div>
    <div style="padding:2rem 2rem 1.5rem;">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:1.5rem;">
        <div style="width:34px;height:34px;background:linear-gradient(135deg,#2477d4,#0ea8a8);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm0 4.9l5 2.23V11c0 3.46-2.38 6.69-5 7.93-2.62-1.24-5-4.47-5-7.93V8.13L12 5.9z"/></svg>
        </div>
        <span style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:#0d2b52;">Trust<span style="color:#0ea8a8;">Bridge</span></span>
      </div>
      <div id="tb-auth-error" style="display:none;background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;padding:0.65rem 1rem;margin-bottom:1rem;font-size:0.83rem;color:#c53030;"></div>
      <div id="tb-auth-loading" style="display:none;text-align:center;padding:0.5rem;font-size:0.85rem;color:#8a99b3;font-family:'DM Sans',sans-serif;">Connecting...</div>

      <div id="tb-form-login">
        <div style="margin-bottom:1rem;">
          <label style="font-size:0.8rem;font-weight:700;color:#4a5568;display:block;margin-bottom:0.4rem;">Username</label>
          <input id="tb-login-username" type="text" placeholder="Username" autocomplete="username" style="width:100%;padding:0.75rem 1rem;border:1.5px solid #e8edf5;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:0.9rem;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#2477d4'" onblur="this.style.borderColor='#e8edf5'">
        </div>
        <div style="margin-bottom:1.4rem;">
          <label style="font-size:0.8rem;font-weight:700;color:#4a5568;display:block;margin-bottom:0.4rem;">Password</label>
          <input id="tb-login-password" type="password" placeholder="••••••••" autocomplete="current-password" style="width:100%;padding:0.75rem 1rem;border:1.5px solid #e8edf5;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:0.9rem;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#2477d4'" onblur="this.style.borderColor='#e8edf5'" onkeydown="if(event.key==='Enter')TBAuthUI.submitLogin()">
        </div>
        <button onclick="TBAuthUI.submitLogin()" style="width:100%;padding:0.85rem;background:linear-gradient(135deg,#2477d4,#1a5faa);border:none;border-radius:8px;color:white;font-family:'DM Sans',sans-serif;font-size:0.95rem;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(36,119,212,0.35);">Sign In</button>
      </div>

      <div id="tb-form-register" style="display:none;">
        <div style="margin-bottom:1rem;">
          <label style="font-size:0.8rem;font-weight:700;color:#4a5568;display:block;margin-bottom:0.4rem;">Username</label>
          <input id="tb-reg-username" type="text" placeholder="Username" autocomplete="username" style="width:100%;padding:0.75rem 1rem;border:1.5px solid #e8edf5;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:0.9rem;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#2477d4'" onblur="this.style.borderColor='#e8edf5'">
          <div style="font-size:0.73rem;color:#8a99b3;margin-top:0.3rem;">3–20 characters. Letters, numbers, underscores only.</div>
        </div>
        <div style="margin-bottom:1.4rem;">
          <label style="font-size:0.8rem;font-weight:700;color:#4a5568;display:block;margin-bottom:0.4rem;">Password</label>
          <input id="tb-reg-password" type="password" placeholder="Password" autocomplete="new-password" style="width:100%;padding:0.75rem 1rem;border:1.5px solid #e8edf5;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:0.9rem;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#2477d4'" onblur="this.style.borderColor='#e8edf5'" onkeydown="if(event.key==='Enter')TBAuthUI.submitRegister()">
        </div>
        <button onclick="TBAuthUI.submitRegister()" style="width:100%;padding:0.85rem;background:linear-gradient(135deg,#2477d4,#1a5faa);border:none;border-radius:8px;color:white;font-family:'DM Sans',sans-serif;font-size:0.95rem;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(36,119,212,0.35);">Create Account</button>
      </div>

      <button onclick="TBAuthUI.closeModal()" style="width:100%;margin-top:0.9rem;padding:0.6rem;background:none;border:none;color:#8a99b3;font-family:'DM Sans',sans-serif;font-size:0.83rem;cursor:pointer;">Cancel</button>
    </div>
  </div>
</div>`;

  // ── AUTH UI ──────────────────────────────────────────────────────────────────
  window.TBAuthUI = {
    _requireAuth: false,
    _onLogin: null,

    async init(options = {}) {
      if (!document.getElementById('tb-auth-overlay')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
      }
      this._requireAuth = options.requireAuth || false;
      this._onLogin     = options.onLogin || null;

      // Verify existing session with server
      if (TBAuth.isLoggedIn()) {
        const valid = await TBAuth.verifySession();
        if (!valid && this._requireAuth) {
          this.openModal('login');
          return;
        }
      } else if (this._requireAuth) {
        this.openModal('login');
        return;
      }

      this.renderNavButton();
    },

    renderNavButton() {
      const container = document.getElementById('tb-nav-auth');
      if (!container) return;
      const user = TBAuth.getUser();
      if (user) {
        container.innerHTML =
          '<span style="font-size:0.82rem;color:rgba(255,255,255,0.65);font-weight:500;">Hi, <strong style="color:white;">' + esc(user.username) + '</strong></span>' +
          '<button onclick="TBAuthUI.logout()" style="padding:0.45rem 1.1rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:rgba(255,255,255,0.85);font-family:\'DM Sans\',sans-serif;font-size:0.83rem;font-weight:600;cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.08)\'">Sign Out</button>';
      } else {
        container.innerHTML =
          '<button onclick="TBAuthUI.openModal(\'login\')" style="padding:0.45rem 1.1rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:rgba(255,255,255,0.85);font-family:\'DM Sans\',sans-serif;font-size:0.83rem;font-weight:600;cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.08)\'">Sign In</button>' +
          '<button onclick="TBAuthUI.openModal(\'register\')" style="padding:0.45rem 1.1rem;background:linear-gradient(135deg,#2477d4,#1a5faa);border:none;border-radius:6px;color:white;font-family:\'DM Sans\',sans-serif;font-size:0.83rem;font-weight:600;cursor:pointer;box-shadow:0 2px 10px rgba(36,119,212,0.4);" onmouseover="this.style.opacity=\'0.88\'" onmouseout="this.style.opacity=\'1\'">Create Account</button>';
      }
    },

    openModal(tab) {
      const overlay = document.getElementById('tb-auth-overlay');
      overlay.style.display = 'flex';
      this.showTab(tab || 'login');
      this.clearError();
      // Clear all fields every time modal opens
      ['tb-login-username','tb-login-password','tb-reg-username','tb-reg-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.body.style.overflow = 'hidden';
      overlay.onclick = (e) => { if (e.target === overlay && !this._requireAuth) this.closeModal(); };
    },

    closeModal() {
      document.getElementById('tb-auth-overlay').style.display = 'none';
      document.body.style.overflow = '';
    },

    showTab(tab) {
      const lf = document.getElementById('tb-form-login');
      const rf = document.getElementById('tb-form-register');
      const tl = document.getElementById('tb-tab-login');
      const tr = document.getElementById('tb-tab-register');
      this.clearError();
      if (tab === 'login') {
        lf.style.display = 'block'; rf.style.display = 'none';
        tl.style.color = '#2477d4'; tl.style.borderBottomColor = '#2477d4'; tl.style.fontWeight = '700';
        tr.style.color = '#8a99b3'; tr.style.borderBottomColor = 'transparent'; tr.style.fontWeight = '600';
      } else {
        lf.style.display = 'none'; rf.style.display = 'block';
        tr.style.color = '#2477d4'; tr.style.borderBottomColor = '#2477d4'; tr.style.fontWeight = '700';
        tl.style.color = '#8a99b3'; tl.style.borderBottomColor = 'transparent'; tl.style.fontWeight = '600';
      }
    },

    showError(msg) {
      const el = document.getElementById('tb-auth-error');
      el.textContent = msg; el.style.display = 'block';
    },
    clearError() {
      const el = document.getElementById('tb-auth-error');
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    },
    setLoading(on) {
      const el = document.getElementById('tb-auth-loading');
      if (el) el.style.display = on ? 'block' : 'none';
    },

    async submitLogin() {
      const username = document.getElementById('tb-login-username').value.trim();
      const password = document.getElementById('tb-login-password').value;
      if (!username || !password) { this.showError('Please fill in all fields.'); return; }
      this.clearError(); this.setLoading(true);
      const result = await TBAuth.login(username, password);
      this.setLoading(false);
      if (!result.ok) { this.showError(result.err); return; }
      this.closeModal();
      this.renderNavButton();
      if (this._onLogin) this._onLogin(result.user);
    },

    async submitRegister() {
      const username = document.getElementById('tb-reg-username').value.trim();
      const password = document.getElementById('tb-reg-password').value;
      if (!username || !password) { this.showError('Please fill in all fields.'); return; }
      this.clearError(); this.setLoading(true);
      const result = await TBAuth.register(username, password);
      this.setLoading(false);
      if (!result.ok) { this.showError(result.err); return; }
      this.closeModal();
      this.renderNavButton();
      if (this._onLogin) this._onLogin(result.user);
    },

    async logout() {
      await TBAuth.logout();
      this.renderNavButton();
      if (this._requireAuth) window.location.href = 'index.html';
    }
  };

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
