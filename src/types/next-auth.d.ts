import type { DefaultSession } from 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    role: 'admin' | 'member'
    organizationId: string
  }
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      role: 'admin' | 'member'
      organizationId: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'admin' | 'member'
    organizationId: string
  }
}
