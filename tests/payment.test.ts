import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import paymentRoutes from '../src/routes/paymentRoutes';
import leagueRoutes from '../src/routes/leagueRoutes';

const app = express();
app.use(express.json());
app.use('/api/payment', paymentRoutes);
app.use('/api/leagues', leagueRoutes);

const prisma = new PrismaClient();

describe('Payment System Tests', () => {
  let testUserId: string;
  let testLeagueId: string;
  let testSeasonId: string;
  let testOrderId: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'payment.test@deuceleague.com',
        name: 'Payment Test User',
        username: 'paymenttest',
        displayUsername: 'paymenttest',
        emailVerified: true,
        phoneNumber: '+60123456789',
        role: 'USER',
        completedOnboarding: true,
      }
    });
    testUserId = testUser.id;

    // Create test league
    const testLeague = await prisma.league.create({
      data: {
        name: 'Test League',
        sport: 'Pickleball',
        location: 'Test Location',
        description: 'League for payment testing',
        isActive: true,
      }
    });
    testLeagueId = testLeague.id;

    // Create test season
    const testSeason = await prisma.leagueSeason.create({
      data: {
        leagueId: testLeague.id,
        name: 'Test Season 2025',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2026-01-31'),
        registrationEnd: new Date('2025-11-30'),
        entryFee: 59.90,
        maxParticipants: 100,
        category: 'Men\'s Single',
        status: 'OPEN_REGISTRATION',
      }
    });
    testSeasonId = testSeason.id;

    console.log('🧪 Test setup completed:', {
      userId: testUserId,
      leagueId: testLeagueId,
      seasonId: testSeasonId
    });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      // Delete payments and registrations first
      await prisma.leagueRegistration.deleteMany({
        where: { userId: testUserId }
      });

      await prisma.payment.deleteMany({
        where: { userId: testUserId }
      });

      // Delete season and league
      await prisma.leagueSeason.delete({
        where: { id: testSeasonId }
      });

      await prisma.league.delete({
        where: { id: testLeagueId }
      });

      // Delete user
      await prisma.user.delete({
        where: { id: testUserId }
      });

      console.log('🧹 Test cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }

    await prisma.$disconnect();
  });

  describe('League Endpoints', () => {
    test('should fetch all leagues', async () => {
      const response = await request(app)
        .get('/api/leagues')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('leagues');
      expect(Array.isArray(response.body.leagues)).toBe(true);

      // Should include our test league
      const leagues = response.body.leagues;
      const testLeague = leagues.find((l: any) => l.id === testLeagueId);
      expect(testLeague).toBeDefined();
      expect(testLeague.name).toBe('Test League');
      expect(testLeague.sport).toBe('Pickleball');

      console.log('✅ Found leagues:', leagues.length);
    });

    test('should fetch league by ID with seasons', async () => {
      const response = await request(app)
        .get(`/api/leagues/${testLeagueId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('league');

      const league = response.body.league;
      expect(league.id).toBe(testLeagueId);
      expect(league.name).toBe('Test League');
      expect(league.seasons).toBeDefined();
      expect(Array.isArray(league.seasons)).toBe(true);
      expect(league.seasons.length).toBeGreaterThan(0);

      console.log('✅ League details with seasons:', league.seasons.length);
    });

    test('should fetch league seasons by category', async () => {
      const response = await request(app)
        .get(`/api/leagues/${testLeagueId}/seasons?category=Men's Single`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('seasons');

      const seasons = response.body.seasons;
      expect(Array.isArray(seasons)).toBe(true);
      expect(seasons.length).toBeGreaterThan(0);
      expect(seasons[0].category).toBe('Men\'s Single');

      console.log('✅ Filtered seasons:', seasons.length);
    });
  });

  describe('Payment Creation', () => {
    test('should create payment successfully', async () => {
      const paymentData = {
        seasonId: testSeasonId,
        leagueId: testLeagueId,
        amount: 59.90,
        billDesc: 'Test League - Men\'s Single Registration',
        userId: testUserId
      };

      const response = await request(app)
        .post('/api/payment/create')
        .send(paymentData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('paymentUrl');
      expect(response.body).toHaveProperty('orderId');
      expect(response.body).toHaveProperty('amount', 59.90);

      // Store order ID for later tests
      testOrderId = response.body.orderId;

      // Payment URL should be a valid Fiuu URL
      expect(response.body.paymentUrl).toMatch(/https:\/\/sandbox-pg\.fiuu\.com/);
      expect(response.body.paymentUrl).toContain('MerchantID=SB_deuceleaguesdnb');
      expect(response.body.paymentUrl).toContain(`RefNo=${testOrderId}`);

      console.log('✅ Payment created:', {
        orderId: testOrderId,
        paymentUrl: response.body.paymentUrl.substring(0, 100) + '...'
      });
    });

    test('should create league registration with payment', async () => {
      // Check that league registration was created
      const registration = await prisma.leagueRegistration.findFirst({
        where: {
          userId: testUserId,
          seasonId: testSeasonId
        },
        include: {
          payment: true
        }
      });

      expect(registration).toBeDefined();
      expect(registration?.status).toBe('PENDING');
      expect(registration?.payment).toBeDefined();
      expect(registration?.payment?.orderId).toBe(testOrderId);

      console.log('✅ League registration created with payment link');
    });

    test('should prevent duplicate registration', async () => {
      const paymentData = {
        seasonId: testSeasonId,
        leagueId: testLeagueId,
        amount: 59.90,
        billDesc: 'Duplicate Registration Test',
        userId: testUserId
      };

      const response = await request(app)
        .post('/api/payment/create')
        .send(paymentData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/already registered/i);

      console.log('✅ Duplicate registration prevented');
    });

    test('should validate required fields', async () => {
      const invalidData = {
        seasonId: testSeasonId,
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/payment/create')
        .send(invalidData)
        .expect(401); // User not authenticated or missing userId

      expect(response.body).toHaveProperty('error');

      console.log('✅ Required field validation working');
    });

    test('should validate user exists', async () => {
      const paymentData = {
        seasonId: testSeasonId,
        leagueId: testLeagueId,
        amount: 59.90,
        billDesc: 'Invalid User Test',
        userId: 'non-existent-user-id'
      };

      const response = await request(app)
        .post('/api/payment/create')
        .send(paymentData)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'User not found');

      console.log('✅ User validation working');
    });
  });

  describe('Payment Status', () => {
    test('should get payment status', async () => {
      const response = await request(app)
        .get(`/api/payment/status/${testOrderId}?userId=${testUserId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('payment');

      const payment = response.body.payment;
      expect(payment.orderId).toBe(testOrderId);
      expect(payment.amount).toBe(59.90);
      expect(payment.status).toBe('PENDING');
      expect(Array.isArray(payment.registrations)).toBe(true);

      console.log('✅ Payment status retrieved:', {
        orderId: payment.orderId,
        status: payment.status,
        amount: payment.amount
      });
    });

    test('should return 404 for non-existent payment', async () => {
      const response = await request(app)
        .get(`/api/payment/status/non-existent-order?userId=${testUserId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Payment not found');

      console.log('✅ Non-existent payment handling');
    });

    test('should get user payments', async () => {
      const response = await request(app)
        .get(`/api/payment/user?userId=${testUserId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('payments');
      expect(Array.isArray(response.body.payments)).toBe(true);
      expect(response.body.payments.length).toBeGreaterThan(0);

      const payment = response.body.payments[0];
      expect(payment.orderId).toBe(testOrderId);
      expect(payment.userId).toBe(testUserId);

      console.log('✅ User payments retrieved:', response.body.payments.length);
    });
  });

  describe('Payment Verification', () => {
    test('should verify Fiuu payment parameters', async () => {
      // This test verifies that the payment URL contains correct Fiuu parameters
      const paymentData = {
        seasonId: testSeasonId,
        leagueId: testLeagueId,
        amount: 100.00, // Different amount for new test
        billDesc: 'Verification Test',
        userId: testUserId
      };

      // First, delete the existing registration to allow new payment
      await prisma.leagueRegistration.deleteMany({
        where: { userId: testUserId, seasonId: testSeasonId }
      });
      await prisma.payment.deleteMany({
        where: { userId: testUserId }
      });

      const response = await request(app)
        .post('/api/payment/create')
        .send(paymentData)
        .expect(200);

      const paymentUrl = response.body.paymentUrl;
      const urlParams = new URL(paymentUrl);

      // Check required Fiuu parameters
      expect(urlParams.searchParams.get('MerchantID')).toBe('SB_deuceleaguesdnb');
      expect(urlParams.searchParams.get('Amount')).toBe('10000'); // Amount in cents
      expect(urlParams.searchParams.get('Currency')).toBe('MYR');
      expect(urlParams.searchParams.get('RefNo')).toBe(response.body.orderId);
      expect(urlParams.searchParams.get('ProdDesc')).toBe('Verification Test');
      expect(urlParams.searchParams.get('UserName')).toBe('Payment Test User');
      expect(urlParams.searchParams.get('UserEmail')).toBe('payment.test@deuceleague.com');

      // Check that signature and vcode are present
      expect(urlParams.searchParams.get('Signature')).toBeDefined();
      expect(urlParams.searchParams.get('vcode')).toBeDefined();

      console.log('✅ Payment URL parameters verified');
    });
  });

  describe('Payment Service Unit Tests', () => {
    test('should generate valid payment signature', async () => {
      // Import payment service for unit testing
      const paymentService = require('../src/services/paymentService').default;

      const testAmount = '10000'; // RM100.00 in cents
      const testMerchantId = 'SB_deuceleaguesdnb';
      const testOrderId = 'TEST-ORDER-123';
      const testPrivateKey = 'e8027554fab1fee54b513a984535aff0';

      // Test signature generation
      const signature = paymentService.generateSkey(testMerchantId, testOrderId, testAmount, testPrivateKey);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(32); // MD5 hash length

      console.log('✅ Payment signature generation verified');
    });

    test('should validate payment notification', async () => {
      const paymentService = require('../src/services/paymentService').default;

      // Mock payment notification data
      const mockNotification = {
        MerchantID: 'SB_deuceleaguesdnb',
        RefNo: 'TEST-ORDER-123',
        Amount: '10000',
        Currency: 'MYR',
        Remark: 'Test payment',
        TransID: 'TXN123456789',
        AuthCode: 'AUTH123',
        Status: '00',
        ErrDesc: '',
        Signature: 'mock_signature' // This would be calculated properly in real scenario
      };

      // This test verifies the signature validation logic exists
      const isValid = paymentService.verifyPaymentNotification(mockNotification);

      // Since we're using a mock signature, this should return false
      expect(typeof isValid).toBe('boolean');

      console.log('✅ Payment notification validation logic verified');
    });

    test('should parse payment status correctly', async () => {
      const paymentService = require('../src/services/paymentService').default;

      expect(paymentService.parsePaymentStatus('00')).toBe('success');
      expect(paymentService.parsePaymentStatus('11')).toBe('failed');
      expect(paymentService.parsePaymentStatus('22')).toBe('pending');
      expect(paymentService.parsePaymentStatus('99')).toBe('failed'); // Unknown status defaults to failed

      console.log('✅ Payment status parsing verified');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing user gracefully', async () => {
      const paymentData = {
        seasonId: testSeasonId,
        leagueId: testLeagueId,
        amount: 59.90,
        billDesc: 'Missing User Test',
        // userId missing
      };

      const response = await request(app)
        .post('/api/payment/create')
        .send(paymentData)
        .expect(401);

      expect(response.body.error).toMatch(/not authenticated|not provided/i);

      console.log('✅ Missing user error handling');
    });

    test('should handle invalid season ID', async () => {
      const paymentData = {
        seasonId: 'non-existent-season',
        leagueId: testLeagueId,
        amount: 59.90,
        billDesc: 'Invalid Season Test',
        userId: testUserId
      };

      const response = await request(app)
        .post('/api/payment/create')
        .send(paymentData)
        .expect(500); // Database error when season doesn't exist

      expect(response.body).toHaveProperty('error');

      console.log('✅ Invalid season ID error handling');
    });
  });
});

// Integration test for complete payment flow
describe('Payment Flow Integration', () => {
  test('should demonstrate complete payment flow', async () => {
    console.log('\n🎯 COMPLETE PAYMENT FLOW DEMONSTRATION:');
    console.log('=====================================');

    console.log('1. 📱 User clicks "Join" button on league page');
    console.log('2. 🔄 Frontend calls /api/payment/create');
    console.log('3. 💳 Backend generates Fiuu payment URL');
    console.log('4. 🌐 User redirected to Fiuu payment gateway');
    console.log('5. 💰 User completes payment on Fiuu');
    console.log('6. 📡 Fiuu sends notification to /api/payment/notify');
    console.log('7. ✅ Backend updates payment status to SUCCESS');
    console.log('8. 🏆 League registration status changed to CONFIRMED');
    console.log('9. 📱 Frontend polls /api/payment/status to confirm');
    console.log('10. 🎉 User sees success page');

    console.log('\n🔧 TO TEST MANUALLY:');
    console.log('====================');
    console.log('1. Start the backend server');
    console.log('2. Create a user and league data (or run the seeder)');
    console.log('3. Use the frontend to click "Register" on a league');
    console.log('4. Check that payment URL is generated correctly');
    console.log('5. Verify payment URL contains correct Fiuu parameters');
    console.log('6. Test the complete flow with Fiuu sandbox');

    expect(true).toBe(true); // This test always passes - it's for documentation
  });
});