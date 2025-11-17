// File: src/routes/tukang.routes.js
const express = require('express');
const router = express.Router();
const { verifyToken, isTukang } = require('../middleware/auth.middleware');
const { uploadProfile } = require('../middleware/upload.middleware');
const tukangController = require('../controllers/tukang.controller');

// Middleware untuk semua rute di file ini: harus login & role TUKANG
// PENTING: Anda mungkin perlu menambahkan cek 'is_verified' di middleware isTukang
router.use(verifyToken, isTukang);

// 20. GET TUKANG PROFILE
router.get('/profile', tukangController.getTukangProfile);

// 21. UPDATE TUKANG PROFILE (Support JSON & Multipart)
router.put('/profile', uploadProfile.single('foto_profil'), tukangController.updateTukangProfile);

// 22. GET CATEGORIES (untuk Tukang)
router.get('/categories', tukangController.getTukangCategories);

// 23. UPDATE AVAILABILITY
router.put('/availability', tukangController.updateAvailability);

// 24. GET ORDERS
router.get('/orders', tukangController.getOrders);

// 25. GET ORDER DETAIL
router.get('/orders/:transaksi_id', tukangController.getOrderDetail);

// 26. ACCEPT ORDER
router.put('/orders/:transaksi_id/accept', tukangController.acceptOrder);

// 27. REJECT ORDER
router.put('/orders/:transaksi_id/reject', tukangController.rejectOrder);

// 28. START WORK
router.put('/orders/:transaksi_id/start', tukangController.startWork);

// 29. COMPLETE WORK
router.put('/orders/:transaksi_id/complete', tukangController.completeWork);

// 30. CONFIRM TUNAI PAYMENT
router.put('/orders/:transaksi_id/confirm-tunai', tukangController.confirmTunaiPayment);

// 31. GET RATINGS
router.get('/ratings', tukangController.getRatings);

// 32. REQUEST WITHDRAWAL
router.post('/withdrawal', tukangController.requestWithdrawal);

// 33. GET WITHDRAWAL HISTORY
router.get('/withdrawal', tukangController.getWithdrawalHistory);

// 34. GET TUKANG STATISTICS
router.get('/statistics', tukangController.getTukangStatistics);

module.exports = router;