import crypto from 'node:crypto'

/** Invite links are the only credential in the app; 128 bits keeps them unguessable and short. */
export function createToken() {
  return crypto.randomBytes(16).toString('base64url')
}

/** SHA-256 of the stored list text, reproducible with `shasum -a 256` on the same bytes. */
export function fingerprint(list: string) {
  return crypto.createHash('sha256').update(list, 'utf8').digest('hex')
}

export function createId() {
  return crypto.randomBytes(8).toString('base64url')
}
