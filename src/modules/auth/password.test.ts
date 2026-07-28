import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('s3cure-pass')
    expect(hash).not.toContain('s3cure-pass')
    expect(await verifyPassword('s3cure-pass', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cure-pass')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
