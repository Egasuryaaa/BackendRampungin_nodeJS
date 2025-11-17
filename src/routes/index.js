// File: src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const clientRoutes = require('./client.routes');
const tukangRoutes = require('./tukang.routes');

router.use('/auth', authRoutes);
router.use('/client', clientRoutes);
router.use('/tukang', tukangRoutes);

module.exports = router;