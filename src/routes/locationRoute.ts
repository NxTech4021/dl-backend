import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Save user location
router.post('/:userId/location', async (req, res) => {
  try {
    console.log('=== LOCATION SAVE REQUEST ===');
    console.log('User ID:', req.params.userId);
    console.log('Request body:', req.body);
    
    const { userId } = req.params;
    const { country, state, city, latitude, longitude } = req.body;

    // Validate required fields
    if (!country || !state || !city) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Country, state, and city are required' 
      });
    }

    console.log('✅ Required fields validated');

    // Check if user exists
    console.log('🔍 Checking if user exists...');
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User found:', user.username);

    // Create or update user location
    console.log('💾 Saving location to database...');
    
    // Use type assertion to bypass TypeScript checking
    const userLocationModel = (prisma as any).userLocation;
    
    if (!userLocationModel) {
      throw new Error('userLocation model is not available in Prisma client');
    }
    
    const location = await userLocationModel.upsert({
      where: { userId: userId },
      update: {
        country,
        state,
        city,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        country,
        state,
        city,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null
      }
    });

    console.log('✅ Location saved successfully:', location);
    res.json({ 
      message: 'Location saved successfully',
      location 
    });

  } catch (error: any) {
    console.error('❌ Error saving location:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get user location
router.get('/:userId/location', async (req, res) => {
  try {
    const { userId } = req.params;

    const location = await (prisma as any).userLocation.findUnique({
      where: { userId: userId }
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ location });

  } catch (error) {
    console.error('Error getting location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user city only
router.get('/:userId/location/city', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await (prisma as any).userLocation.findUnique({
      where: { userId: userId },
      select: { city: true }
    });

    if (!result) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ city: result.city });
  } catch (error) {
    console.error('Error getting city:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user location
router.put('/:userId/location', async (req, res) => {
  try {
    const { userId } = req.params;
    const { country, state, city, latitude, longitude } = req.body;

    // Validate required fields
    if (!country || !state || !city) {
      return res.status(400).json({ 
        error: 'Country, state, and city are required' 
      });
    }

    const location = await (prisma as any).userLocation.update({
      where: { userId: userId },
      data: {
        country,
        state,
        city,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        updatedAt: new Date()
      }
    });

    res.json({ 
      message: 'Location updated successfully',
      location 
    });

  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
