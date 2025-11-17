// File: src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { uploadProfile } = require('../middleware/upload.middleware');
const { verifyToken } = require('../middleware/auth.middleware');

// 1. REGISTER (Public)
// Gunakan middleware 'uploadProfile.single' untuk menangani 'foto_profil'
router.post(
  '/register',
  uploadProfile.single('foto_profil'),
  authController.register
);

// 2. LOGIN (Public)
router.post('/login', authController.login);

// 3. LOGOUT (Protected)
router.post('/logout', verifyToken, authController.logout);

// 4. GET CURRENT USER (Protected)
router.get('/me', verifyToken, authController.getCurrentUser);

// 5. CHANGE PASSWORD (Protected)
router.post(
  '/change-password',
  verifyToken,
  authController.changePassword
);

module.exports = router;