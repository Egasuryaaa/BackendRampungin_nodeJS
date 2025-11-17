// File: src/controllers/auth.controller.js
const prisma = require('../utils/prisma.util');
const { sendResponse } = require('../utils/response.util');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Fungsi helper untuk generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// 1. REGISTER
exports.register = async (req, res) => {
  try {
    const {
      username, email, password, nama_lengkap, no_telp, role,
      alamat, kota, provinsi, kode_pos,
      // Data Tukang
      pengalaman_tahun, tarif_per_jam, bio, keahlian, kategori_ids,
      nama_bank, nomor_rekening, nama_pemilik_rekening
    } = req.body;

    // A. Validasi dasar
    if (!username || !email || !password || !nama_lengkap || !no_telp || !role) {
      return sendResponse(res, 400, 'error', 'Field wajib tidak boleh kosong');
    }
    if (role !== 'client' && role !== 'tukang') {
      return sendResponse(res, 400, 'error', 'Role tidak valid');
    }

    // B. Cek duplikat
    const existingUser = await prisma.users.findFirst({
      where: { OR: [{ username: username }, { email: email }] },
    });
    if (existingUser) {
      return sendResponse(res, 409, 'error', 'Username atau email sudah terdaftar');
    }

    // C. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // D. Cek path foto profil (jika ada)
    let fotoProfilPath = null;
    if (req.file) {
      // Path disimpan sesuai format dokumen: uploads/profiles/namafile.jpg
      fotoProfilPath = req.file.path.replace(/\\/g, '/').replace('writable/', '');
    }

    // E. Tentukan status verifikasi
    // Client auto-verified, Tukang perlu verifikasi admin
    const is_verified = (role.toUpperCase() === 'CLIENT');

    // F. Tentukan id_role berdasarkan role
    let id_role;
    if (role.toUpperCase() === 'CLIENT') {
      const clientRole = await prisma.roles.findFirst({ where: { name: 'client' } });
      id_role = clientRole?.id || 2; // default 2 untuk client
    } else {
      const tukangRole = await prisma.roles.findFirst({ where: { name: 'tukang' } });
      id_role = tukangRole?.id || 3; // default 3 untuk tukang
    }

    // G. Buat User baru
    const newUser = await prisma.users.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        nama_lengkap,
        no_telp,
        alamat,
        kota,
        provinsi,
        kode_pos,
        foto_profil: fotoProfilPath,
        is_verified: is_verified,
        poin: 0,
        id_role: id_role,
      },
    });

    // H. Jika role TUKANG, buat juga profil tukang
    const tukangRole = await prisma.roles.findFirst({ where: { name: 'tukang' } });
    if (newUser.id_role === tukangRole?.id) {
      await prisma.profil_tukang.create({
        data: {
          user_id: newUser.id,
          pengalaman_tahun: pengalaman_tahun ? parseInt(pengalaman_tahun) : 0,
          tarif_per_jam: tarif_per_jam ? parseFloat(tarif_per_jam) : 0,
          bio: bio,
          keahlian: Array.isArray(keahlian) ? keahlian : (keahlian ? [keahlian] : []),
          nama_bank: nama_bank,
          nomor_rekening: nomor_rekening,
          nama_pemilik_rekening: nama_pemilik_rekening,
        },
      });
      
      // Hubungkan kategori jika ada
      if (kategori_ids) {
        const ids = Array.isArray(kategori_ids) ? kategori_ids : kategori_ids.split(',').map(id => parseInt(id.trim()));
        for (const kategori_id of ids) {
          await prisma.kategori_tukang.create({
            data: {
              tukang_id: newUser.id,
              kategori_id: kategori_id,
            },
          });
        }
      }
    }

    // I. Kirim response sukses
    const roleInfo = await prisma.roles.findUnique({ where: { id: newUser.id_role } });
    const data = {
      user_id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: roleInfo?.name || 'client',
      foto_profil: newUser.foto_profil,
      is_verified: newUser.is_verified,
    };
    sendResponse(res, 201, 'success', 'Registrasi berhasil', data);

  } catch (error) {
    console.error('Register error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 2. LOGIN
exports.login = async (req, res) => {
  try {
    // AMBIL 'username' DAN 'email' DARI BODY
    const { username, email, password } = req.body;

    // TENTUKAN PENGENAL LOGIN (BISA USERNAME ATAU EMAIL)
    const loginIdentifier = username || email;

    // VALIDASI MENGGUNAKAN PENGENAL BARU
    if (!loginIdentifier || !password) {
      return sendResponse(res, 400, 'error', 'Username/Email dan Password wajib diisi');
    }

    // CARI USER MENGGUNAKAN PENGENAL BARU DI KEDUA KOLOM
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { username: loginIdentifier },
          { email: loginIdentifier }
        ],
      },
      include: {
        roles: true
      }
    });

    if (!user) {
      return sendResponse(res, 401, 'error', 'Username/Email tidak ditemukan');
    }

    // Cek password
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordCorrect) {
      return sendResponse(res, 401, 'error', 'Password salah');
    }

    // PENTING: Cek verifikasi untuk TUKANG
    if (user.roles.name === 'tukang' && !user.is_verified) {
      return sendResponse(res, 403, 'error', 'Akun Tukang Anda belum diverifikasi oleh Admin');
    }
    
    // Cek status aktif
    if (!user.is_active) {
       return sendResponse(res, 403, 'error', 'Akun Anda tidak aktif');
    }

    // Generate token
    const token = generateToken(user.id, user.roles.name);

    // Hapus password dari data user
    delete user.password_hash;

    // Response sesuai dokumen
    const data = {
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nama_lengkap: user.nama_lengkap,
        foto_profil: user.foto_profil,
        poin: user.poin,
        is_active: user.is_active,
        is_verified: user.is_verified,
        id_role: user.id_role
      },
      role: {
        id: user.roles.id,
        name: user.roles.name,
        description: user.roles.description
      }
    };
    
    sendResponse(res, 200, 'success', 'Login berhasil', data);

  } catch (error) {
    console.error('Login error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 3. LOGOUT
exports.logout = async (req, res) => {
  try {
    // Ambil token dari middleware
    const { token } = req;

    // Hash token untuk disimpan
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Decode token untuk mendapatkan expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const expiresAt = new Date(decoded.exp * 1000);
    
    // Masukkan token ke blacklist
    await prisma.jwt_blacklist.create({
      data: {
        token_hash: tokenHash,
        user_id: req.user.id,
        expires_at: expiresAt,
      },
    });

    sendResponse(res, 200, 'success', 'Logout berhasil');
  } catch (error) {
    console.error('Logout error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 4. GET CURRENT USER (ME)
exports.getCurrentUser = async (req, res) => {
  // Data user sudah diambil oleh middleware 'verifyToken' dan ada di 'req.user'
  const user = req.user;

  // Hapus password
  delete user.password_hash;
  
  // Format data sesuai dokumen (termasuk role)
  const data = {
    ...user,
    role: user.roles
  };

  sendResponse(res, 200, 'success', 'Data user berhasil diambil', data);
};

// 5. CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { old_password, new_password, confirm_password } = req.body;
    const userId = req.user.id;

    // Validasi
    if (new_password !== confirm_password) {
      return sendResponse(res, 400, 'error', 'Password baru dan konfirmasi tidak cocok');
    }

    // Cek password lama
    const user = await prisma.users.findUnique({ where: { id: userId } });
    const isPasswordCorrect = await bcrypt.compare(old_password, user.password_hash);

    if (!isPasswordCorrect) {
      return sendResponse(res, 401, 'error', 'Password lama salah');
    }

    // Hash password baru
    const hashedNewPassword = await bcrypt.hash(new_password, 12);

    // Update password di DB
    await prisma.users.update({
      where: { id: userId },
      data: { password_hash: hashedNewPassword },
    });

    sendResponse(res, 200, 'success', 'Password berhasil diubah');
  } catch (error) {
    console.error('Change password error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};