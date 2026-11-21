export class HiveAuthError extends Error {
  constructor (message, { code = 'error', cause } = {}) {
    super(message)
    this.name = 'HiveAuthError'
    this.code = code
    if (cause !== undefined) this.cause = cause
  }
}
