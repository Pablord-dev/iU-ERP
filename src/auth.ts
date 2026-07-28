import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { authConfig } from '@/auth.config'
import { db } from '@/db'
import { getSessionUser, verifyCredentials } from '@/modules/auth/service'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Node-only override: the edge-safe jwt callback in auth.config.ts cannot
    // touch the DB, so middleware still does a cookie-only check; every auth()
    // call in pages/actions goes through here and revalidates against the DB.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.organizationId = user.organizationId
        return token
      }
      let fresh: Awaited<ReturnType<typeof getSessionUser>>
      try {
        fresh = await getSessionUser(db, token.id)
      } catch {
        // Transient DB failure: keep the current token instead of killing the
        // session; revocation is re-checked on the next auth() call.
        return token
      }
      if (!fresh) return null // deactivated or soft-deleted: invalidate the session
      token.name = fresh.name
      token.role = fresh.role
      token.organizationId = fresh.organizationId
      return token
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null
        return verifyCredentials(db, parsed.data.email, parsed.data.password)
      },
    }),
  ],
})
