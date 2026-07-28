import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

export default NextAuth(authConfig).auth

export const config = {
  // api/auth/ is anchored with the slash so future routes like /api/authorization
  // do not silently skip the session check.
  matcher: ['/((?!api/auth/|_next/static|_next/image|favicon.ico).*)'],
}
