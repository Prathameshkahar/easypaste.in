(function () {
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

  window.PrivatePasteCrypto = {
    generateKey,
    encryptJson,
    decryptJson,
    hashPassword,
  };
})();
