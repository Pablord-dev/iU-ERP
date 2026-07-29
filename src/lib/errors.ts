/** Business-rule violation; `message` is user-facing Spanish (spec §7). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
