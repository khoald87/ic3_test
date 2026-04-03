const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'admin-config.json');

/**
 * Đọc admin config từ file
 * @returns {Object} config object
 */
function readAdminConfig() {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { pin: '1234' };
  }
}

/**
 * Ghi admin config vào file
 * @param {Object} config
 */
function writeAdminConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
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
 * Xác thực mã PIN
 * @param {string} pin
 * @returns {boolean}
 */
function verifyPin(pin) {
  const config = readAdminConfig();
  return pin === config.pin;
}

/**
 * Đổi mã PIN
 * @param {string} currentPin
 * @param {string} newPin
 * @returns {{ success: boolean, message: string }}
 */
function changePin(currentPin, newPin) {
  if (!verifyPin(currentPin)) {
    return { success: false, message: 'Mã PIN hiện tại không đúng' };
  }
  if (!validatePinFormat(newPin)) {
    return { success: false, message: 'Mã PIN phải gồm 4-6 chữ số' };
  }
  const config = readAdminConfig();
  config.pin = newPin;
  writeAdminConfig(config);
  return { success: true, message: 'Đổi mã PIN thành công' };
}

module.exports = {
  readAdminConfig,
  writeAdminConfig,
  validatePinFormat,
  verifyPin,
  changePin
};
