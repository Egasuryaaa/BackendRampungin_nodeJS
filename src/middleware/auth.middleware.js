// File: src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma.util');
const { sendResponse } = require('../utils/response.util');

const verifyToken = async (req, res, next) => {
  let token;

  // 1. Cek header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendResponse(res, 401, 'error', 'Token tidak ada, akses ditolak');
  }

  // 2. Cek apakah token ada di blacklist (sudah logout)
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const blacklisted = await prisma.jwt_blacklist.findUnique({
    where: { token_hash: tokenHash },
  });

  if (blacklisted) {
    return sendResponse(res, 401, 'error', 'Token tidak valid (sudah logout)');
  }

  // 3. Verifikasi token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Ambil data user dari DB dan sisipkan ke 'req'
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      include: {
        roles: true
      }
    });

    if (!user) {
      return sendResponse(res, 401, 'error', 'User tidak ditemukan');
    }

    // Sisipkan data user ke request untuk dipakai controller
    req.user = user;
    req.token = token; // Sisipkan token untuk logout
    next();
  } catch (error) {
    return sendResponse(res, 401, 'error', 'Token tidak valid atau kadaluarsa');
  }
};

// Middleware untuk cek Role
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.roles.name)) {
      return sendResponse(res, 403, 'error', 'Akses ditolak, role tidak sesuai');
    }
    next();
  };
};

module.exports = {
  verifyToken,
  isClient: checkRole(['client']),
  isTukang: checkRole(['tukang']),
  isAdmin: checkRole(['admin']),
  isClientOrTukang: checkRole(['client', 'tukang']),
};