import crypto from 'crypto';

/**
 * Generate a custom notification ID
 * Format: NOTIF_YYYYMMDD_HHMMSS_RANDOM
 * Example: NOTIF_20241201_143022_a1b2c3d4
 */
export function generateNotificationId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  const random = crypto.randomBytes(4).toString('hex');
  
  return `NOTIF_${timestamp}_${random}`;
}

/**
 * Generate a shorter notification ID
 * Format: NOTIF_RANDOM
 * Example: NOTIF_a1b2c3d4e5f6
 */
export function generateShortNotificationId() {
  const random = crypto.randomBytes(6).toString('hex');
  return `NOTIF_${random}`;
}

/**
 * Generate UUID-based notification ID
 * Format: NOTIF_UUID
 * Example: NOTIF_550e8400-e29b-41d4-a716-446655440000
 */
export function generateUUIDNotificationId() {
  const uuid = crypto.randomUUID();
  return `NOTIF_${uuid}`;
}

/**
 * Generate sequential notification ID
 * Format: NOTIF_SEQUENCE
 * Example: NOTIF_000001, NOTIF_000002, etc.
 * Note: This requires a counter mechanism
 */
let sequenceCounter = 0;
export function generateSequentialNotificationId() {
  sequenceCounter++;
  const padded = String(sequenceCounter).padStart(6, '0');
  return `NOTIF_${padded}`;
}

/**
 * Validate notification ID format
 * @param {string} id - Notification ID to validate
 * @returns {boolean} - Whether the ID is valid
 */
export function isValidNotificationId(id) {
  if (!id || typeof id !== 'string') return false;
  
  // Check if it starts with NOTIF_
  if (!id.startsWith('NOTIF_')) return false;
  
  // Check minimum length
  if (id.length < 10) return false;
  
  return true;
}
