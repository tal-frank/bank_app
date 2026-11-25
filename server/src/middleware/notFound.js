// Runs only when no route matched the request. Instead of Express's default
// HTML "Cannot GET /x" page, it throws an AppError, so the client gets the
// same JSON error shape as every other error.
//
// Express 5 passes errors thrown in middleware to the error handler
// automatically, so a plain `throw` is enough (Express 4 needed next(err)).
import { AppError } from '../utils/AppError.js';

export function notFound(req, res) {
  throw new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} does not exist.`);
}
