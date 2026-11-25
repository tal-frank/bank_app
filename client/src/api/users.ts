// /users endpoints. "me" comes from the token, so there's no id to pass.
import { api } from './client';
import type { User } from './types';

/** GET /users/me - profile + balance of whoever the access token belongs to. */
export async function getMe(): Promise<User> {
  const res = await api.get<User>('/users/me');
  return res.data;
}
