/* Общие заметки через Firebase: вход через Google, заметки в Firestore (коллекция notes, документ = VIN).
   Каждая заметка отправляется в базу в момент сохранения и сразу приходит на все устройства.
   Без настроек (firebase-config.js) или без входа заметки живут только на устройстве, как раньше. */
window.Sync = (() => {
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const cfg = window.FIREBASE_CONFIG || {};
  const st = { on: !!cfg.apiKey, ready: false, user: null, err: '', live: false };
  let F = null, auth = null, db = null, unsub = null;
  const emit = () => window.dispatchEvent(new CustomEvent('sync-state'));
  const fail = e => { st.err = humanErr(e); console.warn('sync', e); emit(); };
  function humanErr(e) {
    const c = (e && e.code) || '';
    if (c === 'permission-denied' || /permission/i.test(c)) return 'Этой почте доступ не открыт. Попросите владельца добавить её в список.';
    if (/popup-blocked|popup-closed|cancelled-popup/.test(c)) return 'Окно входа закрылось. Попробуйте ещё раз.';
    if (/network/.test(c)) return 'Нет связи. Заметки отправятся, когда появится интернет.';
    if (/unauthorized-domain/.test(c)) return 'Домен приложения не добавлен в Firebase (Authorized domains).';
    return (e && e.message) || String(e);
  }
  async function init() {
    if (!st.on) return;
    try {
      const [app, au, fs] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
      F = { au, fs };
      const a = app.initializeApp(cfg);
      auth = au.getAuth(a);
      await au.setPersistence(auth, au.browserLocalPersistence).catch(() => {});
      try { db = fs.initializeFirestore(a, { localCache: fs.persistentLocalCache() }); } catch (e) { db = fs.getFirestore(a); }
      au.getRedirectResult(auth).catch(fail);
      au.onAuthStateChanged(auth, u => { st.user = u ? { uid: u.uid, name: u.displayName || u.email, email: u.email, photo: u.photoURL } : null; st.ready = true; st.err = ''; emit(); u ? start() : stop(); });
    } catch (e) { st.on = false; fail(e); }
  }
  async function signIn() {
    if (!auth) return;
    const p = new F.au.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await F.au.signInWithPopup(auth, p); }
    catch (e) {
      if (/popup-blocked|operation-not-supported|web-storage/.test(e.code || '')) { try { await F.au.signInWithRedirect(auth, p); } catch (e2) { fail(e2); } }
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
      const remote = {}; snap.forEach(d => { remote[d.id] = d.data(); });
      for (const [vin, n] of Object.entries(S.notes)) {
        if (!n || !n.text || n.by) continue;
        const r = remote[vin], rt = r && r.at && r.at.toDate ? r.at.toDate().toISOString() : '';
        if (!r || (n.updatedAt || '') > rt) await pushNote(vin, n);
      }
    } catch (e) { fail(e); }
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
