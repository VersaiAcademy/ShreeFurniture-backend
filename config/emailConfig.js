/**
 * Centralized Email/Admin configuration.
 * Admin email must come from environment variables.
 */

const FALLBACK_ADMIN_EMAIL = 'srifurniturevillageweb@gmail.com';

const getAdminEmail = () => {
  return (
    process.env.ADMIN_EMAIL ||
    process.env.MAIL_TO_ADMIN ||
    FALLBACK_ADMIN_EMAIL
  );
};

module.exports = {
  FALLBACK_ADMIN_EMAIL,
  getAdminEmail
};

