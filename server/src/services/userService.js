// Rules about the logged-in user. No HTTP here (see authService.js header).
import { AppError } from '../utils/AppError.js';
import * as userRepo from '../repositories/userRepo.js';
import { toPublicUser } from '../utils/toPublicUser.js';

/**
 * The user behind a token. If they no longer exist (e.g. the in-memory store
 * was wiped by a restart while the browser still holds a token), the token
 * refers to nobody: 401, so the frontend sends them to log in again.
 */
export async function loadCurrentUser(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Please log in.');
  return user;
}

export async function getMe(userId) {
  return toPublicUser(await loadCurrentUser(userId));
}
