(function () {
  const byId = (id) => document.getElementById(id);

  const firebaseConfig = {
    apiKey: 'REPLACE_WITH_API_KEY',
    authDomain: 'REPLACE_WITH_AUTH_DOMAIN',
    projectId: 'REPLACE_WITH_PROJECT_ID',
    storageBucket: 'REPLACE_WITH_STORAGE_BUCKET',
    messagingSenderId: 'REPLACE_WITH_MESSAGING_SENDER_ID',
    appId: 'REPLACE_WITH_APP_ID',
  };

  const hasRealConfig = Object.values(firebaseConfig).every((value) => !value.startsWith('REPLACE_WITH_'));

  let db = null;
  if (hasRealConfig) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }

  const EXPIRY_MS = {
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1m': 30 * 24 * 60 * 60 * 1000,
    never: null,
  };

  function generateKey() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function encryptJson(data, key) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  }

  function decryptJson(ciphertext, key) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error('Unable to decrypt. Wrong key or data corrupted.');
    }
    return JSON.parse(decrypted);
  }

  function hashPassword(password) {
    return password ? CryptoJS.SHA256(password).toString() : null;
  }

  function ensureDb() {
    if (!db) {
      throw new Error('Firebase config missing. Update script.js with your Firestore credentials.');
    }
  }

  async function savePaste(id, payload) {
    ensureDb();
    await db.collection('pastes').doc(id).set(payload);
  }

  async function getPaste(id) {
    ensureDb();
    const doc = await db.collection('pastes').doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async function deletePaste(id) {
    ensureDb();
    await db.collection('pastes').doc(id).delete();
  }

  function generatePasteId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function setAlert(message, type = 'secondary') {
    const alert = byId('statusAlert');
    if (!alert) return;
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
  }

  function computeExpiry(expiryKey) {
    const delta = EXPIRY_MS[expiryKey];
    return delta ? Date.now() + delta : null;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initCreatePage() {
    const createBtn = byId('createBtn');
    if (!createBtn) return;

    const tabs = document.querySelectorAll('[data-tab]');
    const editorPanel = byId('editorPanel');
    const previewPanel = byId('previewPanel');
    const editor = byId('editor');
    const preview = byId('preview');
    const format = byId('format');
    const attachBtn = byId('attachBtn');
    const fileInput = byId('fileInput');
    const attachmentInfo = byId('attachmentInfo');
    const dropZone = byId('dropZone');
    const copyPasteBtn = byId('copyPasteBtn');

    let attachedFile = null;

    const updatePreview = () => {
      const content = editor.value;
      const selectedFormat = format.value;
      if (selectedFormat === 'markdown') {
        const rawHtml = marked.parse(content, { breaks: true, gfm: true });
        preview.innerHTML = DOMPurify.sanitize(rawHtml);
      } else if (selectedFormat === 'code') {
        preview.innerHTML = `<pre><code class="language-javascript">${escapeHtml(content)}</code></pre>`;
        const node = preview.querySelector('code');
        if (node) Prism.highlightElement(node);
      } else {
        preview.textContent = content;
      }
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.tab === 'preview') {
          updatePreview();
          editorPanel.classList.add('d-none');
          previewPanel.classList.remove('d-none');
        } else {
          editorPanel.classList.remove('d-none');
          previewPanel.classList.add('d-none');
        }
      });
    });

    const setAttachment = (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('File too large. Max size is 5MB.');
        return;
      }
      attachedFile = file;
      attachmentInfo.classList.remove('d-none');
      attachmentInfo.textContent = `Attached: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    };

    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => setAttachment(e.target.files[0]));

    ['dragenter', 'dragover'].forEach((ev) => {
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
      });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
      });
    });
    dropZone.addEventListener('drop', (e) => setAttachment(e.dataTransfer.files[0]));

    byId('toggleMode').addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
    });
    byId('theme').addEventListener('change', (e) => {
      document.body.classList.toggle('light-mode', e.target.value === 'light');
    });

    copyPasteBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(editor.value);
    });

    byId('copyLinkBtn').addEventListener('click', async () => {
      const shareLink = byId('shareLink').value;
      if (shareLink) {
        await navigator.clipboard.writeText(shareLink);
      }
    });

    createBtn.addEventListener('click', async () => {
      try {
        if (!editor.value.trim() && !attachedFile) {
          alert('Please enter text or attach a file.');
          return;
        }

        createBtn.disabled = true;
        createBtn.textContent = 'Encrypting…';

        const key = generateKey();
        const pasteId = generatePasteId();

        let filePayload = null;
        if (attachedFile) {
          const dataUrl = await readFileAsDataUrl(attachedFile);
          filePayload = {
            name: attachedFile.name,
            type: attachedFile.type,
            size: attachedFile.size,
            data: dataUrl,
          };
        }

        const payload = {
          text: editor.value,
          file: filePayload,
        };

        const record = {
          encrypted_content: encryptJson(payload, key),
          expiry_time: computeExpiry(byId('expiry').value),
          burn_after_read: byId('burnAfterRead').checked,
          password_hash: hashPassword(byId('password').value),
          creation_time: Date.now(),
          format: byId('format').value,
        };

        await savePaste(pasteId, record);

        const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}paste.html?id=${encodeURIComponent(pasteId)}#${encodeURIComponent(key)}`;
        byId('shareLink').value = url;
        byId('resultBox').classList.remove('d-none');
        byId('qrCode').innerHTML = '';
        new QRCode(byId('qrCode'), {
          text: url,
          width: 96,
          height: 96,
          colorDark: '#000000',
          colorLight: '#ffffff',
        });
      } catch (error) {
        alert(error.message || 'Failed to create paste.');
      } finally {
        createBtn.disabled = false;
        createBtn.textContent = 'Create Private Paste';
      }
    });
  }

  async function initViewPage() {
    const unlockBtn = byId('unlockBtn');
    if (!unlockBtn) return;

    const params = new URLSearchParams(location.search);
    const pasteId = params.get('id');
    const key = decodeURIComponent(location.hash.replace(/^#/, ''));

    if (!pasteId || !key) {
      setAlert('Invalid link. Missing paste ID or encryption key.', 'danger');
      return;
    }

    let paste;
    try {
      paste = await getPaste(pasteId);
    } catch (error) {
      setAlert(error.message, 'danger');
      return;
    }

    if (!paste) {
      setAlert('Paste not found.', 'warning');
      return;
    }

    if (paste.expiry_time && Date.now() > paste.expiry_time) {
      setAlert('This paste has expired.', 'warning');
      return;
    }

    const passwordSection = byId('passwordSection');
    const showPaste = async (passwordInput = '') => {
      try {
        if (paste.password_hash) {
          const providedHash = hashPassword(passwordInput);
          if (providedHash !== paste.password_hash) {
            throw new Error('Incorrect password.');
          }
        }

        const decrypted = decryptJson(paste.encrypted_content, key);
        const text = decrypted.text || '';
        const file = decrypted.file;

        byId('pasteSection').classList.remove('d-none');
        setAlert('Paste decrypted successfully.', 'success');
        byId('pasteMeta').textContent = `Format: ${paste.format}${paste.burn_after_read ? ' • Burn after read' : ''}`;

        byId('plainContainer').classList.add('d-none');
        byId('markdownContainer').classList.add('d-none');
        byId('codeContainer').classList.add('d-none');

        if (paste.format === 'markdown') {
          const html = marked.parse(text, { breaks: true, gfm: true });
          byId('markdownContainer').innerHTML = DOMPurify.sanitize(html);
          byId('markdownContainer').classList.remove('d-none');
        } else if (paste.format === 'code') {
          const code = byId('codeContent');
          code.textContent = text;
          byId('codeContainer').classList.remove('d-none');
          Prism.highlightElement(code);
        } else {
          byId('plainContainer').textContent = text;
          byId('plainContainer').classList.remove('d-none');
        }

        if (file) {
          const downloadFile = byId('downloadFile');
          downloadFile.href = file.data;
          downloadFile.download = file.name;
          byId('fileContainer').classList.remove('d-none');
        }

        byId('copyContentBtn').addEventListener('click', () => navigator.clipboard.writeText(text));

        if (paste.burn_after_read) {
          await deletePaste(pasteId);
        }
      } catch (error) {
        setAlert(error.message, 'danger');
      }
    };

    if (paste.password_hash) {
      passwordSection.classList.remove('d-none');
      setAlert('Password required to decrypt this paste.', 'info');
      unlockBtn.addEventListener('click', () => {
        showPaste(byId('viewPassword').value);
      });
    } else {
      await showPaste('');
    }
  }

  initCreatePage();
  initViewPage();
})();
