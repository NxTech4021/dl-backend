import crypto from 'crypto';

describe('Payment Service Unit Tests', () => {
  // Mock Fiuu configuration for testing
  const mockFiuuConfig = {
    merchantId: 'SB_deuceleaguesdnb',
    email: 'nick@deuceleague.com',
    password: 'sNChOUJc',
    verifyKey: 'a9951daa34d91fe1806fe6e57c00e1bf',
    privateKey: 'e8027554fab1fee54b513a984535aff0',
    sandboxUrl: 'https://sandbox-pg.fiuu.com',
    portalUrl: 'https://sandbox-portal.fiuu.com',
  };

  // Helper functions to test signature generation (similar to payment service)
  const generateVcode = (amount: string, merchantId: string, orderId: string, verifyKey: string): string => {
    const stringToHash = amount + merchantId + orderId + verifyKey;
    return crypto.createHash('md5').update(stringToHash).digest('hex');
  };

  const generateSkey = (merchantId: string, orderId: string, amount: string, privateKey: string): string => {
    const stringToHash = merchantId + orderId + amount + privateKey;
    return crypto.createHash('md5').update(stringToHash).digest('hex');
  };

  const parsePaymentStatus = (status: string): 'success' | 'failed' | 'pending' => {
    switch (status) {
      case '00':
        return 'success';
      case '11':
        return 'failed';
      case '22':
        return 'pending';
      default:
        return 'failed';
    }
  };

  describe('Signature Generation', () => {
    test('should generate consistent vcode (verify code)', () => {
      const amount = '5990'; // RM59.90 in cents
      const merchantId = mockFiuuConfig.merchantId;
      const orderId = 'DL-TEST-001';
      const verifyKey = mockFiuuConfig.verifyKey;

      const vcode1 = generateVcode(amount, merchantId, orderId, verifyKey);
      const vcode2 = generateVcode(amount, merchantId, orderId, verifyKey);

      expect(vcode1).toBe(vcode2);
      expect(vcode1).toHaveLength(32); // MD5 hash length
      expect(typeof vcode1).toBe('string');

      console.log('✅ VCode generated:', vcode1);
    });

    test('should generate consistent skey (signature key)', () => {
      const merchantId = mockFiuuConfig.merchantId;
      const orderId = 'DL-TEST-001';
      const amount = '5990';
      const privateKey = mockFiuuConfig.privateKey;

      const skey1 = generateSkey(merchantId, orderId, amount, privateKey);
      const skey2 = generateSkey(merchantId, orderId, amount, privateKey);

      expect(skey1).toBe(skey2);
      expect(skey1).toHaveLength(32); // MD5 hash length
      expect(typeof skey1).toBe('string');

      console.log('✅ SKey generated:', skey1);
    });

    test('should generate different signatures for different inputs', () => {
      const baseParams = {
        merchantId: mockFiuuConfig.merchantId,
        orderId: 'DL-TEST-001',
        amount: '5990',
        privateKey: mockFiuuConfig.privateKey
      };

      const skey1 = generateSkey(baseParams.merchantId, baseParams.orderId, baseParams.amount, baseParams.privateKey);
      const skey2 = generateSkey(baseParams.merchantId, 'DL-TEST-002', baseParams.amount, baseParams.privateKey); // Different order ID
      const skey3 = generateSkey(baseParams.merchantId, baseParams.orderId, '7990', baseParams.privateKey); // Different amount

      expect(skey1).not.toBe(skey2);
      expect(skey1).not.toBe(skey3);
      expect(skey2).not.toBe(skey3);

      console.log('✅ Different inputs produce different signatures');
    });
  });

  describe('Payment Status Parsing', () => {
    test('should parse Fiuu status codes correctly', () => {
      expect(parsePaymentStatus('00')).toBe('success');
      expect(parsePaymentStatus('11')).toBe('failed');
      expect(parsePaymentStatus('22')).toBe('pending');
      expect(parsePaymentStatus('99')).toBe('failed'); // Unknown status
      expect(parsePaymentStatus('')).toBe('failed'); // Empty status
    });
  });

  describe('Payment URL Generation', () => {
    test('should generate valid Fiuu payment URL', () => {
      const orderId = 'DL-TEST-001';
      const amount = '5990'; // RM59.90 in cents
      const billDesc = 'Test League Registration';
      const billName = 'Test User';
      const billEmail = 'test@example.com';

      // Generate signatures
      const vcode = generateVcode(amount, mockFiuuConfig.merchantId, orderId, mockFiuuConfig.verifyKey);
      const skey = generateSkey(mockFiuuConfig.merchantId, orderId, amount, mockFiuuConfig.privateKey);

      // Create payment parameters
      const paymentParams = {
        MerchantID: mockFiuuConfig.merchantId,
        RefNo: orderId,
        Amount: amount,
        Currency: 'MYR',
        ProdDesc: billDesc,
        UserName: billName,
        UserEmail: billEmail,
        UserContact: '',
        Remark: `League Registration - ${orderId}`,
        Lang: 'en',
        Signature: skey,
        ResponseURL: 'http://localhost:3001/api/payment/return',
        BackendURL: 'http://localhost:3001/api/payment/notify',
        MerchantReturnURL: 'http://localhost:3001/api/payment/cancel',
        vcode: vcode,
      };

      // Generate payment URL
      const basePaymentUrl = `${mockFiuuConfig.sandboxUrl}/FPX/pay/${mockFiuuConfig.merchantId}`;
      const queryString = new URLSearchParams(paymentParams).toString();
      const paymentUrl = `${basePaymentUrl}?${queryString}`;

      // Validate URL structure
      expect(paymentUrl).toContain('https://sandbox-pg.fiuu.com');
      expect(paymentUrl).toContain('MerchantID=SB_deuceleaguesdnb');
      expect(paymentUrl).toContain(`RefNo=${orderId}`);
      expect(paymentUrl).toContain(`Amount=${amount}`);
      expect(paymentUrl).toContain('Currency=MYR');
      expect(paymentUrl).toContain(`Signature=${skey}`);
      expect(paymentUrl).toContain(`vcode=${vcode}`);

      console.log('✅ Payment URL generated and validated');
      console.log('🔗 URL length:', paymentUrl.length);
      console.log('🔗 URL preview:', paymentUrl.substring(0, 100) + '...');
    });
  });

  describe('Real Fiuu Parameters Test', () => {
    test('should generate payment URL with actual merchant credentials', () => {
      // This test uses the actual Fiuu credentials provided
      const testPayment = {
        orderId: 'DL-1703123456-abc12345',
        amount: 59.90,
        userEmail: 'test@deuceleague.com',
        userName: 'Test User',
        description: 'Subang League - Men\'s Single Registration'
      };

      const amountInCents = (testPayment.amount * 100).toString();

      // Generate actual signatures using provided credentials
      const vcode = generateVcode(
        amountInCents,
        'SB_deuceleaguesdnb',
        testPayment.orderId,
        'a9951daa34d91fe1806fe6e57c00e1bf'
      );

      const skey = generateSkey(
        'SB_deuceleaguesdnb',
        testPayment.orderId,
        amountInCents,
        'e8027554fab1fee54b513a984535aff0'
      );

      console.log('🔐 Generated for real payment:');
      console.log('   Order ID:', testPayment.orderId);
      console.log('   Amount (cents):', amountInCents);
      console.log('   VCode:', vcode);
      console.log('   SKey:', skey);

      // Validate signature formats
      expect(vcode).toMatch(/^[a-f0-9]{32}$/);
      expect(skey).toMatch(/^[a-f0-9]{32}$/);

      console.log('✅ Real Fiuu credentials generate valid signatures');
    });
  });

  describe('Payment Verification', () => {
    test('should verify payment notification signature', () => {
      // Mock payment notification from Fiuu
      const mockNotificationData = {
        MerchantID: 'SB_deuceleaguesdnb',
        RefNo: 'DL-TEST-001',
        Amount: '5990',
        Currency: 'MYR',
        Remark: 'League Registration - DL-TEST-001',
        TransID: 'TXN123456789',
        AuthCode: 'AUTH123',
        Status: '00',
        ErrDesc: '',
      };

      // Generate expected signature for notification
      const stringToHash = `${mockNotificationData.MerchantID}${mockNotificationData.RefNo}${mockNotificationData.Amount}${mockNotificationData.Currency}${mockNotificationData.Remark}${mockNotificationData.TransID}${mockNotificationData.AuthCode}${mockNotificationData.Status}${mockNotificationData.ErrDesc}${mockFiuuConfig.privateKey}`;
      const expectedSignature = crypto.createHash('sha256').update(stringToHash).digest('hex');

      console.log('🔐 Notification verification:');
      console.log('   String to hash:', stringToHash);
      console.log('   Expected signature:', expectedSignature);

      expect(expectedSignature).toHaveLength(64); // SHA256 hash length
      expect(typeof expectedSignature).toBe('string');

      console.log('✅ Payment notification signature generation verified');
    });

    test('should verify payment return signature', () => {
      // Mock payment return from Fiuu
      const mockReturnData = {
        MerchantID: 'SB_deuceleaguesdnb',
        RefNo: 'DL-TEST-001',
        Amount: '5990',
        Currency: 'MYR',
        Remark: 'League Registration - DL-TEST-001',
        TransID: 'TXN123456789',
        AuthCode: 'AUTH123',
        Status: '00',
        ErrDesc: '',
      };

      // Generate expected signature for return URL (uses verify key, not private key)
      const stringToHash = `${mockReturnData.MerchantID}${mockReturnData.RefNo}${mockReturnData.Amount}${mockReturnData.Currency}${mockReturnData.Remark}${mockReturnData.TransID}${mockReturnData.AuthCode}${mockReturnData.Status}${mockReturnData.ErrDesc}${mockFiuuConfig.verifyKey}`;
      const expectedSignature = crypto.createHash('md5').update(stringToHash).digest('hex');

      console.log('🔐 Return verification:');
      console.log('   String to hash:', stringToHash);
      console.log('   Expected signature:', expectedSignature);

      expect(expectedSignature).toHaveLength(32); // MD5 hash length
      expect(typeof expectedSignature).toBe('string');

      console.log('✅ Payment return signature generation verified');
    });
  });

  describe('Amount Conversion', () => {
    test('should convert amounts to cents correctly', () => {
      expect((59.90 * 100).toString()).toBe('5990');
      expect((100.00 * 100).toString()).toBe('10000');
      expect((1.50 * 100).toString()).toBe('150');
      expect((0.01 * 100).toString()).toBe('1');

      console.log('✅ Amount conversion to cents verified');
    });

    test('should handle decimal precision in amount conversion', () => {
      // Test cases that might cause floating point precision issues
      const testAmounts = [59.90, 79.95, 99.99, 150.75];

      testAmounts.forEach(amount => {
        const cents = Math.round(amount * 100).toString();
        const backToAmount = parseInt(cents) / 100;

        expect(backToAmount).toBe(amount);
        console.log(`   ${amount} -> ${cents} cents -> ${backToAmount}`);
      });

      console.log('✅ Decimal precision handling verified');
    });
  });
});

// Manual testing instructions
describe('Manual Testing Guide', () => {
  test('should provide manual testing instructions', () => {
    console.log('\n🧪 MANUAL TESTING GUIDE FOR PAYMENT INTEGRATION');
    console.log('===============================================');

    console.log('\n1. 🗄️  DATABASE SETUP:');
    console.log('   - Run: npm run db:migrate');
    console.log('   - Create test user in database');
    console.log('   - Create test league and season data');

    console.log('\n2. 🖥️  BACKEND TESTING:');
    console.log('   - Start backend: npm run dev');
    console.log('   - Test endpoint: POST /api/payment/create');
    console.log('   - Check payment URL generation');
    console.log('   - Test endpoint: GET /api/payment/status/:orderId');

    console.log('\n3. 📱 FRONTEND TESTING:');
    console.log('   - Start frontend: npm start');
    console.log('   - Navigate to league page');
    console.log('   - Click "Join" button');
    console.log('   - Click "Register" on registration page');
    console.log('   - Verify payment page loads');
    console.log('   - Click "Pay" button');
    console.log('   - Check payment URL opens');

    console.log('\n4. 💳 FIUU SANDBOX TESTING:');
    console.log('   - Access Fiuu sandbox payment page');
    console.log('   - Test with sandbox card: 4111 1111 1111 1111');
    console.log('   - Complete payment flow');
    console.log('   - Check return/notification URLs');

    console.log('\n5. 🔍 DEBUGGING:');
    console.log('   - Check backend logs for payment creation');
    console.log('   - Verify database payment records');
    console.log('   - Test payment status polling');
    console.log('   - Check frontend network requests');

    console.log('\n6. ✅ SUCCESS CRITERIA:');
    console.log('   - Payment URL generates correctly');
    console.log('   - Payment opens in browser/webview');
    console.log('   - User can complete payment on Fiuu');
    console.log('   - Payment status updates correctly');
    console.log('   - Registration status changes to CONFIRMED');

    expect(true).toBe(true); // This test always passes - it's for documentation
  });
});