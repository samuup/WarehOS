import crypto from 'crypto';

export const DB_MAGIC = 'WHENC01';
export const BACKUP_MAGIC = 'WHBAK01';
const MAGIC_BUF = Buffer.from(DB_MAGIC, 'ascii');
const BACKUP_MAGIC_BUF = Buffer.from(BACKUP_MAGIC, 'ascii');
const NONCE_LEN = 12;
const TAG_LEN = 16;
const SALT_LEN = 16;
const SCRYPT_KEYLEN = 32;

export function hasDbMagic(buf: Buffer): boolean {
  return buf.length >= MAGIC_BUF.length && buf.subarray(0, MAGIC_BUF.length).equals(MAGIC_BUF);
}

export function hasBackupMagic(buf: Buffer): boolean {
  return (
    buf.length >= BACKUP_MAGIC_BUF.length + SALT_LEN + NONCE_LEN + TAG_LEN + 1 &&
    buf.subarray(0, BACKUP_MAGIC_BUF.length).equals(BACKUP_MAGIC_BUF)
  );
}

function deriveBackupKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
}

export function encryptBackup(data: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = deriveBackupKey(password, salt);
  const nonce = crypto.randomBytes(NONCE_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([BACKUP_MAGIC_BUF, salt, nonce, tag, encrypted]);
}

export function decryptBackup(buf: Buffer, password: string): Buffer {
  if (!hasBackupMagic(buf)) {
    throw new Error('El archivo no es un backup cifrado de WarehOS');
  }
  const salt = buf.subarray(BACKUP_MAGIC_BUF.length, BACKUP_MAGIC_BUF.length + SALT_LEN);
  const nonce = buf.subarray(
    BACKUP_MAGIC_BUF.length + SALT_LEN,
    BACKUP_MAGIC_BUF.length + SALT_LEN + NONCE_LEN,
  );
  const tag = buf.subarray(
    BACKUP_MAGIC_BUF.length + SALT_LEN + NONCE_LEN,
    BACKUP_MAGIC_BUF.length + SALT_LEN + NONCE_LEN + TAG_LEN,
  );
  const ciphertext = buf.subarray(BACKUP_MAGIC_BUF.length + SALT_LEN + NONCE_LEN + TAG_LEN);
  const key = deriveBackupKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Contraseña incorrecta o backup corrupto');
  }
}

export function encryptBytes(data: Buffer, key: Buffer): Buffer {
  const nonce = crypto.randomBytes(NONCE_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC_BUF, nonce, tag, encrypted]);
}

export function decryptBytes(buf: Buffer, key: Buffer): Buffer {
  if (!hasDbMagic(buf)) {
    throw new Error('El archivo de base de datos no está cifrado');
  }
  const nonce = buf.subarray(MAGIC_BUF.length, MAGIC_BUF.length + NONCE_LEN);
  const tag = buf.subarray(
    MAGIC_BUF.length + NONCE_LEN,
    MAGIC_BUF.length + NONCE_LEN + TAG_LEN,
  );
  const ciphertext = buf.subarray(MAGIC_BUF.length + NONCE_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}