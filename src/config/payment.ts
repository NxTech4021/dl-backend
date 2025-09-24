export const fiuuConfig = {
  merchantId: process.env.FIUU_MERCHANT_ID || '',
  email: process.env.FIUU_EMAIL || '',
  password: process.env.FIUU_PASSWORD || '',
  verifyKey: process.env.FIUU_VERIFY_KEY || '',
  privateKey: process.env.FIUU_PRIVATE_KEY || '',
  // Current Fiuu RMS sandbox host (developer advisory Sept 2025)
  sandboxUrl: process.env.FIUU_SANDBOX_URL || 'https://sandbox.fiuu.com',
  portalUrl: process.env.FIUU_PORTAL_URL || 'https://sandbox-portal.fiuu.com',
};

export const paymentConfig = {
  returnUrl: `${process.env.BETTER_AUTH_URL}/api/payment/return`,
  notifyUrl: `${process.env.BETTER_AUTH_URL}/api/payment/notify`,
  cancelUrl: `${process.env.BETTER_AUTH_URL}/api/payment/cancel`,
  currency: 'MYR',
  country: 'MY',
  language: 'en',
};
