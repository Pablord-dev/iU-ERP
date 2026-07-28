import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      if (request.nextUrl.pathname.startsWith('/login')) return true
      return isLoggedIn
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.organizationId = user.organizationId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.organizationId = token.organizationId
      return session
    },
  },
  providers: [], // filled in auth.ts (needs DB access, not edge-safe)
} satisfies NextAuthConfig
