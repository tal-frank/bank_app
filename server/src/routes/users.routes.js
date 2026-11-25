// /api/users/* - every route here needs a valid access token.
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getMe } from '../controllers/userController.js';

export const usersRoutes = Router();

usersRoutes.get('/me', auth, getMe);
