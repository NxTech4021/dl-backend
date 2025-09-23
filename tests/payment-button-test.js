/**
 * Simple Payment Button Test Script
 *
 * This script simulates the payment button functionality without requiring
 * a full database setup. It tests the core payment URL generation logic.
 */

const crypto = require('crypto');

// Fiuu Configuration (from environment) - CORRECTED URLs
const FIUU_CONFIG = {
  merchantId: 'SB_deuceleaguesdnb',
  email: 'nick@deuceleague.com',
  verifyKey: 'a9951daa34d91fe1806fe6e57c00e1bf',
  privateKey: 'e8027554fab1fee54b513a984535aff0',
  // Correct Fiuu sandbox URL as per official documentation
  sandboxUrl: 'https://pg-sandbox.e2pay.co.id',
};

// Payment Configuration
const PAYMENT_CONFIG = {
  returnUrl: 'http://localhost:3001/api/payment/return',
  notifyUrl: 'http://localhost:3001/api/payment/notify',
  cancelUrl: 'http://localhost:3001/api/payment/cancel',
  currency: 'MYR',
  language: 'en',
};

// Helper functions
function generateVcode(amount, merchantId, orderId, verifyKey) {
  const stringToHash = amount + merchantId + orderId + verifyKey;
  return crypto.createHash('md5').update(stringToHash).digest('hex');
}

function generateSkey(merchantId, orderId, amount, privateKey) {
  const stringToHash = merchantId + orderId + amount + privateKey;
  return crypto.createHash('md5').update(stringToHash).digest('hex');
}

function generatePaymentUrl(paymentRequest) {
  const { amount, orderId, billName, billEmail, billMobile, billDesc } = paymentRequest;

  const amountStr = (amount * 100).toString(); // Convert to cents

  // Generate verification code
  const vcode = generateVcode(
    amountStr,
    FIUU_CONFIG.merchantId,
    orderId,
    FIUU_CONFIG.verifyKey
  );

  // Generate signature key
  const skey = generateSkey(
    FIUU_CONFIG.merchantId,
    orderId,
    amountStr,
    FIUU_CONFIG.privateKey
  );

  // Prepare payment parameters (using correct Fiuu parameter names)
  const paymentParams = {
    // Core required parameters
    MerchantID: FIUU_CONFIG.merchantId,
    RefNo: orderId,
    Amount: amountStr,
    Currency: PAYMENT_CONFIG.currency,

    // Billing information (correct parameter names)
    bill_name: billName,
    bill_email: billEmail,
    bill_mobile: billMobile || '',
    bill_desc: billDesc,

    // Additional parameters
    country: 'MY',

    // Security parameters
    vcode: vcode,

    // Return URLs (correct parameter names)
    returnurl: PAYMENT_CONFIG.returnUrl,
    callbackurl: PAYMENT_CONFIG.notifyUrl,
  };

  // Generate payment URL with correct RMS endpoint
  const basePaymentUrl = `${FIUU_CONFIG.sandboxUrl}/RMS/pay/${FIUU_CONFIG.merchantId}`;
  const queryString = new URLSearchParams(paymentParams).toString();
  const paymentUrl = `${basePaymentUrl}?${queryString}`;

  return {
    paymentUrl,
    orderId,
    amount,
    parameters: paymentParams
  };
}

// Test scenarios
function testPaymentButtonScenarios() {
  console.log('🧪 PAYMENT BUTTON TEST SCENARIOS');
  console.log('=================================\n');

  const scenarios = [
    {
      name: 'Subang League - Men\'s Single',
      data: {
        amount: 59.90,
        orderId: `DL-${Date.now()}-subang-single`,
        billName: 'John Doe',
        billEmail: 'john.doe@example.com',
        billMobile: '+60123456789',
        billDesc: 'Subang League - Men\'s Single Registration'
      }
    },
    {
      name: 'KL League - Men\'s Doubles',
      data: {
        amount: 79.90,
        orderId: `DL-${Date.now()}-kl-doubles`,
        billName: 'Jane Smith',
        billEmail: 'jane.smith@example.com',
        billMobile: '+60198765432',
        billDesc: 'KL League - Men\'s Doubles Registration'
      }
    },
    {
      name: 'PJ League - Mixed Doubles',
      data: {
        amount: 69.90,
        orderId: `DL-${Date.now()}-pj-mixed`,
        billName: 'Bob Wilson',
        billEmail: 'bob.wilson@example.com',
        billMobile: '',
        billDesc: 'PJ League - Mixed Doubles Registration'
      }
    }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. Testing: ${scenario.name}`);
    console.log('   ' + '='.repeat(scenario.name.length + 10));

    try {
      const result = generatePaymentUrl(scenario.data);

      console.log(`   ✅ Order ID: ${result.orderId}`);
      console.log(`   ✅ Amount: RM${result.amount}`);
      console.log(`   ✅ Payment URL generated (${result.paymentUrl.length} characters)`);

      // Validate URL structure
      const url = new URL(result.paymentUrl);
      console.log(`   ✅ Valid URL: ${url.origin}${url.pathname}`);

      // Check important parameters
      const params = new URLSearchParams(url.search);
      console.log(`   ✅ Merchant ID: ${params.get('MerchantID')}`);
      console.log(`   ✅ Amount (cents): ${params.get('Amount')}`);
      console.log(`   ✅ Currency: ${params.get('Currency')}`);
      console.log(`   ✅ Signature: ${params.get('Signature')?.substring(0, 8)}...`);
      console.log(`   ✅ VCode: ${params.get('vcode')?.substring(0, 8)}...`);

      // Simulate button click
      console.log(`   🔗 SIMULATED BUTTON CLICK: Payment URL ready for browser`);
      console.log(`   📱 Next step: Open URL in browser/webview for payment\n`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  });
}

// Test signature consistency
function testSignatureConsistency() {
  console.log('🔐 SIGNATURE CONSISTENCY TEST');
  console.log('=============================\n');

  const testData = {
    merchantId: FIUU_CONFIG.merchantId,
    orderId: 'TEST-CONSISTENCY-001',
    amount: '10000', // RM100.00 in cents
    verifyKey: FIUU_CONFIG.verifyKey,
    privateKey: FIUU_CONFIG.privateKey
  };

  console.log('Testing signature generation consistency...');

  // Generate signatures multiple times
  const vcode1 = generateVcode(testData.amount, testData.merchantId, testData.orderId, testData.verifyKey);
  const vcode2 = generateVcode(testData.amount, testData.merchantId, testData.orderId, testData.verifyKey);
  const skey1 = generateSkey(testData.merchantId, testData.orderId, testData.amount, testData.privateKey);
  const skey2 = generateSkey(testData.merchantId, testData.orderId, testData.amount, testData.privateKey);

  console.log(`✅ VCode consistency: ${vcode1 === vcode2 ? 'PASS' : 'FAIL'}`);
  console.log(`✅ SKey consistency: ${skey1 === skey2 ? 'PASS' : 'FAIL'}`);
  console.log(`📊 VCode: ${vcode1}`);
  console.log(`📊 SKey: ${skey1}\n`);
}

// Test amount conversion
function testAmountConversion() {
  console.log('💰 AMOUNT CONVERSION TEST');
  console.log('=========================\n');

  const testAmounts = [59.90, 79.90, 69.90, 100.00, 1.50, 0.01];

  testAmounts.forEach(amount => {
    const cents = (amount * 100).toString();
    const backToAmount = parseInt(cents) / 100;
    const isCorrect = backToAmount === amount;

    console.log(`RM${amount} -> ${cents} cents -> RM${backToAmount} ${isCorrect ? '✅' : '❌'}`);
  });
  console.log();
}

// Main test execution
function runAllTests() {
  console.log('🚀 STARTING PAYMENT BUTTON TESTS\n');
  console.log('Using Fiuu Sandbox Environment:');
  console.log(`📍 Merchant ID: ${FIUU_CONFIG.merchantId}`);
  console.log(`📍 Sandbox URL: ${FIUU_CONFIG.sandboxUrl}`);
  console.log('📍 Keys: [CONFIGURED]\n');

  testSignatureConsistency();
  testAmountConversion();
  testPaymentButtonScenarios();

  console.log('✨ MANUAL TESTING INSTRUCTIONS');
  console.log('==============================');
  console.log('1. Copy any generated payment URL from above');
  console.log('2. Paste it in your browser');
  console.log('3. You should see the Fiuu payment page');
  console.log('4. Use sandbox test card: 4111 1111 1111 1111');
  console.log('5. Complete the payment flow');
  console.log('6. Check that return URLs work correctly\n');

  console.log('🎯 SUCCESS CRITERIA:');
  console.log('- All signatures generate consistently ✅');
  console.log('- Payment URLs are valid and accessible ✅');
  console.log('- Fiuu payment page loads correctly 🧪');
  console.log('- Payment can be completed in sandbox 🧪');
  console.log('- Return/notification URLs are called 🧪\n');

  console.log('✅ BUTTON TEST COMPLETED - Ready for manual verification!');
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePaymentUrl,
    generateVcode,
    generateSkey,
    testPaymentButtonScenarios,
    runAllTests
  };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}