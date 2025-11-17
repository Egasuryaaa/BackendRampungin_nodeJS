// File: src/routes/client.routes.js
const express = require('express');
const router = express.Router();
const { verifyToken, isClient } = require('../middleware/auth.middleware');
const { uploadProfile, uploadTopup } = require('../middleware/upload.middleware');
const clientController = require('../controllers/client.controller');

// Middleware untuk semua rute di file ini: harus login & role CLIENT
router.use(verifyToken, isClient);

// 6. GET CLIENT PROFILE
router.get('/profile', clientController.getClientProfile);

// 7. UPDATE CLIENT PROFILE (Support JSON & Multipart)
router.put('/profile', uploadProfile.single('foto_profil'), clientController.updateClientProfile);

// 8. GET CATEGORIES
router.get('/categories', clientController.getCategories);

// 9. BROWSE TUKANG
router.get('/tukang', clientController.browseTukang);

// 10. GET TUKANG DETAIL
router.get('/tukang/:tukang_id', clientController.getTukangDetail);

// 11. SEARCH TUKANG
router.get('/search-tukang', clientController.searchTukang);

// 12. CREATE BOOKING
router.post('/booking', clientController.createBooking);

// 13. GET TRANSACTIONS
router.get('/transactions', clientController.getTransactions);

// 14. GET TRANSACTION DETAIL
router.get('/transactions/:transaksi_id', clientController.getTransactionDetail);

// 15. CANCEL TRANSACTION
router.put('/transactions/:transaksi_id/cancel', clientController.cancelTransaction);

// 16. REQUEST TOP-UP
router.post('/topup', uploadTopup.single('bukti_pembayaran'), clientController.requestTopup);

// 17. GET TOP-UP HISTORY
router.get('/topup', clientController.getTopupHistory);

// 18. SUBMIT RATING
router.post('/rating', clientController.submitRating);

// 19. GET CLIENT STATISTICS
router.get('/statistics', clientController.getClientStatistics);

module.exports = router;