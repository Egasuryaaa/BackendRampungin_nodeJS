// File: src/utils/prisma.util.js
const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();
module.exports = prisma;