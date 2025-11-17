// File: src/controllers/client.controller.js
const prisma = require('../utils/prisma.util');
const { sendResponse } = require('../utils/response.util');
const fs = require('fs');
const path = require('path');

// Fungsi helper untuk menghapus file lama
const deleteOldFile = (dbPath) => {
  if (!dbPath) return;
  // dbPath = 'uploads/profiles/file.jpg'
  // fsPath = 'writable/profiles/file.jpg'
  const fsPath = path.join(__dirname, '../../writable', dbPath.replace('uploads/', ''));
  if (fs.existsSync(fsPath)) {
    fs.unlink(fsPath, (err) => {
      if (err) console.error("Gagal hapus file lama:", fsPath, err);
    });
  }
};

// 6. GET CLIENT PROFILE
exports.getClientProfile = async (req, res) => {
  try {
    // Data user sudah ada di req.user dari middleware verifyToken
    // Kita hanya perlu menghapus password sebelum mengirim
    const user = req.user;
    delete user.password;
    delete user.id_role; // Hapus jika ada, ganti dengan objek 'role'

    const data = {
      ...user,
      role: {
        id: user.role,
        name: user.role.toLowerCase(),
        description: user.role
      }
    };

    sendResponse(res, 200, 'success', 'Data profil berhasil diambil', data);
  } catch (error) {
    console.error('getClientProfile error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 7. UPDATE CLIENT PROFILE
exports.updateClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body;
    const updateData = {};

    // 1. Siapkan data teks
    if (data.nama_lengkap) updateData.nama_lengkap = data.nama_lengkap;
    if (data.no_telp) updateData.no_telp = data.no_telp;
    if (data.alamat) updateData.alamat = data.alamat;
    if (data.kota) updateData.kota = data.kota;
    if (data.provinsi) updateData.provinsi = data.provinsi;
    if (data.kode_pos) updateData.kode_pos = data.kode_pos;

    // 2. Cek jika ada file upload (dari middleware uploadProfile)
    if (req.file) {
      // Path sudah di-format oleh auth.controller.js: 'uploads/profiles/file.jpg'
      const fotoProfilPath = req.file.path.replace(/\\/g, '/').replace('writable/', '');
      updateData.foto_profil = fotoProfilPath;

      // 3. Hapus foto profil lama
      deleteOldFile(req.user.foto_profil);
    }

    // 4. Update database
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    sendResponse(res, 200, 'success', 'Profil berhasil diperbarui');
  } catch (error) {
    console.error('updateClientProfile error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 8. GET CATEGORIES
exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.kategori.findMany({
      where: { is_active: true },
      include: {
        _count: {
          select: { kategori_tukang: true },
        },
      },
    });

    // Format data agar mirip dengan CI
    const formattedCategories = categories.map(cat => ({
      id: cat.id,
      nama: cat.nama,
      deskripsi: cat.deskripsi,
      jumlah_tukang: cat._count.kategori_tukang,
    }));

    sendResponse(res, 200, 'success', 'Data kategori berhasil diambil', formattedCategories);
  } catch (error) {
    console.error('getCategories error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 9. BROWSE TUKANG
exports.browseTukang = async (req, res) => {
  try {
    const {
      kategori_id, kota, status, min_rating,
      max_tarif, order_by, order_dir, limit, offset
    } = req.query;

    // Cari role tukang
    const tukangRole = await prisma.roles.findFirst({ where: { name: 'tukang' } });
    
    const where = {
      id_role: tukangRole?.id || 3,
      is_verified: true,
      is_active: true,
      profil_tukang: {
        status_ketersediaan: status || 'tersedia',
      },
    };

    if (kota) where.kota = kota;
    if (kategori_id) {
      where.kategori_tukang = {
        some: { kategori_id: parseInt(kategori_id) }
      };
    }
    if (min_rating) where.profil_tukang.rata_rata_rating = { gte: parseFloat(min_rating) };
    if (max_tarif) where.profil_tukang.tarif_per_jam = { lte: parseFloat(max_tarif) };

    const orderByClause = {};
    const validOrderBy = ['tarif_per_jam', 'pengalaman_tahun', 'rata_rata_rating'];
    const orderByField = validOrderBy.includes(order_by) ? order_by : 'rata_rata_rating';
    
    if (['tarif_per_jam', 'pengalaman_tahun', 'rata_rata_rating'].includes(orderByField)) {
        orderByClause.profil_tukang = { [orderByField]: order_dir || 'desc' };
    }

    const tukangs = await prisma.users.findMany({
      where,
      include: {
        profil_tukang: true,
        kategori_tukang: {
          include: {
            kategori: true,
          },
        },
      },
      orderBy: orderByClause,
      take: parseInt(limit) || 10,
      skip: parseInt(offset) || 0,
    });

    // Format data agar sesuai dokumen
    const formattedTukangs = tukangs.map(t => ({
      id: t.profil_tukang?.id,
      user_id: t.id,
      nama_lengkap: t.nama_lengkap,
      foto_profil: t.foto_profil,
      no_telp: t.no_telp,
      kota: t.kota,
      provinsi: t.provinsi,
      ...t.profil_tukang,
      kategori: t.kategori_tukang.map(kt => kt.kategori)
    }));

    sendResponse(res, 200, 'success', 'Data tukang berhasil diambil', formattedTukangs);
  } catch (error) {
    console.error('browseTukang error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 10. GET TUKANG DETAIL
exports.getTukangDetail = async (req, res) => {
  try {
    const { tukang_id } = req.params; // Ini adalah user_id tukang

    const tukangRole = await prisma.roles.findFirst({ where: { name: 'tukang' } });
    const user = await prisma.users.findFirst({
      where: { 
        id: parseInt(tukang_id),
        id_role: tukangRole?.id || 3
      },
      include: {
        profil_tukang: true,
        kategori_tukang: {
          include: {
            kategori: true,
          },
        },
      },
    });

    if (!user || !user.profil_tukang) {
      return sendResponse(res, 404, 'error', 'Tukang tidak ditemukan');
    }

    const tukangUserId = user.id;

    // Ambil ratings & stats
    const ratings = await prisma.rating.findMany({
      where: { tukang_id: tukangUserId },
      include: {
        users_rating_client_idTousers: { select: { nama_lengkap: true, foto_profil: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    const ratingStatsRaw = await prisma.rating.aggregate({
      where: { tukang_id: tukangUserId },
      _count: { rating: true },
      _avg: { rating: true },
    });
    
    // Ambil hitungan per bintang
    const starCounts = await prisma.rating.groupBy({
       by: ['rating'],
       where: { tukang_id: tukangUserId },
       _count: { rating: true },
    });

    const rating_stats = {
      total: ratingStatsRaw._count.rating || 0,
      rata_rata: ratingStatsRaw._avg.rating || 0,
      bintang_5: starCounts.find(s => s.rating === 5)?._count.rating || 0,
      bintang_4: starCounts.find(s => s.rating === 4)?._count.rating || 0,
      bintang_3: starCounts.find(s => s.rating === 3)?._count.rating || 0,
      bintang_2: starCounts.find(s => s.rating === 2)?._count.rating || 0,
      bintang_1: starCounts.find(s => s.rating === 1)?._count.rating || 0,
    };

    // Format data gabungan
    const data = {
      ...user,
      profil_tukang: user.profil_tukang,
      kategori: user.kategori_tukang.map(kt => kt.kategori),
      ratings: ratings.map(r => ({
        ...r,
        nama_client: r.users_rating_client_idTousers.nama_lengkap,
        foto_client: r.users_rating_client_idTousers.foto_profil,
      })),
      rating_stats,
    };
    delete data.password_hash;

    sendResponse(res, 200, 'success', 'Detail tukang berhasil diambil', data);
  } catch (error) {
    console.error('getTukangDetail error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 11. SEARCH TUKANG
exports.searchTukang = async (req, res) => {
   try {
    const { keyword, kategori_id, kota, limit, offset } = req.query;

    if (!keyword) {
       return sendResponse(res, 400, 'error', 'Keyword wajib diisi');
    }

    const tukangRole = await prisma.roles.findFirst({ where: { name: 'tukang' } });
    const where = {
      id_role: tukangRole?.id || 3,
      is_verified: true,
      is_active: true,
      OR: [
        { nama_lengkap: { contains: keyword, mode: 'insensitive' } },
        { profil_tukang: { bio: { contains: keyword, mode: 'insensitive' } } },
      ],
    };

    if (kota) where.kota = kota;
    if (kategori_id) {
      where.kategori_tukang = {
        some: { kategori_id: parseInt(kategori_id) }
      };
    }
    
    const tukangs = await prisma.users.findMany({
      where,
      include: {
        profil_tukang: true,
        kategori_tukang: {
          include: {
            kategori: true,
          },
        },
      },
      take: parseInt(limit) || 10,
      skip: parseInt(offset) || 0,
    });
    
    // Format data
     const formattedTukangs = tukangs.map(t => ({
      id: t.profil_tukang?.id,
      user_id: t.id,
      nama_lengkap: t.nama_lengkap,
      foto_profil: t.foto_profil,
      kota: t.kota,
      ...t.profil_tukang,
      kategori: t.kategori_tukang.map(kt => kt.kategori)
    }));

    sendResponse(res, 200, 'success', 'Hasil pencarian tukang', formattedTukangs);
  } catch (error) {
    console.error('searchTukang error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 12. CREATE BOOKING
exports.createBooking = async (req, res) => {
  const data = req.body;
  const clientId = req.user.id;

  // Validasi manual (gantilah dengan express-validator jika Anda mau)
  if (!data.tukang_id || !data.kategori_id || !data.judul_layanan || !data.lokasi_kerja || !data.tanggal_jadwal || !data.waktu_jadwal || !data.harga_dasar || !data.metode_pembayaran) {
    return sendResponse(res, 400, 'error', 'Data wajib tidak lengkap');
  }

  const total_biaya = parseFloat(data.harga_dasar) + (parseFloat(data.biaya_tambahan) || 0);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cek Saldo Klien jika bayar pakai POIN
      if (data.metode_pembayaran === 'poin') {
        const client = await tx.users.findUnique({
          where: { id: clientId },
          select: { poin: true },
        });

        if (client.poin < total_biaya) {
          throw new Error('Saldo poin tidak mencukupi');
        }

        // 2. Potong Poin Klien
        await tx.users.update({
          where: { id: clientId },
          data: { poin: { decrement: total_biaya } },
        });
      }

      // 3. Buat Transaksi
      const newTransaksi = await tx.transaksi.create({
        data: {
          client_id: clientId,
          tukang_id: parseInt(data.tukang_id),
          kategori_id: parseInt(data.kategori_id),
          nomor_pesanan: `TRX-${Date.now()}`,
          judul_layanan: data.judul_layanan,
          deskripsi_layanan: data.deskripsi_layanan,
          lokasi_kerja: data.lokasi_kerja,
          tanggal_jadwal: new Date(data.tanggal_jadwal),
          waktu_jadwal: new Date(`1970-01-01T${data.waktu_jadwal}`),
          estimasi_durasi_jam: data.estimasi_durasi_jam ? parseInt(data.estimasi_durasi_jam) : 1,
          harga_dasar: parseFloat(data.harga_dasar),
          biaya_tambahan: parseFloat(data.biaya_tambahan) || 0,
          total_biaya: total_biaya,
          metode_pembayaran: data.metode_pembayaran,
          status: 'pending',
          catatan_client: data.catatan_client,
          poin_terpotong: data.metode_pembayaran === 'poin',
        },
      });

      return newTransaksi;
    });

    // Kirim response sukses
    sendResponse(res, 201, 'success', 'Booking berhasil dibuat', {
      transaksi_id: result.id,
      nomor_pesanan: result.nomor_pesanan,
      status: result.status,
      total_biaya: result.total_biaya,
      metode_pembayaran: result.metode_pembayaran,
      poin_terpotong: result.poin_terpotong,
    });

  } catch (error) {
    console.error('createBooking error:', error);
    if (error.message === 'Saldo poin tidak mencukupi') {
      return sendResponse(res, 400, 'error', error.message);
    }
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 13. GET TRANSACTIONS
exports.getTransactions = async (req, res) => {
  try {
    const { status, metode_pembayaran, limit, offset } = req.query;
    const where = {
      client_id: req.user.id,
    };

    if (status) where.status = status;
    if (metode_pembayaran) where.metode_pembayaran = metode_pembayaran;

    const transactions = await prisma.transaksi.findMany({
      where,
      include: {
        users_transaksi_tukang_idTousers: { select: { nama_lengkap: true, foto_profil: true, no_telp: true } },
        kategori: { select: { nama: true } },
      },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit) || 10,
      skip: parseInt(offset) || 0,
    });
    
    // Format data agar sesuai dokumen
    const formatted = transactions.map(t => ({
      ...t,
      nama_tukang: t.users_transaksi_tukang_idTousers.nama_lengkap,
      foto_tukang: t.users_transaksi_tukang_idTousers.foto_profil,
      no_telp_tukang: t.users_transaksi_tukang_idTousers.no_telp,
      nama_kategori: t.kategori?.nama,
    }));

    sendResponse(res, 200, 'success', 'Data transaksi berhasil diambil', formatted);
  } catch (error) {
    console.error('getTransactions error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 14. GET TRANSACTION DETAIL
exports.getTransactionDetail = async (req, res) => {
  try {
    const { transaksi_id } = req.params;
    const transaction = await prisma.transaksi.findFirst({
      where: {
        id: parseInt(transaksi_id),
        client_id: req.user.id,
      },
      include: {
        users_transaksi_tukang_idTousers: { select: { nama_lengkap: true, foto_profil: true, no_telp: true } },
        kategori: { select: { nama: true } },
        rating: true,
      },
    });

    if (!transaction) {
      return sendResponse(res, 404, 'error', 'Transaksi tidak ditemukan');
    }

    // Format data
    const data = {
      ...transaction,
      nama_tukang: transaction.users_transaksi_tukang_idTousers.nama_lengkap,
      foto_tukang: transaction.users_transaksi_tukang_idTousers.foto_profil,
      no_telp_tukang: transaction.users_transaksi_tukang_idTousers.no_telp,
      nama_kategori: transaction.kategori?.nama,
    };

    sendResponse(res, 200, 'success', 'Detail transaksi berhasil diambil', data);
  } catch (error) {
    console.error('getTransactionDetail error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 15. CANCEL TRANSACTION
exports.cancelTransaction = async (req, res) => {
  const { transaksi_id } = req.params;
  const { alasan_pembatalan } = req.body;
  const clientId = req.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Dapatkan transaksi dan pastikan milik user
      const transaction = await tx.transaksi.findFirst({
        where: { id: parseInt(transaksi_id), client_id: clientId },
      });

      if (!transaction) {
        throw new Error('Transaksi tidak ditemukan');
      }

      // 2. Hanya bisa cancel jika pending atau diterima
      if (!['pending', 'diterima'].includes(transaction.status)) {
        throw new Error('Transaksi tidak dapat dibatalkan');
      }

      // 3. Update status transaksi
      await tx.transaksi.update({
        where: { id: transaction.id },
        data: {
          status: 'dibatalkan',
          alasan_pembatalan: alasan_pembatalan || 'Dibatalkan oleh klien',
          dibatalkan_oleh: clientId,
          waktu_dibatalkan: new Date(),
        },
      });

      // 4. Kembalikan Poin jika terpotong
      let poinDikembalikan = 0;
      if (transaction.poin_terpotong) {
        poinDikembalikan = parseFloat(transaction.total_biaya);
        await tx.users.update({
          where: { id: clientId },
          data: { poin: { increment: poinDikembalikan } },
        });
      }

      return { poinDikembalikan };
    });

    sendResponse(res, 200, 'success', 'Transaksi berhasil dibatalkan', result);

  } catch (error) {
    console.error('cancelTransaction error:', error);
    if (error.message === 'Transaksi tidak ditemukan') {
      return sendResponse(res, 404, 'error', error.message);
    }
    if (error.message === 'Transaksi tidak dapat dibatalkan') {
      return sendResponse(res, 400, 'error', error.message);
    }
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 16. REQUEST TOP-UP
exports.requestTopup = async (req, res) => {
  try {
    const { jumlah } = req.body;
    const file = req.file;

    // Validasi
    if (!jumlah || parseFloat(jumlah) <= 0) {
      return sendResponse(res, 400, 'error', 'Jumlah top-up tidak valid');
    }
    if (!file) {
      return sendResponse(res, 400, 'error', 'Bukti pembayaran wajib diupload');
    }

    // Path dari middleware 'uploadTopup'
    const buktiPath = file.path.replace(/\\/g, '/').replace('writable/', '');

    const topup = await prisma.topup.create({
      data: {
        user_id: req.user.id,
        jumlah: parseFloat(jumlah),
        metode_pembayaran: 'qris',
        bukti_pembayaran: buktiPath,
        status: 'pending',
        kadaluarsa_pada: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    sendResponse(res, 201, 'success', 'Request top-up berhasil dibuat', {
      topup_id: topup.id,
      jumlah: topup.jumlah,
      status: topup.status,
      kadaluarsa_pada: topup.kadaluarsa_pada,
    });
  } catch (error) {
    console.error('requestTopup error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 17. GET TOP-UP HISTORY
exports.getTopupHistory = async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const where = {
      user_id: req.user.id,
    };

    if (status) where.status = status;

    const topups = await prisma.topup.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(limit) || 10,
      skip: parseInt(offset) || 0,
    });

    sendResponse(res, 200, 'success', 'Riwayat top-up berhasil diambil', topups);
  } catch (error) {
    console.error('getTopupHistory error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 18. SUBMIT RATING
exports.submitRating = async (req, res) => {
  const { transaksi_id, rating, ulasan } = req.body;
  const clientId = req.user.id;

  // Validasi
  if (!transaksi_id || !rating) {
     return sendResponse(res, 400, 'error', 'transaksi_id dan rating wajib diisi');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cek transaksi
      const transaction = await tx.transaksi.findFirst({
        where: { id: parseInt(transaksi_id), client_id: clientId },
      });

      if (!transaction) {
        throw new Error('Transaksi tidak ditemukan');
      }

      // 2. Hanya bisa rating jika status 'selesai'
      if (transaction.status !== 'selesai') {
        throw new Error('Hanya transaksi yang selesai yang bisa diberi rating');
      }

      // 3. Cek apakah sudah pernah dirating
      const existingRating = await tx.rating.findUnique({
        where: { transaksi_id: transaction.id },
      });

      if (existingRating) {
        throw new Error('Transaksi ini sudah diberi rating');
      }

      // 4. Buat rating
      const newRating = await tx.rating.create({
        data: {
          transaksi_id: transaction.id,
          client_id: clientId,
          tukang_id: transaction.tukang_id,
          rating: parseInt(rating),
          ulasan: ulasan,
        },
      });

      // 5. Update statistik rata-rata di profil tukang
      const stats = await tx.rating.aggregate({
        where: { tukang_id: transaction.tukang_id },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.profil_tukang.update({
        where: { user_id: transaction.tukang_id },
        data: {
          rata_rata_rating: stats._avg.rating,
          total_rating: stats._count.rating,
          total_pekerjaan_selesai: { increment: 1 }
        },
      });

      return newRating;
    });

    sendResponse(res, 201, 'success', 'Rating berhasil diberikan', {
      rating_id: result.id,
      transaksi_id: result.transaksi_id,
      rating: result.rating,
    });

  } catch (error) {
    console.error('submitRating error:', error);
    if (error.message.includes('tidak ditemukan')) {
      return sendResponse(res, 404, 'error', error.message);
    }
    if (error.message.includes('Hanya transaksi') || error.message.includes('sudah diberi rating')) {
      return sendResponse(res, 400, 'error', error.message);
    }
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};

// 19. GET CLIENT STATISTICS
exports.getClientStatistics = async (req, res) => {
  try {
    const clientId = req.user.id;

    // 1. Statistik Transaksi
    const trxStats = await prisma.transaksi.groupBy({
      by: ['status'],
      where: { client_id: clientId },
      _count: { status: true },
    });
    
    const totalPengeluaran = await prisma.transaksi.aggregate({
        where: { client_id: clientId, status: 'selesai' },
        _sum: { total_biaya: true },
    });

    // 2. Statistik TopUp
    const topupStats = await prisma.topup.groupBy({
      by: ['status'],
      where: { user_id: clientId },
      _count: { status: true },
    });
    
     const totalTopup = await prisma.topup.aggregate({
        where: { user_id: clientId, status: 'berhasil' },
        _sum: { jumlah: true },
    });

    // 3. Rating Diberikan
    const ratingCount = await prisma.rating.count({
      where: { client_id: clientId },
    });

    // Format data
    const formatStats = (stats) => stats.reduce((acc, cur) => {
        acc[cur.status.toLowerCase()] = cur._count.status;
        return acc;
    }, {});

    const trxData = formatStats(trxStats);
    const topupData = formatStats(topupStats);

    const stats = {
      saldo_poin: req.user.poin,
      transaksi: {
        total: trxStats.reduce((sum, s) => sum + s._count.status, 0),
        pending: trxData.pending || 0,
        diterima: trxData.diterima || 0,
        dalam_proses: trxData.dalam_proses || 0,
        selesai: trxData.selesai || 0,
        dibatalkan: trxData.dibatalkan || 0,
        ditolak: trxData.ditolak || 0,
        total_pengeluaran: totalPengeluaran._sum.total_biaya || 0,
      },
      topup: {
        total: topupStats.reduce((sum, s) => sum + s._count.status, 0),
        pending: topupData.pending || 0,
        berhasil: topupData.berhasil || 0,
        ditolak: topupData.ditolak || 0,
        kadaluarsa: topupData.kadaluarsa || 0,
        total_topup_berhasil: totalTopup._sum.jumlah || 0,
      },
      rating_diberikan: ratingCount,
    };

    sendResponse(res, 200, 'success', 'Statistik client berhasil diambil', stats);
  } catch (error) {
    console.error('getClientStatistics error:', error);
    sendResponse(res, 500, 'error', 'Internal Server Error', error.message);
  }
};