// File: src/middleware/upload.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Fungsi untuk memastikan direktori ada
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Konfigurasi storage untuk Foto Profil
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'writable/profiles';
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Buat nama file unik: fieldname-timestamp.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Konfigurasi storage untuk Bukti Topup
const topupStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'writable/topup';
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Filter file (hanya izinkan gambar)
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diizinkan!'), false);
  }
};

// Filter file untuk topup (gambar atau PDF)
const topupFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar atau PDF yang diizinkan!'), false);
  }
};

// Buat instance multer
const uploadProfile = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const uploadTopup = multer({
  storage: topupStorage,
  fileFilter: topupFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

module.exports = { uploadProfile, uploadTopup };