// src/config/database.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Create a singleton Prisma client
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error']
});

// For development, store in global to avoid hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Health check method
prisma.healthCheck = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { 
      status: 'healthy',
      database: 'Neon PostgreSQL',
      connected: true 
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { 
      status: 'unhealthy', 
      error: error.message,
      connected: false 
    };
  }
};

// Close connection method
prisma.close = async () => {
  await prisma.$disconnect();
  logger.info('Disconnected from Neon database');
};

// For compatibility with existing code
prisma.query = async (sql, params = []) => {
  try {
    // Convert SQLite-style ? parameters to Prisma raw query
    const result = await prisma.$queryRawUnsafe(sql, ...params);
    return { rows: result, rowCount: Array.isArray(result) ? result.length : 1 };
  } catch (error) {
    logger.error('Query error:', { sql, params, error: error.message });
    throw error;
  }
};

module.exports = prisma;