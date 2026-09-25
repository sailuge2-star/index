/* =========================================
   ADMIN AUTH + DASHBOARD
   - Supabase Auth handles credentials.
   - public.admin_users is the server-side allowlist.
   ========================================= */
(() => {
  const cfg = window.BBORINGIRL_CONFIG || {};
  const url = cfg.supabaseUrl?.trim();
  const key = cfg.supabaseKey?.trim();
  const client = (url && key && window.supabase) ? window.supabase.createClient(url, key) : null;

  const $ = (s) => document.querySelector(s);
  const gate = $('#entryGate');
  const loginDialog = $('#adminLoginDialog');
  const loginForm = $('#adminLoginForm');
  const loginStatus = $('#adminLoginStatus');
  const entryStatus = $('#entryStatus');
  const main = document.querySelector('main');
  const adminPanel = $('#adminPanel');
  const adminHeaderMenu = $('#adminHeaderMenu');
  const adminHeaderBtn = $('#adminHeaderBtn');
  const adminHeaderDropdown = $('#adminHeaderDropdown');
  const adminDashboardBtn = $('#adminDashboardBtn');
  const adminHeaderLogoutBtn = $('#adminHeaderLogoutBtn');
  const adminUserLabel = $('#adminUserLabel');
  const guestHeaderMenu = $('#guestHeaderMenu');
  const guestHeaderBtn = $('#guestHeaderBtn');
  const guestHeaderDropdown = $('#guestHeaderDropdown');
  const guestHeaderLogoutBtn = $('#guestHeaderLogoutBtn');

  let currentUser = null;
  let isAdmin = false;

  function showMain(role) {
    if (main) main.hidden = false;
    if (gate) gate.hidden = true;
    document.body.classList.add('site-entered');
    sessionStorage.setItem('bboringirl_entry_role', role);
    if (guestHeaderMenu) guestHeaderMenu.hidden = role !== 'guest';
    if (guestHeaderDropdown) guestHeaderDropdown.hidden = true;
    if (guestHeaderBtn) guestHeaderBtn.setAttribute('aria-expanded', 'false');
  }

  function showGate(message='') {
    if (main) main.hidden = true;
    if (gate) gate.hidden = false;
    if (entryStatus) entryStatus.textContent = message;
    document.body.classList.remove('site-entered');
    if (guestHeaderMenu) guestHeaderMenu.hidden = true;
    if (guestHeaderDropdown) guestHeaderDropdown.hidden = true;
    if (guestHeaderBtn) guestHeaderBtn.setAttribute('aria-expanded', 'false');
  }

  function showAdmin() {
    showMain('admin');
    if (adminPanel) adminPanel.hidden = false;
    if (adminHeaderMenu) adminHeaderMenu.hidden = false;
    if (adminHeaderBtn) { adminHeaderBtn.hidden = false; adminHeaderBtn.setAttribute('aria-expanded', 'false'); }
    if (adminHeaderDropdown) adminHeaderDropdown.hidden = true;
    if (adminUserLabel) adminUserLabel.textContent = currentUser?.email || '';
    loadAdminData();
  }

  function hideAdmin() {
    if (adminPanel) adminPanel.hidden = true;
    if (adminHeaderMenu) adminHeaderMenu.hidden = true;
    if (adminHeaderBtn) { adminHeaderBtn.hidden = true; adminHeaderBtn.setAttribute('aria-expanded', 'false'); }
    if (adminHeaderDropdown) adminHeaderDropdown.hidden = true;
    if (guestHeaderMenu) guestHeaderMenu.hidden = true;
    if (guestHeaderDropdown) guestHeaderDropdown.hidden = true;
  }

  async function checkAdmin(user) {
    if (!client || !user) return false;
    const { data, error } = await client
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('admin check failed', error);
      return false;
    }
    return Boolean(data);
  }

  $('#guestEntryBtn')?.addEventListener('click', () => {
    hideAdmin();
    showMain('guest');
  });

  $('#adminEntryBtn')?.addEventListener('click', () => {
    if (!client) {
      if (entryStatus) entryStatus.textContent = 'Supabase 설정이 필요합니다. config.js를 확인해주세요.';
      return;
    }
    loginStatus.textContent = '';
    loginForm?.reset();
    loginDialog?.showModal();
    setTimeout(() => $('#adminEmail')?.focus(), 0);
  });

  $('#adminLoginClose')?.addEventListener('click', () => loginDialog?.close());

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client) return;
    const email = $('#adminEmail')?.value.trim();
    const password = $('#adminPassword')?.value || '';
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    loginStatus.textContent = '로그인 확인 중…';
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const ok = await checkAdmin(data.user);
      if (!ok) {
        await client.auth.signOut();
        throw new Error('관리자 권한이 없는 계정입니다. admin_users 등록을 확인해주세요.');
      }
      currentUser = data.user;
      isAdmin = true;
      loginDialog.close();
      showAdmin();
    } catch (error) {
      console.error(error);
      loginStatus.textContent = error.message || '로그인에 실패했습니다.';
    } finally {
      button.disabled = false;
    }
  });

  function closeAdminHeaderMenu() {
    if (adminHeaderDropdown) adminHeaderDropdown.hidden = true;
    adminHeaderBtn?.setAttribute('aria-expanded', 'false');
  }

  function closeGuestHeaderMenu() {
    if (guestHeaderDropdown) guestHeaderDropdown.hidden = true;
    guestHeaderBtn?.setAttribute('aria-expanded', 'false');
  }

  function toggleAdminHeaderMenu() {
    if (!isAdmin || !adminHeaderDropdown) return;
    closeGuestHeaderMenu();
    const nextOpen = adminHeaderDropdown.hidden;
    adminHeaderDropdown.hidden = !nextOpen;
    adminHeaderBtn?.setAttribute('aria-expanded', String(nextOpen));
  }

  function toggleGuestHeaderMenu() {
    if (isAdmin || !guestHeaderDropdown) return;
    closeAdminHeaderMenu();
    const nextOpen = guestHeaderDropdown.hidden;
    guestHeaderDropdown.hidden = !nextOpen;
    guestHeaderBtn?.setAttribute('aria-expanded', String(nextOpen));
  }

  async function logoutAdmin() {
    if (client) await client.auth.signOut();
    currentUser = null;
    isAdmin = false;
    closeAdminHeaderMenu();
    hideAdmin();
    sessionStorage.removeItem('bboringirl_entry_role');
    showGate('로그아웃되었습니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function logoutGuest() {
    closeGuestHeaderMenu();
    sessionStorage.removeItem('bboringirl_entry_role');
    showGate('게스트 로그아웃되었습니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  adminHeaderBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleAdminHeaderMenu();
  });

  guestHeaderBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleGuestHeaderMenu();
  });

  adminDashboardBtn?.addEventListener('click', () => {
    closeAdminHeaderMenu();
    if (isAdmin) adminPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  adminHeaderLogoutBtn?.addEventListener('click', logoutAdmin);
  $('#adminLogoutBtn')?.addEventListener('click', logoutAdmin);
  guestHeaderLogoutBtn?.addEventListener('click', logoutGuest);

  document.addEventListener('click', (event) => {
    if (!adminHeaderMenu?.contains(event.target)) closeAdminHeaderMenu();
    if (!guestHeaderMenu?.contains(event.target)) closeGuestHeaderMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAdminHeaderMenu();
      closeGuestHeaderMenu();
    }
  });

  function escapeHtml(value='') {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function date(value) {
    try { return new Intl.DateTimeFormat('ko-KR', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)); }
    catch { return ''; }
  }
  function adminError(target, message) {
    if (target) target.innerHTML = `<div class="admin-empty admin-error">${escapeHtml(message)}</div>`;
  }

  async function loadAdminData() {
    if (!client || !isAdmin) return;
    await Promise.all([loadAdminStats(), loadAdminGuestbook(), loadAdminFanart()]);
  }

  async function loadAdminStats() {
    const [g, p, a] = await Promise.all([
      client.from('guestbook').select('id', { count:'exact', head:true }),
      client.from('fanart').select('id', { count:'exact', head:true }).eq('status','pending'),
      client.from('fanart').select('id', { count:'exact', head:true }).eq('status','approved')
    ]);
    $('#adminGuestCount').textContent = g.error ? '-' : String(g.count ?? 0);
    $('#adminPendingArtCount').textContent = p.error ? '-' : String(p.count ?? 0);
    $('#adminApprovedArtCount').textContent = a.error ? '-' : String(a.count ?? 0);
  }

  async function loadAdminGuestbook() {
    const target = $('#adminGuestbookList');
    target.innerHTML = '<div class="admin-empty">불러오는 중…</div>';
    const { data, error } = await client.from('guestbook').select('id,nickname,message,status,created_at').order('created_at',{ascending:false}).limit(100);
    if (error) return adminError(target, '방명록을 불러오지 못했습니다. RLS 관리자 정책을 확인해주세요.');
    if (!data?.length) { target.innerHTML = '<div class="admin-empty">방명록이 없습니다.</div>'; return; }
    target.innerHTML = data.map(row => `
      <div class="admin-row">
        <div class="admin-row-main"><div><b>${escapeHtml(row.nickname)}</b><span class="admin-badge ${row.status==='approved'?'ok':'muted'}">${escapeHtml(row.status)}</span></div><time>${date(row.created_at)}</time><p>${escapeHtml(row.message)}</p></div>
        <div class="admin-row-actions">
          ${row.status === 'approved' ? `<button class="btn btn-small" data-action="guest-hide" data-id="${row.id}">숨김</button>` : `<button class="btn btn-small btn-primary" data-action="guest-show" data-id="${row.id}">공개</button>`}
          <button class="btn btn-small btn-danger" data-action="guest-delete" data-id="${row.id}">삭제</button>
        </div>
      </div>`).join('');
  }

  async function loadAdminFanart() {
    const target = $('#adminFanartList');
    target.innerHTML = '<div class="admin-empty">불러오는 중…</div>';
    const { data, error } = await client.from('fanart').select('id,nickname,title,description,image_path,status,created_at').order('created_at',{ascending:false}).limit(100);
    if (error) return adminError(target, '팬아트를 불러오지 못했습니다. RLS 관리자 정책을 확인해주세요.');
    if (!data?.length) { target.innerHTML = '<div class="admin-empty">팬아트가 없습니다.</div>'; return; }
    target.innerHTML = data.map(row => {
      const image = client.storage.from('fanart').getPublicUrl(row.image_path).data.publicUrl;
      return `<div class="admin-row fanart-admin-row">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(row.title)}">
        <div class="admin-row-main"><div><b>${escapeHtml(row.title)}</b><span class="admin-badge ${row.status==='approved'?'ok':row.status==='pending'?'pending':'muted'}">${escapeHtml(row.status)}</span></div><small>by ${escapeHtml(row.nickname)} · ${date(row.created_at)}</small><p>${escapeHtml(row.description || '')}</p></div>
        <div class="admin-row-actions">
          ${row.status !== 'approved' ? `<button class="btn btn-small btn-primary" data-action="art-approve" data-id="${row.id}">승인</button>` : ''}
          ${row.status !== 'rejected' ? `<button class="btn btn-small" data-action="art-reject" data-id="${row.id}">반려</button>` : ''}
          <button class="btn btn-small btn-danger" data-action="art-delete" data-id="${row.id}" data-path="${escapeHtml(row.image_path)}">삭제</button>
        </div>
      </div>`;
    }).join('');
  }

  $('#adminRefreshGuestbook')?.addEventListener('click', loadAdminGuestbook);
  $('#adminRefreshFanart')?.addEventListener('click', loadAdminFanart);

  $('#adminGuestbookList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;
    button.disabled = true;
    try {
      if (action === 'guest-delete') {
        if (!confirm('이 방명록을 삭제할까요?')) return;
        const { error } = await client.from('guestbook').delete().eq('id', id);
        if (error) throw error;
      } else {
        const status = action === 'guest-show' ? 'approved' : 'hidden';
        const { error } = await client.from('guestbook').update({ status }).eq('id', id);
        if (error) throw error;
      }
      await loadAdminData();
      if (window.loadGuestbook) await window.loadGuestbook();
    } catch (error) {
      console.error(error); alert(error.message || '처리에 실패했습니다.');
    } finally { button.disabled = false; }
  });

  $('#adminFanartList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;
    button.disabled = true;
    try {
      if (action === 'art-delete') {
        if (!confirm('팬아트와 업로드 파일을 삭제할까요?')) return;
        const path = button.dataset.path;
        const { error } = await client.from('fanart').delete().eq('id', id);
        if (error) throw error;
        if (path) await client.storage.from('fanart').remove([path]);
      } else {
        const status = action === 'art-approve' ? 'approved' : 'rejected';
        const { error } = await client.from('fanart').update({ status }).eq('id', id);
        if (error) throw error;
      }
      await loadAdminData();
      if (window.loadArts) await window.loadArts();
    } catch (error) {
      console.error(error); alert(error.message || '처리에 실패했습니다.');
    } finally { button.disabled = false; }
  });

  // Restore an existing Supabase session, but never bypass the admin_users check.
  (async () => {
    if (!client) { showGate(); return; }
    const { data } = await client.auth.getSession();
    if (data.session?.user) {
      const ok = await checkAdmin(data.session.user);
      if (ok) {
        currentUser = data.session.user; isAdmin = true; showAdmin(); return;
      }
      await client.auth.signOut();
    }
    showGate();
  })();
})();
