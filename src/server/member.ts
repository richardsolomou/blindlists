import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'

const YEAR_SECONDS = 365 * 24 * 60 * 60

/**
 * Which member you are on this device. One cookie per crew, so being in two
 * crews does not clobber either. It holds no authority the crew link does not
 * already grant — anyone with the link can tap any name — so it is not signed.
 */
const cookieName = (crewToken: string) => `bl_${crewToken}`

export function readMember(crewToken: string) {
  return getCookie(cookieName(crewToken))
}

export function writeMember(crewToken: string, memberId: string) {
  setCookie(cookieName(crewToken), memberId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR_SECONDS,
    secure: secureRequest(),
  })
}

export function clearMember(crewToken: string) {
  deleteCookie(cookieName(crewToken), { path: '/' })
}

function secureRequest() {
  const request = getRequest()
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  return (forwarded ?? new URL(request.url).protocol.replace(':', '')) === 'https'
}
