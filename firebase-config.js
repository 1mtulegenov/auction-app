/* Настройки Firebase для общих заметок. Эти ключи не секретные: доступ к базе закрывают правила Firestore
   (читать и писать могут только адреса Google из списка). Пустой apiKey: заметки хранятся только на устройстве. */
window.FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};
