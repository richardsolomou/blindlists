import type { Email } from '../adapters/email'

/**
 * Plain text only, and short. These land in a group chat's worth of inboxes and
 * exist to get someone back to the page, not to be read.
 */

export const verifyEmail = (to: string, url: string): Email => ({
  to,
  subject: 'Confirm your email for Sealed Lists',
  text: `Confirm your email address and your account is ready:\n\n${url}\n\nIf you did not sign up, ignore this.`,
})

export const resetPasswordEmail = (to: string, url: string): Email => ({
  to,
  subject: 'Reset your Sealed Lists password',
  text: `Set a new password here:\n\n${url}\n\nThe link stops working in an hour. If you did not ask for this, ignore it.`,
})

export const gameStartedEmail = (to: string, crew: string, gameNumber: number, url: string): Email => ({
  to,
  subject: `${crew}: your list is due for game ${gameNumber}`,
  text: `A game has started in ${crew} and you are in it.\n\nSeal your list here:\n\n${url}\n\nNobody sees it until the last list is in.`,
})

export const gameRevealedEmail = (to: string, crew: string, gameNumber: number, url: string): Email => ({
  to,
  subject: `${crew}: every list is in for game ${gameNumber}`,
  text: `The last list landed, so game ${gameNumber} is revealed and locked.\n\nRead them here:\n\n${url}`,
})
