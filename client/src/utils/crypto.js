import nacl from "tweetnacl";
import * as utf8 from "tweetnacl-util";

// Helper wrappers to use base64 strings for storage/transfer
export function generateKeyPairBase64() {
  const kp = nacl.box.keyPair();
  return {
    publicKey: utf8.encodeBase64(kp.publicKey),
    secretKey: utf8.encodeBase64(kp.secretKey),
  };
}

export function encryptMessageBase64(plaintext, senderSecretKeyBase64, recipientPublicKeyBase64) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const senderSecretKey = utf8.decodeBase64(senderSecretKeyBase64);
  const recipientPubKey = utf8.decodeBase64(recipientPublicKeyBase64);
  const messageUint8 = utf8.decodeUTF8(plaintext);
  const box = nacl.box(messageUint8, nonce, recipientPubKey, senderSecretKey);
  return {
    ciphertext: utf8.encodeBase64(box),
    nonce: utf8.encodeBase64(nonce),
  };
}

export function decryptMessageBase64(ciphertextBase64, nonceBase64, senderPublicKeyBase64, recipientSecretKeyBase64) {
  const ciphertext = utf8.decodeBase64(ciphertextBase64);
  const nonce = utf8.decodeBase64(nonceBase64);
  const senderPub = utf8.decodeBase64(senderPublicKeyBase64);
  const recipientSecret = utf8.decodeBase64(recipientSecretKeyBase64);
  const decrypted = nacl.box.open(ciphertext, nonce, senderPub, recipientSecret);
  if (!decrypted) return null; // decryption failed / tampered
  return utf8.encodeUTF8(decrypted);
}