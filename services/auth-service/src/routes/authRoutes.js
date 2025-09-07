import express from 'express';
import { register, login, me, updateProfile, changePassword } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.patch('/profile', updateProfile);
router.patch('/change-password', changePassword);

export default router;
