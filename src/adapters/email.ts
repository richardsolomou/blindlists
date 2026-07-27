import nodemailer from 'nodemailer'

export type Email = { to: string; subject: string; text: string }

export type EmailDelivery = { send: (email: Email) => Promise<void>; configured: boolean }

/**
 * SMTP because every provider speaks it — Resend, Postmark, Fastmail, a relay on
 * the box. With nothing configured, mail is written to the log instead so a
 * development or self-hosted instance still works, just without delivery.
 */
export function buildEmailDelivery(env: NodeJS.ProcessEnv = process.env): EmailDelivery {
  const host = env.SMTP_HOST?.trim()
  const from = env.EMAIL_FROM?.trim()
  if (!host || !from) {
    return {
      configured: false,
      send: async (email) => {
        console.info({ event: 'email_not_sent', to: email.to, subject: email.subject }, email.text)
      },
    }
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(env.SMTP_PORT ?? 587),
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } : undefined,
  })

  return {
    configured: true,
    send: async (email) => {
      await transport.sendMail({ from, to: email.to, subject: email.subject, text: email.text })
    },
  }
}
