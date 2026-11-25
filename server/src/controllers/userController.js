// HTTP side of /api/users. Thin: the `auth` middleware has set req.user.
import * as userService from '../services/userService.js';

// GET /api/users/me -> 200 User
export async function getMe(req, res) {
  res.json(await userService.getMe(req.user.id));
}
