import { prisma } from "../lib/prisma";
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../app';


describe('Onboarding Profile Routes', () => {
  let testUserId: string;
  
  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        emailVerified: false
      }
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.delete({
      where: { id: testUserId }
    });
    await prisma.$disconnect();
  });

  describe('PUT /api/onboarding/profile/:userId', () => {
    it('should update user profile successfully', async () => {
      const profileData = {
        name: 'Updated Test User',
        gender: 'male',
        dateOfBirth: '1990-01-01'
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.name).toBe('Updated Test User');
      expect(response.body.user.gender).toBe('male');
      expect(response.body.user.dateOfBirth).toBe('1990-01-01T00:00:00.000Z');
    });

    it('should return 400 for invalid name', async () => {
      const profileData = {
        name: 'A', // Too short
        gender: 'male',
        dateOfBirth: '1990-01-01'
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Name must be at least 2 characters');
    });

    it('should return 400 for invalid gender', async () => {
      const profileData = {
        name: 'Test User',
        gender: 'invalid', // Invalid gender
        dateOfBirth: '1990-01-01'
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Gender must be either "male" or "female"');
    });

    it('should return 400 for invalid date format', async () => {
      const profileData = {
        name: 'Test User',
        gender: 'male',
        dateOfBirth: 'invalid-date'
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date format');
    });

    it('should return 400 for users under 13 years old', async () => {
      const currentYear = new Date().getFullYear();
      const tooYoungDate = `${currentYear - 10}-01-01`; // 10 years old
      
      const profileData = {
        name: 'Test User',
        gender: 'male',
        dateOfBirth: tooYoungDate
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('User must be at least 13 years old');
    });

    it('should return 404 for non-existent user', async () => {
      const profileData = {
        name: 'Test User',
        gender: 'male',
        dateOfBirth: '1990-01-01'
      };

      const response = await request(app)
        .put('/api/onboarding/profile/non-existent-id')
        .send(profileData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/onboarding/profile/:userId', () => {
    it('should fetch user profile successfully', async () => {
      const response = await request(app)
        .get(`/api/onboarding/profile/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUserId);
      expect(response.body.user.name).toBeDefined();
      expect(response.body.user.email).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/onboarding/profile/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Profile Data Validation', () => {
    it('should handle missing fields gracefully', async () => {
      const profileData = {
        name: 'Test User'
        // Missing gender and dateOfBirth
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Gender must be either');
    });

    it('should trim whitespace from name', async () => {
      const profileData = {
        name: '  Whitespace Test  ',
        gender: 'female',
        dateOfBirth: '1985-05-15'
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(200);

      expect(response.body.user.name).toBe('Whitespace Test');
    });

    it('should accept valid age (exactly 13 years old)', async () => {
      const today = new Date();
      const thirteenYearsAgo = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
      
      const profileData = {
        name: 'Thirteen Year Old',
        gender: 'male',
        dateOfBirth: thirteenYearsAgo.toISOString().split('T')[0]
      };

      const response = await request(app)
        .put(`/api/onboarding/profile/${testUserId}`)
        .send(profileData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});