// The LAST middleware in app.js. Express only calls it when something
// earlier threw an error or called next(err). It turns every error into the
// one response shape from openapi.yaml:
//
//   { "error": { "code": "...", "message": "...", "fields": { ... } } }
//
// Express knows this is an error handler because it takes FOUR arguments,
// so `next` must stay in the list even though it's barely used.
import { AppError } from '../utils/AppError.js';

export function errorHandler(err, req, res, next) {
  // If the response already started streaming, we can't send a new one.
  // Hand the error to Express's built-in handler, which closes the connection.
  if (res.headersSent) {
    return next(err);
  }

  // 1. Errors we threw on purpose: send exactly what they describe.
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fields && { fields: err.fields }) },
    });
  }

  // 2. Errors from express.json() while reading the body. They carry a
  //    `type` and a 4xx `status`. These are the client's fault, not bugs.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON.' },
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' },
    });
  }
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      error: { code: 'VALIDATION_ERROR', message: 'The request body could not be read.' },
    });
  }

  // 3. Anything else is a bug. Log everything for us (stack trace included),
  //    but tell the client nothing about our internals.
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
}
