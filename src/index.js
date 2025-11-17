// File: src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mainRouter = require('./routes'); // Import router utama

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Aktifkan CORS
app.use(express.json()); // Body parser untuk JSON
app.use(express.urlencoded({ extended: true })); // Body parser untuk form-data

// Middleware untuk menyajikan file statis (foto profil, bukti topup)
// Ini akan membuat URL "uploads/profiles/foto.jpg" bisa diakses
app.use('/uploads', express.static(path.join(__dirname, '../writable')));

// Router Utama
// Semua rute akan punya prefix /api
// Contoh: /api/auth/login
app.use('/api', mainRouter);

// Root endpoint untuk cek server
app.get('/', (req, res) => {
  res.send('RAMPUNGIN.ID API Server is running!');
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});