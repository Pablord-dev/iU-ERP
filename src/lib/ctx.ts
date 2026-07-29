/** Tenant + actor scope threaded through every service call. */
export interface Ctx {
  orgId: string
  userId: string
}
