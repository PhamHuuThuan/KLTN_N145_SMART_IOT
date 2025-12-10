import express from 'express';
import { register, login, me, updateProfile, changePassword, forgotPassword, verifyResetCode, resetPassword } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.patch('/profile', updateProfile);
router.patch('/change-password', changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

export default router;
