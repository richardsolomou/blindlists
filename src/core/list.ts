export const LIST_MAX_LENGTH = 10_000

/**
 * The exact bytes that get stored and hashed, so a player can reproduce the
 * fingerprint themselves: LF line endings, no trailing whitespace on any line,
 * no leading or trailing blank lines.
 */
export function normalizeList(text: string) {
  return text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

export function shortFingerprint(hash: string) {
  return hash.slice(0, 12)
}
