/* Общие заметки через Firebase: вход через Google, заметки в Firestore (коллекция notes, документ = VIN).
   Каждая заметка отправляется в базу в момент сохранения и сразу приходит на все устройства.
   Без настроек (firebase-config.js) или без входа заметки живут только на устройстве, как раньше. */
window.Sync = (() => {
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const cfg = window.FIREBASE_CONFIG || {};
  const st = { on: !!cfg.apiKey, ready: false, user: null, err: '', live: false };
  let F = null, auth = null, db = null, unsub = null;
  const OK = 'auth-ok-v1';
  const okGet = () => { try { return localStorage.getItem(OK) === '1'; } catch (e) { return false; } };
  const okSet = v => { try { v ? localStorage.setItem(OK, '1') : localStorage.removeItem(OK); } catch (e) {} };
  // экран входа: при первом запуске приложение открывается только после входа через Google, дальше вход запоминается
  function gate(mode, msg) {
    let g = document.getElementById('gate');
    if (mode === 'hide') { if (g) g.remove(); document.documentElement.classList.remove('gated'); return; }
    if (!g) { g = document.createElement('div'); g.id = 'gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); document.body.appendChild(g); }
    document.documentElement.classList.add('gated');
    const t = s => (window.T ? T(s) : s);
    g.innerHTML = '<div class="gate-box"><img src="icons/icon-192.png" alt="" width="72" height="72"><h1>' + t('Аукционы Хьюстона') + '</h1>'
      + '<p>' + (mode === 'denied' ? t('Для этой почты доступ не открыт:') + ' <b>' + (st.user ? st.user.email : '') + '</b>. ' + t('Для запроса доступа напишите на почту') + ' <a href="mailto:1mtulegenov@gmail.com?subject=' + encodeURIComponent('Доступ к приложению Аукционы') + '">1mtulegenov@gmail.com</a>' : t('Войдите через Google один раз. Дальше приложение будет открываться сразу.')) + '</p>'
      + (msg ? '<p class="gate-err">' + msg + '</p>' : '')
      + (mode === 'wait' ? '<p class="gate-muted">' + t('Загрузка…') + '</p>'
        : mode === 'denied' ? '<button class="btn pri" id="gateOut">' + t('Войти с другой почтой') + '</button>'
        : '<button class="btn gate-g" id="gateIn"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>' + t('Войти через Google') + '</button>')
      + '</div>';
    const bi = g.querySelector('#gateIn'), bo = g.querySelector('#gateOut');
    if (bi) bi.onclick = () => { gate('wait'); signIn().then(() => { if (!st.user) gate('login', st.err); }); };
    if (bo) bo.onclick = async () => { await signOut(); gate('login'); };
  }
  const emit = () => window.dispatchEvent(new CustomEvent('sync-state'));
  const fail = e => { st.err = humanErr(e); console.warn('sync', e); emit(); };
  function humanErr(e) {
    const c = (e && e.code) || '';
    if (c === 'permission-denied' || /permission/i.test(c)) return 'Этой почте доступ не открыт. Для запроса доступа напишите на 1mtulegenov@gmail.com';
    if (/popup-blocked|popup-closed|cancelled-popup/.test(c)) return 'Окно входа закрылось. Попробуйте ещё раз.';
    if (/network/.test(c)) return 'Нет связи. Заметки отправятся, когда появится интернет.';
    if (/unauthorized-domain/.test(c)) return 'Домен приложения не добавлен в Firebase (Authorized domains).';
    return (e && e.message) || String(e);
  }
  async function init() {
    if (!st.on) return;
    if (!okGet()) gate('wait');
    try {
      const [app, au, fs] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
      F = { au, fs };
      const a = app.initializeApp(cfg);
      auth = au.getAuth(a);
      await au.setPersistence(auth, au.browserLocalPersistence).catch(() => {});
      try { db = fs.initializeFirestore(a, { localCache: fs.persistentLocalCache() }); } catch (e) { db = fs.getFirestore(a); }
      if (!(await finishGoogle())) au.getRedirectResult(auth).catch(fail);
      au.onAuthStateChanged(auth, u => { st.user = u ? { uid: u.uid, name: u.displayName || u.email, email: u.email, photo: u.photoURL } : null; st.ready = true; st.err = ''; emit(); if (u) start(); else { stop(); okSet(false); gate('login'); } });
    } catch (e) {
      // нет связи: кто уже входил, работает дальше; первый вход требует интернета
      st.on = false; fail(e);
      if (!okGet()) gate('login', (window.T ? T('Нет связи. Для первого входа нужен интернет.') : 'Нет связи.'));
    }
  }
  // Установленное приложение на iPhone и мобильные браузеры: вход Firebase через всплывающее окно там ломается
  // (окно открывается отдельно и теряет состояние). Поэтому уводим всё окно на страницу Google и возвращаемся
  // на свой же адрес с id_token, а Firebase принимает этот токен (signInWithCredential).
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const mobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const RET = () => location.origin + location.pathname.replace(/index\.html$/, '');
  function googleRedirect() {
    const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const state = rnd(), nonce = rnd();
    try { localStorage.setItem('g-oauth', JSON.stringify({ state, nonce, ts: Date.now() })); } catch (e) {}
    const q = new URLSearchParams({ client_id: cfg.googleClientId, redirect_uri: RET(), response_type: 'id_token', scope: 'openid email profile', nonce, state, prompt: 'select_account' });
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
  }
  async function finishGoogle() {
    if (!/id_token=|error=/.test(location.hash)) return false;
    const h = new URLSearchParams(location.hash.slice(1));
    let saved = null; try { saved = JSON.parse(localStorage.getItem('g-oauth') || 'null'); localStorage.removeItem('g-oauth'); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.search);
    if (h.get('error')) { st.err = 'Google: ' + h.get('error'); emit(); return true; }
    if (!saved || saved.state !== h.get('state')) { st.err = 'Вход прерван, попробуйте ещё раз.'; emit(); return true; }
    try { await F.au.signInWithCredential(auth, F.au.GoogleAuthProvider.credential(h.get('id_token'))); } catch (e) { fail(e); }
    return true;
  }
  async function signIn() {
    if (!auth) return;
    if (cfg.googleClientId && (standalone() || mobile())) { googleRedirect(); return; }
    const p = new F.au.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await F.au.signInWithPopup(auth, p); }
    catch (e) {
      if (/popup-blocked|operation-not-supported|web-storage|popup-closed|cancelled/.test(e.code || '') && cfg.googleClientId) googleRedirect();
      else if (/popup-blocked|operation-not-supported|web-storage/.test(e.code || '')) { try { await F.au.signInWithRedirect(auth, p); } catch (e2) { fail(e2); } }
      else fail(e);
    }
  }
  async function signOut() { if (auth) { await F.au.signOut(auth); } }

  // первый вход: свои заметки с телефона, которых нет в базе или которые новее, отправляем в базу
  async function start() {
    stop();
    const { collection, getDocs, onSnapshot } = F.fs;
    try {
      const snap = await getDocs(collection(db, 'notes'));
      st.denied = false; okSet(true); gate('hide');
      const remote = {}; snap.forEach(d => { remote[d.id] = d.data(); });
      for (const [vin, n] of Object.entries(S.notes)) {
        if (!n || !n.text || n.by) continue;
        const r = remote[vin], rt = r && r.at && r.at.toDate ? r.at.toDate().toISOString() : '';
        if (!r || (n.updatedAt || '') > rt) await pushNote(vin, n);
      }
    } catch (e) {
      if ((e.code || '') === 'permission-denied') { st.denied = true; okSet(false); fail(e); gate('denied'); return; }
      fail(e); if (okGet()) gate('hide');
    }
    unsub = onSnapshot(collection(db, 'notes'), { includeMetadataChanges: false }, qs => {
      let ch = false;
      qs.docChanges().forEach(c => {
        const vin = c.doc.id;
        if (c.type === 'removed') { if (S.notes[vin]) { delete S.notes[vin]; ch = true; } return; }
        const r = c.doc.data();
        const at = r.at && r.at.toDate ? r.at.toDate().toISOString() : (r.atLocal || new Date().toISOString());
        S.notes[vin] = { text: r.text || '', date: r.date, run: r.run, car: r.car, updatedAt: at, by: r.by, byEmail: r.byEmail, cby: r.cby, cat: r.cat };
        ch = true;
      });
      st.live = true; st.err = '';
      if (ch) { LS.set('auction-notes-v1', S.notes); window.dispatchEvent(new CustomEvent('notes-updated')); }
      emit();
    }, fail);
  }
  function stop() { if (unsub) { unsub(); unsub = null; } st.live = false; }

  async function pushNote(vin, n) {
    if (!db || !st.user || !vin) return false;
    const { doc, setDoc, deleteDoc, serverTimestamp } = F.fs, u = st.user;
    const ref = doc(db, 'notes', vin);
    try {
      if (!n || !n.text) await deleteDoc(ref);
      else {
        const first = !n.cby;
        await setDoc(ref, Object.assign({ text: n.text, date: n.date || '', run: n.run || '', car: n.car || '', by: u.name, byEmail: u.email, uid: u.uid, at: serverTimestamp(), atLocal: new Date().toISOString() },
          first ? { cby: n.by || u.name, cat: n.updatedAt || new Date().toISOString() } : {}), { merge: true });
        if (first) { n.cby = n.by || u.name; }
        n.by = u.name; n.byEmail = u.email;
      }
      return true;
    } catch (e) { fail(e); return false; }
  }
  init();
  return { st, signIn, signOut, pushNote };
})();
