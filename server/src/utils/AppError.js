// An error we throw ON PURPOSE, carrying everything needed to build the
// HTTP response described in openapi.yaml:
//
//   throw new AppError(422, 'INSUFFICIENT_FUNDS', 'Your balance is too low.');
//
// The error handler middleware sees an AppError and sends
//   422 { "error": { "code": "INSUFFICIENT_FUNDS", "message": "..." } }
//
// Any error that is NOT an AppError is treated as a bug and becomes a
// generic 500, so internal details never reach the client.
export class AppError extends Error {
  /**
   * @param {number} status  HTTP status code, e.g. 400, 404, 422
   * @param {string} code    Machine-readable code from the spec's Error enum
   * @param {string} message Human-readable text, safe to show the user
   * @param {Record<string, string>} [fields] Per-field messages (validation errors only)
   */
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
