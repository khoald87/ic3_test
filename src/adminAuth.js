const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'admin-config.json');
const SALT_ROUNDS = 10;

/**
 * Đọc admin config từ file (async)
 * @returns {Promise<Object>} config object
 */
async function readAdminConfig() {
  try {
    const data = await fsPromises.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { pin: '1234' };
  }
}

/**
 * Ghi admin config vào file (async)
 * @param {Object} config
 */
async function writeAdminConfig(config) {
  await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Kiểm tra định dạng PIN (4-6 chữ số)
 * @param {string} pin
 * @returns {boolean}
 */
function validatePinFormat(pin) {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Hash mã PIN bằng bcryptjs
 * @param {string} plainPin
 * @returns {Promise<string>} hashed PIN
 */
async function hashPin(plainPin) {
  return bcrypt.hash(plainPin, SALT_ROUNDS);
}

/**
 * Xác thực mã PIN bất đồng bộ (so sánh với hash)
 * @param {string} plainPin
 * @returns {Promise<boolean>}
 */
async function verifyPinAsync(plainPin) {
  const config = await readAdminConfig();
  if (config.hashedPin) {
    return bcrypt.compare(plainPin, config.hashedPin);
  }
  // Fallback: so sánh plaintext nếu chưa migrate
  return plainPin === config.pin;
}

/**
 * Tự động chuyển plaintext PIN sang hash khi startup
 * @returns {Promise<void>}
 */
async function migratePinIfNeeded() {
  try {
    const config = await readAdminConfig();
    if (config.pin && !config.hashedPin) {
      const hashed = await hashPin(config.pin);
      config.hashedPin = hashed;
      delete config.pin;
      await writeAdminConfig(config);
      console.log('[adminAuth] Đã migrate PIN sang bcrypt hash');
    } else if (!config.pin && !config.hashedPin) {
      // Không có PIN nào — tạo default
      const hashed = await hashPin('1234');
      await writeAdminConfig({ hashedPin: hashed });
      console.log('[adminAuth] Đã tạo default PIN (hashed)');
    }
  } catch (err) {
    console.warn('[adminAuth] Lỗi migrate PIN, giữ nguyên config hiện tại:', err.message);
  }
}

/**
 * Đổi mã PIN (async, lưu hash)
 * @param {string} currentPin
 * @param {string} newPin
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function changePin(currentPin, newPin) {
  const isValid = await verifyPinAsync(currentPin);
  if (!isValid) {
    return { success: false, message: 'Mã PIN hiện tại không đúng' };
  }
  if (!validatePinFormat(newPin)) {
    return { success: false, message: 'Mã PIN phải gồm 4-6 chữ số' };
  }
  const hashedPin = await hashPin(newPin);
  const config = await readAdminConfig();
  delete config.pin; // Remove plaintext if exists
  config.hashedPin = hashedPin;
  await writeAdminConfig(config);
  return { success: true, message: 'Đổi mã PIN thành công' };
}

module.exports = {
  readAdminConfig,
  writeAdminConfig,
  validatePinFormat,
  hashPin,
  verifyPinAsync,
  migratePinIfNeeded,
  changePin
};
