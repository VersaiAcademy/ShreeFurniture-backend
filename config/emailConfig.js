/**
 * Centralized Email Configuration
 * All admin emails go to: srifurniturevillageweb@gmail.com
 */

const ADMIN_EMAIL = 'srifurniturevillageweb@gmail.com';

module.exports = {
  ADMIN_EMAIL,
  // Fallback to env if needed, but default to the specified email
  getAdminEmail: () => process.env.MAIL_TO_ADMIN || ADMIN_EMAIL
};

