// Field rules shared by several schema files, defined once.
import { z } from 'zod';

// zod's default message for a missing field is technical ("expected string,
// received undefined"). This gives a friendlier one.
export const text = () =>
  z.string({
    error: (issue) => (issue.input === undefined ? 'This field is required.' : 'Must be text.'),
  });

// Trim and lowercase BEFORE checking, so " Dana@Example.com " is stored and
// compared as "dana@example.com" - one account, however it's typed.
export const email = text()
  .trim()
  .toLowerCase()
  .pipe(z.email('Must be a valid email address.').max(254, 'Email is too long.'));
