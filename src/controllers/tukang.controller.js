// File: src/controllers/tukang.controller.js
const prisma = require('../utils/prisma.util');
const { sendResponse } = require('../utils/response.util');
const fs = require('fs');
const path = require('path');

// Fungsi helper untuk menghapus file lama
const deleteOldFile = (dbPath) => {
  if (!dbPath) return;
  const fsPath = path.join(__dirname, '../../writable', dbPath.replace('uploads/', ''));
  if (fs.existsSync(fsPath)) {
    fs.unlink(fsPath, (err) => {
      if (err) console.error("Gagal hapus file lama:", fsPath, err);
    });
  }
};

// 20. GET TUKANG PROFILE
// File: src/controllers/tukang.controller.js

// ... (fungsi helper deleteOldFile ada di atas) ...

// 20. GET TUKANG PROFILE
exports.getTukangProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    // 1. Query Anda sudah benar
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        profil_tukang: true,
        kategori_tukang: {
          include: {
            kategori: true,
          },
        },
      },
    });

    // 2. Cek jika user atau profil tukang tidak ada
    if (!user || !user.profil_tukang) {
      return sendResponse(res, 404, 'error', 'Profil tukang tidak ditemukan');
    }

    // 3. Hapus data sensitif
    delete user.password_hash;
    
    // --- INI PERBAIKANNYA ---
    
    // 4. Ambil data kategori yang bersih
    const kategoriList = user.kategori_tukang.map(kt => kt.kategori);
    
    // 5. Hapus field 'kategori_tukang' yang berantakan dari object user
    delete user.kategori_tukang;

    // 6. Buat object data final yang bersih
    const data = {
      ...user,
      profil_tukang: user.profil_tukang,
      kategori: kategoriList, // Tambahkan field 'kategori' yang bersih
    };
    
    // 7. Kirim response
    sendResponse(res, 200, 'success', 'Data profil tukang berhasil diambil', data);

  } catch (error) {
    console.error('getTukangProfile error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// ... (sisa fungsi controller Anda) ...
// 21. UPDATE TUKANG PROFILE
exports.updateTukangProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;
    
    // 1. Data untuk tabel User
    const userData = {};
    if (data.nama_lengkap) userData.nama_lengkap = data.nama_lengkap;
    if (data.no_telp) userData.no_telp = data.no_telp;
    if (data.alamat) userData.alamat = data.alamat;
    if (data.kota) userData.kota = data.kota;
    if (data.provinsi) userData.provinsi = data.provinsi;
    if (data.kode_pos) userData.kode_pos = data.kode_pos;

    // 2. Data untuk tabel TukangProfile
    const profilData = {};
    if (data.pengalaman_tahun) profilData.pengalaman_tahun = parseInt(data.pengalaman_tahun);
    if (data.tarif_per_jam) profilData.tarif_per_jam = parseFloat(data.tarif_per_jam);
    if (data.radius_layanan_km) profilData.radius_layanan_km = parseInt(data.radius_layanan_km);
    if (data.bio) profilData.bio = data.bio;
    if (data.keahlian) profilData.keahlian = Array.isArray(data.keahlian) ? data.keahlian : [data.keahlian];
    if (data.nama_bank) profilData.nama_bank = data.nama_bank;
    if (data.nomor_rekening) profilData.nomor_rekening = data.nomor_rekening;
    if (data.nama_pemilik_rekening) profilData.nama_pemilik_rekening = data.nama_pemilik_rekening;

    // 3. Handle Kategori (jika ada)
    if (data.kategori_ids) {
       const ids = Array.isArray(data.kategori_ids) ? data.kategori_ids : data.kategori_ids.split(',').map(id => parseInt(id.trim()));
       // Hapus kategori lama
       await prisma.kategori_tukang.deleteMany({
         where: { tukang_id: userId }
       });
       // Tambah kategori baru
       for (const kategori_id of ids) {
         await prisma.kategori_tukang.create({
           data: {
             tukang_id: userId,
             kategori_id: kategori_id,
           },
         });
       }
    }
    
    // 4. Handle File Upload
    if (req.file) {
      const fotoProfilPath = req.file.path.replace(/\\/g, '/').replace('writable/', '');
      userData.foto_profil = fotoProfilPath;
      deleteOldFile(req.user.foto_profil);
    }

    // 5. Jalankan Update
    await prisma.users.update({
      where: { id: userId },
      data: userData,
    });
    
    if (Object.keys(profilData).length > 0) {
      await prisma.profil_tukang.update({
        where: { user_id: userId },
        data: profilData,
      });
    }

    sendResponse(res, 200, 'success', 'Profil berhasil diperbarui');
  } catch (error) {
    console.error('updateTukangProfile error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 22. GET CATEGORIES (untuk Tukang)
exports.getTukangCategories = async (req, res) => {
  try {
    const categories = await prisma.kategori.findMany({
      where: { is_active: true },
      include: {
        _count: {
          select: { kategori_tukang: true },
        },
      },
    });

    const formattedCategories = categories.map(cat => ({
      id: cat.id,
      nama: cat.nama,
      deskripsi: cat.deskripsi,
      jumlah_tukang: cat._count.kategori_tukang,
    }));

    sendResponse(res, 200, 'success', 'Kategori berhasil diambil', formattedCategories);
  } catch (error) {
    console.error('getTukangCategories error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 23. UPDATE AVAILABILITY
exports.updateAvailability = async (req, res) => {
  try {
    const { status_ketersediaan } = req.body;
    const userId = req.user.id;

    if (!['tersedia', 'tidak_tersedia'].includes(status_ketersediaan)) {
      return sendResponse(res, 400, 'error', 'Status tidak valid. Gunakan tersedia atau tidak_tersedia');
    }

    await prisma.profil_tukang.update({
      where: { user_id: userId },
      data: { status_ketersediaan: status_ketersediaan },
    });

    sendResponse(res, 200, 'success', 'Status ketersediaan berhasil diupdate');
  } catch (error) {
    console.error('updateAvailability error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 24. GET ORDERS
exports.getOrders = async (req, res) => {
  try {
    const { status, metode_pembayaran, limit, offset } = req.query;
    const where = {
      tukang_id: req.user.id,
    };

    if (status) where.status = status;
    if (metode_pembayaran) where.metode_pembayaran = metode_pembayaran;

    const orders = await prisma.transaksi.findMany({
      where,
      include: {
        users_transaksi_client_idTousers: { select: { nama_lengkap: true, foto_profil: true, no_telp: true } },
        kategori: { select: { nama: true } },
      },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit) || 10,
      skip: parseInt(offset) || 0,
    });
    
    // Format data agar sesuai dokumen
    const formatted = orders.map(t => ({
      ...t,
      nama_client: t.users_transaksi_client_idTousers.nama_lengkap,
      foto_client: t.users_transaksi_client_idTousers.foto_profil,
      no_telp_client: t.users_transaksi_client_idTousers.no_telp,
      nama_kategori: t.kategori?.nama,
    }));

    sendResponse(res, 200, 'success', 'Data pesanan berhasil diambil', formatted);
  } catch (error) {
    console.error('getOrders error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 25. GET ORDER DETAIL
exports.getOrderDetail = async (req, res) => {
  try {
    const { transaksi_id } = req.params;
    const order = await prisma.transaksi.findFirst({
      where: {
        id: parseInt(transaksi_id),
        tukang_id: req.user.id,
      },
      include: {
        users_transaksi_client_idTousers: { select: { nama_lengkap: true, foto_profil: true, no_telp: true, alamat: true } },
        kategori: { select: { nama: true } },
        rating: true,
      },
    });

    if (!order) {
      return sendResponse(res, 404, 'error', 'Pesanan tidak ditemukan');
    }

    const data = {
      ...order,
      nama_client: order.users_transaksi_client_idTousers.nama_lengkap,
      foto_client: order.users_transaksi_client_idTousers.foto_profil,
      no_telp_client: order.users_transaksi_client_idTousers.no_telp,
      nama_kategori: order.kategori?.nama,
    };

    sendResponse(res, 200, 'success', 'Detail pesanan berhasil diambil', data);
  } catch (error) {
    console.error('getOrderDetail error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// Helper untuk update status dengan cek kepemilikan
const updateOrderStatus = async (transaksiId, tukangId, currentStatus, newStatus, data = {}) => {
  const result = await prisma.transaksi.updateMany({
    where: {
      id: parseInt(transaksiId),
      tukang_id: tukangId,
      status: currentStatus,
    },
    data: {
      status: newStatus,
      ...data
    },
  });
  return result.count > 0;
};

// 26. ACCEPT ORDER
exports.acceptOrder = async (req, res) => {
  try {
    const { transaksi_id } = req.params;
    const updated = await updateOrderStatus(transaksi_id, req.user.id, 'pending', 'diterima', {
      waktu_diterima: new Date()
    });

    if (updated) {
      sendResponse(res, 200, 'success', 'Pesanan berhasil diterima');
    } else {
      sendResponse(res, 400, 'error', 'Pesanan tidak ditemukan atau status tidak valid');
    }
  } catch (error) {
    console.error('acceptOrder error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 27. REJECT ORDER
exports.rejectOrder = async (req, res) => {
  const { transaksi_id } = req.params;
  const { alasan_penolakan } = req.body;
  const tukangId = req.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Dapatkan transaksi
      const transaction = await tx.transaksi.findFirst({
        where: { id: parseInt(transaksi_id), tukang_id: tukangId },
      });

      if (!transaction) {
        throw new Error('Transaksi tidak ditemukan');
      }

      // 2. Hanya bisa reject jika pending
      if (transaction.status !== 'pending') {
        throw new Error('Hanya pesanan pending yang bisa ditolak');
      }

      // 3. Update status transaksi
      await tx.transaksi.update({
        where: { id: transaction.id },
        data: {
          status: 'ditolak',
          alasan_penolakan: alasan_penolakan || 'Ditolak oleh tukang',
          waktu_ditolak: new Date(),
        },
      });

      // 4. Kembalikan Poin jika terpotong
      if (transaction.poin_terpotong) {
        await tx.users.update({
          where: { id: transaction.client_id },
          data: { poin: { increment: parseFloat(transaction.total_biaya) } },
        });
      }
      return true;
    });

    sendResponse(res, 200, 'success', 'Pesanan berhasil ditolak');

  } catch (error) {
    console.error('rejectOrder error:', error);
    if (error.message.includes('ditemukan')) {
      return sendResponse(res, 404, 'error', error.message);
    }
    if (error.message.includes('Hanya pesanan')) {
      return sendResponse(res, 400, 'error', error.message);
    }
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 28. START WORK
exports.startWork = async (req, res) => {
  try {
    const { transaksi_id } = req.params;
    const updated = await updateOrderStatus(transaksi_id, req.user.id, 'diterima', 'dalam_proses', {
      waktu_mulai: new Date()
    });

    if (updated) {
      sendResponse(res, 200, 'success', 'Pekerjaan berhasil dimulai');
    } else {
      sendResponse(res, 400, 'error', 'Pesanan tidak ditemukan atau status tidak valid');
    }
  } catch (error) {
    console.error('startWork error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 29. COMPLETE WORK
exports.completeWork = async (req, res) => {
  const { transaksi_id } = req.params;
  const { catatan_tukang } = req.body;
  const tukangId = req.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Dapatkan transaksi
      const transaction = await tx.transaksi.findFirst({
        where: { id: parseInt(transaksi_id), tukang_id: tukangId },
      });

      if (!transaction) {
        throw new Error('Transaksi tidak ditemukan');
      }

      // 2. Hanya bisa complete jika dalam_proses
      if (transaction.status !== 'dalam_proses') {
        throw new Error('Hanya pesanan dalam proses yang bisa diselesaikan');
      }

      // 3. Update status transaksi
      await tx.transaksi.update({
        where: { id: transaction.id },
        data: {
          status: 'selesai',
          catatan_tukang: catatan_tukang,
          waktu_selesai: new Date()
        },
      });

      // 4. Transfer Poin ke Tukang jika metode poin
      let poinDiterima = 0;
      if (transaction.metode_pembayaran === 'poin') {
        poinDiterima = parseFloat(transaction.total_biaya);
        await tx.users.update({
          where: { id: tukangId },
          data: { poin: { increment: poinDiterima } },
        });
      }
      
      return { poinDiterima };
    });

    sendResponse(res, 200, 'success', 'Pekerjaan berhasil diselesaikan', result);

  } catch (error) {
    console.error('completeWork error:', error);
    if (error.message.includes('ditemukan')) {
      return sendResponse(res, 404, 'error', error.message);
    }
    if (error.message.includes('Hanya pesanan')) {
      return sendResponse(res, 400, 'error', error.message);
    }
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 30. CONFIRM TUNAI PAYMENT
exports.confirmTunaiPayment = async (req, res) => {
  try {
    const { transaksi_id } = req.params;
    const updated = await prisma.transaksi.updateMany({
      where: {
        id: parseInt(transaksi_id),
        tukang_id: req.user.id,
        metode_pembayaran: 'tunai',
        status: 'selesai',
      },
      data: {
        sudah_dibayar_tunai: true,
        waktu_konfirmasi_pembayaran_tunai: new Date()
      },
    });

    if (updated.count > 0) {
      sendResponse(res, 200, 'success', 'Pembayaran tunai berhasil dikonfirmasi');
    } else {
      sendResponse(res, 400, 'error', 'Pesanan tidak ditemukan atau status tidak valid');
    }
  } catch (error) {
    console.error('confirmTunaiPayment error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 31. GET RATINGS
exports.getRatings = async (req, res) => {
  try {
    const tukangId = req.user.id;
    
    const ratings = await prisma.rating.findMany({
      where: { tukang_id: tukangId },
      include: {
        users_rating_client_idTousers: { select: { nama_lengkap: true, foto_profil: true } }
      },
      orderBy: { created_at: 'desc' }
    });
    
    // Ambil statistik
    const starCounts = await prisma.rating.groupBy({
       by: ['rating'],
       where: { tukang_id: tukangId },
       _count: { rating: true },
    });
    const aggStats = await prisma.rating.aggregate({
        where: { tukang_id: tukangId },
       _count: { rating: true },
       _avg: { rating: true }
    });

    const statistik = {
      total_rating: aggStats._count.rating || 0,
      rata_rata: aggStats._avg.rating || 0,
      bintang_5: starCounts.find(s => s.rating === 5)?._count.rating || 0,
      bintang_4: starCounts.find(s => s.rating === 4)?._count.rating || 0,
      bintang_3: starCounts.find(s => s.rating === 3)?._count.rating || 0,
      bintang_2: starCounts.find(s => s.rating === 2)?._count.rating || 0,
      bintang_1: starCounts.find(s => s.rating === 1)?._count.rating || 0,
    };

    sendResponse(res, 200, 'success', 'Rating berhasil diambil', { ratings, statistik });
  } catch (error) {
    console.error('getRatings error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 32. REQUEST WITHDRAWAL
exports.requestWithdrawal = async (req, res) => {
  const { jumlah, nama_bank, nomor_rekening, nama_pemilik_rekening } = req.body;
  const tukangId = req.user.id;
  
  const jumlahRequest = parseFloat(jumlah);

  // Validasi
  if (!jumlahRequest || jumlahRequest < 50000) {
    return sendResponse(res, 400, 'error', 'Minimum penarikan adalah 50,000');
  }
  if (!nama_bank || !nomor_rekening || !nama_pemilik_rekening) {
     return sendResponse(res, 400, 'error', 'Informasi bank tidak lengkap');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cek saldo tukang
      const tukang = await tx.users.findUnique({
        where: { id: tukangId },
        select: { poin: true }
      });
      
      if (tukang.poin < jumlahRequest) {
        throw new Error('Saldo poin tidak mencukupi');
      }
      
      // 2. Hitung fee (2%, max 5000)
      let biaya_admin = jumlahRequest * 0.02;
      if (biaya_admin > 5000) biaya_admin = 5000;
      
      const jumlah_bersih = jumlahRequest - biaya_admin;
      
      // 3. Potong saldo tukang
      await tx.users.update({
        where: { id: tukangId },
        data: { poin: { decrement: jumlahRequest } }
      });
      
      // 4. Buat record withdrawal
      const withdrawal = await tx.penarikan.create({
        data: {
          tukang_id: tukangId,
          jumlah: jumlahRequest,
          biaya_admin: biaya_admin,
          jumlah_bersih: jumlah_bersih,
          nama_bank: nama_bank,
          nomor_rekening: nomor_rekening,
          nama_pemilik_rekening: nama_pemilik_rekening,
          status: 'pending'
        }
      });
      
      return withdrawal;
    });
    
    sendResponse(res, 201, 'success', 'Request penarikan berhasil dibuat', {
        withdrawal_id: result.id,
        jumlah: result.jumlah,
        biaya_admin: result.biaya_admin,
        jumlah_bersih: result.jumlah_bersih,
        status: result.status
    });
    
  } catch (error)
 {
    console.error('requestWithdrawal error:', error);
    if (error.message.includes('Saldo poin')) {
      return sendResponse(res, 400, 'error', error.message);
    }
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 33. GET WITHDRAWAL HISTORY
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const where = {
      tukang_id: req.user.id,
    };

    if (status) where.status = status;

    const withdrawals = await prisma.penarikan.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(limit) || 10,
      skip: parseInt(offset) || 0,
    });

    sendResponse(res, 200, 'success', 'Riwayat penarikan berhasil diambil', withdrawals);
  } catch (error) {
    console.error('getWithdrawalHistory error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 34. GET TUKANG STATISTICS
exports.getTukangStatistics = async (req, res) => {
   try {
    const tukangId = req.user.id;

    // 1. Ambil data user & profil
    const profil = await prisma.profil_tukang.findUnique({
      where: { user_id: tukangId },
      select: { total_pekerjaan_selesai: true, rata_rata_rating: true, total_rating: true }
    });

    // 2. Statistik Transaksi
    const trxStats = await prisma.transaksi.groupBy({
      by: ['status'],
      where: { tukang_id: tukangId },
      _count: { status: true },
    });
    const totalPendapatan = await prisma.transaksi.aggregate({
        where: { tukang_id: tukangId, status: 'selesai', metode_pembayaran: 'poin' },
        _sum: { total_biaya: true },
    });
    
    // 3. Statistik Penarikan
    const penarikanStats = await prisma.penarikan.groupBy({
      by: ['status'],
      where: { tukang_id: tukangId },
      _count: { status: true },
    });
     const totalDitarik = await prisma.penarikan.aggregate({
        where: { tukang_id: tukangId, status: 'selesai' },
        _sum: { jumlah: true },
    });

    // Format data
    const formatStats = (stats) => stats.reduce((acc, cur) => {
        acc[cur.status.toLowerCase()] = cur._count.status;
        return acc;
    }, {});
    const trxData = formatStats(trxStats);
    const penarikanData = formatStats(penarikanStats);

    const stats = {
      saldo_poin: req.user.poin,
      total_pekerjaan_selesai: profil?.total_pekerjaan_selesai || 0,
      rata_rata_rating: profil?.rata_rata_rating || 0,
      total_rating: profil?.total_rating || 0,
      transaksi: {
        total: trxStats.reduce((sum, s) => sum + s._count.status, 0),
        pending: trxData.pending || 0,
        diterima: trxData.diterima || 0,
        dalam_proses: trxData.dalam_proses || 0,
        selesai: trxData.selesai || 0,
        dibatalkan: trxData.dibatalkan || 0,
        ditolak: trxData.ditolak || 0,
        total_pendapatan: totalPendapatan._sum.total_biaya || 0, // Pendapatan dari POIN
      },
      penarikan: {
        total: penarikanStats.reduce((sum, s) => sum + s._count.status, 0),
        pending: penarikanData.pending || 0,
        diproses: penarikanData.diproses || 0,
        selesai: penarikanData.selesai || 0,
        ditolak: penarikanData.ditolak || 0,
        total_ditarik: totalDitarik._sum.jumlah || 0,
      },
    };

    sendResponse(res, 200, 'success', 'Statistik tukang berhasil diambil', stats);
  } catch (error) {
    console.error('getTukangStatistics error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};