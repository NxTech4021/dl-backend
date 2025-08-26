import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Create new user
router.post('/', async (req, res) => {
  try {
    const { name, gender, birthDate, email } = req.body;

    // Validate required fields
    if (!name || !gender || !birthDate || !email) {
      return res.status(400).json({ 
        error: 'Name, gender, birthDate, and email are required' 
      });
    }

    const user = await prisma.user.create({
      data: {
        name,
        gender,
        birthDate: new Date(birthDate),
        email
      }
    });

    res.json({ 
      message: 'User created successfully',
      user 
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { location: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
