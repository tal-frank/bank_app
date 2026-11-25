// Checks part of the request against a zod schema BEFORE the controller
// runs. Usage in a route file (day 2):
//
//   router.post('/auth/signup', validate(signupSchema), signupController);
//   router.get('/transactions', auth, validate(pageSchema, 'query'), listController);
//
// If the data is invalid, the request stops here with
//   400 { "error": { "code": "VALIDATION_ERROR", "fields": { "email": "..." } } }
// so controllers and services can trust their input completely.
//
// If it's valid, the CLEANED data (trimmed, lowercased, defaults filled in,
// unknown fields rejected - whatever the schema says) is stored in
// req.validated.body / req.validated.query / req.validated.params.
// Controllers read from req.validated, never from req.body directly.
// (We don't overwrite req.query because in Express 5 it's read-only.)
import { AppError } from '../utils/AppError.js';

/**
 * @param {import('zod').ZodType} schema
 * @param {'body' | 'query' | 'params'} [source]
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', toFields(result.error));
    }

    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}

// zod reports a list of issues like { path: ['email'], message: '...' }.
// The API spec wants { email: '...' } - one message per field, so the
// frontend can show it under the matching input. If a field has several
// problems, the first one is shown. Problems with the body as a whole
// (e.g. an unknown extra field) have no single field, so they go under "_".
function toFields(zodError) {
  const fields = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}
