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
    startFavs();
    startObd();
    track();
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
  function stop() { if (unsubO) { unsubO(); unsubO = null; } if (unsub) { unsub(); unsub = null; } if (unsubF) { unsubF(); unsubF = null; } st.live = false; }

  // избранное и заметки «для покупки»: личные, в users/{uid}/data/favs, общие для всех устройств этого человека.
  // Удаления помним отдельно (favDel: id -> время), чтобы удалённое на одном телефоне не вернулось с другого.
  let unsubF = null, favRef = null, lastFav = '';
  const fts = f => (f && (f.ts2 > f.ts ? f.ts2 : f.ts)) || 0;
  function mergeFavs(rf, rd) {
    const del = Object.assign({}, rd || {});
    for (const [k, t] of Object.entries(S.favDel || {})) del[k] = Math.max(del[k] || 0, t);
    const out = {};
    for (const src of [rf || {}, S.favs || {}]) for (const [k, f] of Object.entries(src)) {
      if (!f || !f.d) continue;
      if ((del[k] || 0) >= fts(f)) continue;
      if (!out[k] || fts(f) > fts(out[k])) out[k] = f;
    }
    const old = Date.now() - 45 * 864e5;
    for (const k of Object.keys(del)) if (del[k] < old || out[k]) delete del[k];
    return { favs: out, del };
  }
  function startFavs() {
    const { doc, onSnapshot } = F.fs;
    favRef = doc(db, 'users', st.user.uid, 'data', 'favs');
    unsubF = onSnapshot(favRef, snap => {
      if (snap.metadata.hasPendingWrites) return;
      const r = snap.exists() ? snap.data() : {};
      const m = mergeFavs(r.favs, r.del);
      const before = JSON.stringify(S.favs);
      S.favs = m.favs; S.favDel = m.del;
      saveFavs(true);
      if (JSON.stringify(m.favs) !== before) window.dispatchEvent(new CustomEvent('favs-updated'));
      if (JSON.stringify(r.favs || {}) !== JSON.stringify(m.favs) || JSON.stringify(r.del || {}) !== JSON.stringify(m.del)) pushFavs();
    }, fail);
  }
  let favT = null;
  function pushFavs() {
    if (!favRef || !st.user) return;
    clearTimeout(favT);
    favT = setTimeout(async () => {
      const body = JSON.stringify([S.favs, S.favDel]);
      if (body === lastFav) return;
      try { await F.fs.setDoc(favRef, { favs: S.favs, del: S.favDel, at: F.fs.serverTimestamp() }); lastFav = body; } catch (e) { fail(e); }
    }, 300);
  }

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

  // скриншоты OBD (ThinkDiag): obd/{vin} = коды и список скриншотов, сами картинки в obd/{vin}/img/{id},
  // чтобы при открытии приложения не грузить все картинки, а только при открытии карточки.
  let unsubO = null;
  st.obdErr = '';
  const obdFail = e => { st.obdErr = (e && e.code) === 'permission-denied' ? 'rules' : humanErr(e); console.warn('obd', e); window.dispatchEvent(new CustomEvent('obd-updated')); };
  // Очередь неотправленного: если запись не прошла (нет сети, правило ещё не опубликовано, вход истёк),
  // VIN и сама картинка остаются на устройстве и отправляются снова при следующем подключении.
  const PK = 'auction-obd-pend', IK = 'auction-obd-imgp';
  const lsg = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  const lss = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  let obdRetry = 0, flushing = false;
  function startObd() {
    if (!db || !st.user) return;
    const { collection, onSnapshot } = F.fs;
    if (unsubO) { unsubO(); unsubO = null; }
    clearTimeout(obdRetry);
    let first = true;
    unsubO = onSnapshot(collection(db, 'obd'), qs => {
      const pend = lsg(PK);
      qs.docChanges().forEach(c => {
        const vin = c.doc.id;
        if (pend[vin]) return; // своё неотправленное не затираем
        if (c.type === 'removed') { delete S.obd[vin]; return; }
        const r = c.doc.data();
        S.obd[vin] = { codes: r.codes || [], shots: r.shots || [], car: r.car || '', by: r.by || '', at: r.at && r.at.toDate ? r.at.toDate().toISOString() : (r.atLocal || '') };
      });
      st.obdErr = '';
      LS.set('auction-obd-v1', S.obd);
      window.dispatchEvent(new CustomEvent('obd-updated'));
      if (first) { first = false; flushObd(); }
    }, e => {
      // ошибка навсегда останавливает подписку Firestore, поэтому переподписываемся сами
      obdFail(e); if (unsubO) { try { unsubO(); } catch (x) {} } unsubO = null;
      clearTimeout(obdRetry); obdRetry = setTimeout(startObd, 20000);
    });
  }
  async function flushObd() {
    if (flushing || !db || !st.user) return; flushing = true;
    try {
      const pend = lsg(PK), imgs = lsg(IK);
      for (const vin of Object.keys(pend)) {
        const o = S.obd[vin] || null;
        const ids = Object.keys(imgs).filter(k => k.startsWith(vin + '/'));
        let ok = true;
        for (const k of ids) { if (!(await pushObd(vin, o, { id: k.slice(vin.length + 1), data: imgs[k] }, true))) { ok = false; break; } }
        if (ok && !ids.length) ok = await pushObd(vin, o, null, true);
        if (!ok) break;
      }
    } finally { flushing = false; }
  }
  async function pushObd(vin, o, img, again) {
    if (!vin) return false;
    // сначала в очередь, потом в базу: если не дойдёт, отправится позже
    const pend = lsg(PK); pend[vin] = 1; lss(PK, pend);
    if (img && !again) { const im = lsg(IK); im[vin + '/' + img.id] = img.data; lss(IK, im); }
    if (!db || !st.user) { obdFail({ message: 'Нужен вход через Google' }); return false; }
    const { doc, setDoc, deleteDoc, serverTimestamp } = F.fs, u = st.user;
    try {
      if (img) await setDoc(doc(db, 'obd', vin, 'img', img.id), { data: img.data, by: u.name, at: serverTimestamp() });
      if (!o || (!o.codes.length && !o.shots.length)) await deleteDoc(doc(db, 'obd', vin));
      else await setDoc(doc(db, 'obd', vin), { codes: o.codes, shots: o.shots, car: o.car || '', run: o.run || '', date: o.date || '', by: u.name, uid: u.uid, at: serverTimestamp(), atLocal: new Date().toISOString() });
      if (img) { const im = lsg(IK); delete im[vin + '/' + img.id]; lss(IK, im); }
      const im2 = lsg(IK);
      if (!Object.keys(im2).some(k => k.startsWith(vin + '/'))) { const p2 = lsg(PK); delete p2[vin]; lss(PK, p2); }
      st.obdErr = ''; window.dispatchEvent(new CustomEvent('obd-updated')); return true;
    } catch (e) { obdFail(e); return false; }
  }
  function obdPending() { return Object.keys(lsg(PK)).length; }
  function obdWake() { if (!db || !st.user) return; if (!unsubO) startObd(); else flushObd(); }
  window.addEventListener('online', obdWake);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') obdWake(); });
  async function obdImg(vin, id) {
    if (!db) return null;
    const loc = lsg(IK)[vin + '/' + id]; if (loc) return loc;
    try { const d = await F.fs.getDoc(F.fs.doc(db, 'obd', vin, 'img', id)); return d.exists() ? d.data().data : null; } catch (e) { obdFail(e); return null; }
  }
  async function delObdImg(vin, id) { const im = lsg(IK); if (im[vin + '/' + id]) { delete im[vin + '/' + id]; lss(IK, im); } if (!db) return; try { await F.fs.deleteDoc(F.fs.doc(db, 'obd', vin, 'img', id)); } catch (e) { obdFail(e); } }
  // активность: сколько раз заходили и сколько минут приложение было открыто на экране.
  // Документ activity/{uid}_{день}: входы (sessions), секунды (sec), последний раз (last). Читать может только админ.
  const ADMIN = '1mtulegenov@gmail.com';
  const isAdmin = () => !!(st.user && (st.user.email || '').toLowerCase() === ADMIN);
  let actOn = false, visSec = 0, hiddenAt = 0, tick = null, lastTick = 0;
  const day = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function actWrite(sessions) {
    if (!db || !st.user || st.denied) return;
    const { doc, setDoc, serverTimestamp, increment } = F.fs, u = st.user, sec = Math.round(visSec);
    if (!sessions && sec < 5) return;
    visSec -= sec;
    const dv = (standalone() ? 'app' : 'web') + '/' + (mobile() ? 'phone' : 'desktop');
    setDoc(doc(db, 'activity', u.uid + '_' + day()), Object.assign({ uid: u.uid, email: u.email, name: u.name, date: day(), dev: dv, last: serverTimestamp(), sec: increment(sec) },
      sessions ? { sessions: increment(1) } : {}), { merge: true }).catch(e => console.warn('activity', e));
  }
  function track() {
    if (actOn) return; actOn = true;
    lastTick = Date.now();
    actWrite(true);
    tick = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible') visSec += Math.min(30, (now - lastTick) / 1000);
      lastTick = now;
      if (visSec >= 60) actWrite(false);
    }, 15000);
    document.addEventListener('visibilitychange', () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') { visSec += Math.min(30, (now - lastTick) / 1000); lastTick = now; hiddenAt = now; actWrite(false); }
      else { lastTick = now; if (hiddenAt && now - hiddenAt > 30 * 60000) actWrite(true); hiddenAt = 0; }
    });
    window.addEventListener('pagehide', () => { if (document.visibilityState === 'visible') { visSec += Math.min(30, (Date.now() - lastTick) / 1000); lastTick = Date.now(); actWrite(false); } });
  }
  async function activity(sinceDay) {
    if (!db || !isAdmin()) throw new Error('Только для администратора');
    const { collection, getDocs, query, where } = F.fs;
    const snap = await getDocs(query(collection(db, 'activity'), where('date', '>=', sinceDay)));
    const out = []; snap.forEach(d => { const r = d.data(); out.push({ uid: r.uid, email: r.email, name: r.name, date: r.date, dev: r.dev, sessions: r.sessions || 0, sec: r.sec || 0, last: r.last && r.last.toDate ? r.last.toDate() : null }); });
    return out;
  }
  init();
  // пуш-подписка устройства: push/{хэш endpoint}. Только endpoint и ключи шифрования, без почты.
  async function pushSub(sub) {
    if (!db || !st.user) throw new Error('Сначала войдите');
    const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint))), b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const dv = /iPhone|iPad/.test(navigator.userAgent) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop';
    await F.fs.setDoc(F.fs.doc(db, 'push', h), { endpoint: sub.endpoint, keys: sub.keys, dev: dv, uid: st.user.uid, at: F.fs.serverTimestamp() });
    return h;
  }
  // сохранённые поиски аккаунта: push/srch_{uid} {type:'searches', uid, list}. Лежат рядом с подписками,
  // чтобы рассылка (GitHub Actions) видела, кому какие совпадения слать.
  async function saveSearches(list) {
    if (!db || !st.user) throw new Error('Сначала войдите');
    await F.fs.setDoc(F.fs.doc(db, 'push', 'srch_' + st.user.uid), { type: 'searches', uid: st.user.uid, list: JSON.parse(JSON.stringify(list)), at: F.fs.serverTimestamp() });
  }
  async function loadSearches() {
    if (!db || !st.user) return null;
    try { const d = await F.fs.getDoc(F.fs.doc(db, 'push', 'srch_' + st.user.uid)); return d.exists() ? (d.data().list || []) : []; } catch (e) { console.warn('searches', e); return null; }
  }
  return { st, signIn, signOut, pushNote, pushFavs, isAdmin, activity, pushObd, obdImg, delObdImg, obdPending, pushSub, saveSearches, loadSearches };
})();
