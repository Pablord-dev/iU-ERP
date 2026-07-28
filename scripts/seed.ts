import 'dotenv/config'
import { db } from '@/db'
import { seed } from '@/db/seed'

const required = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

await seed(db, {
  orgName: required('SEED_ORG_NAME'),
  adminEmail: required('SEED_ADMIN_EMAIL'),
  adminPassword: required('SEED_ADMIN_PASSWORD'),
  adminName: required('SEED_ADMIN_NAME'),
})
console.log('Seed completed.')
process.exit(0)
