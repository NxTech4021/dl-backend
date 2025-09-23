import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import paymentService from '../services/paymentService';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const createPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { seasonId, leagueId, amount, billDesc, userId: bodyUserId } = req.body;
    const userId = req.user?.id || bodyUserId; // Allow userId from body for testing

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated or userId not provided' });
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already registered for this season
    const existingRegistration = await prisma.leagueRegistration.findUnique({
      where: {
        userId_seasonId: {
          userId,
          seasonId
        }
      }
    });

    if (existingRegistration) {
      return res.status(400).json({ error: 'Already registered for this season' });
    }

    // Generate unique order ID
    const orderId = `DL-${Date.now()}-${uuidv4().substring(0, 8)}`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        orderId,
        amount: parseFloat(amount),
        billName: user.name,
        billEmail: user.email,
        billMobile: user.phoneNumber || '',
        billDesc,
        leagueId,
        seasonId,
        status: 'PENDING'
      }
    });

    // Create league registration record
    await prisma.leagueRegistration.create({
      data: {
        userId,
        seasonId,
        paymentId: payment.id,
        status: 'PENDING'
      }
    });

    // Create payment with Fiuu
    const paymentResponse = await paymentService.createPayment({
      amount: parseFloat(amount),
      orderId,
      billName: user.name,
      billEmail: user.email,
      billMobile: user.phoneNumber || '',
      billDesc,
      userId,
      leagueId,
      matchId: seasonId
    });

    // Update payment with URL
    await prisma.payment.update({
      where: { id: payment.id },
      data: { paymentUrl: paymentResponse.paymentUrl }
    });

    res.json({
      success: true,
      paymentUrl: paymentResponse.paymentUrl,
      orderId: paymentResponse.orderId,
      amount: paymentResponse.amount
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    // Provide more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to create payment',
      details: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const paymentReturn = async (req: Request, res: Response) => {
  try {
    const paymentData = req.query;

    // Verify payment return
    const isValid = paymentService.verifyPaymentReturn(paymentData);

    if (!isValid) {
      return res.redirect(`${process.env.BETTER_AUTH_URL}/payment-failed?error=invalid_signature`);
    }

    const { RefNo: orderId, Status } = paymentData as any;
    const status = paymentService.parsePaymentStatus(Status);

    // Update payment status
    const payment = await prisma.payment.update({
      where: { orderId },
      data: {
        status: status.toUpperCase() as any,
        fiuuResponse: paymentData,
        paidAt: status === 'success' ? new Date() : null,
        transactionId: (paymentData as any).TransID,
        authCode: (paymentData as any).AuthCode
      }
    });

    // Update registration status
    if (status === 'success') {
      await prisma.leagueRegistration.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'CONFIRMED' }
      });
    } else if (status === 'failed') {
      await prisma.leagueRegistration.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'PAYMENT_FAILED' }
      });
    }

    // Redirect based on status
    if (status === 'success') {
      res.redirect(`${process.env.BETTER_AUTH_URL}/payment-success?orderId=${orderId}`);
    } else {
      res.redirect(`${process.env.BETTER_AUTH_URL}/payment-failed?orderId=${orderId}&status=${status}`);
    }
  } catch (error) {
    console.error('Payment return error:', error);
    res.redirect(`${process.env.BETTER_AUTH_URL}/payment-failed?error=processing_error`);
  }
};

export const paymentNotify = async (req: Request, res: Response) => {
  try {
    const paymentData = req.body;

    // Verify payment notification
    const isValid = paymentService.verifyPaymentNotification(paymentData);

    if (!isValid) {
      return res.status(400).send('Invalid signature');
    }

    const { RefNo: orderId, Status, TransID, AuthCode } = paymentData;
    const status = paymentService.parsePaymentStatus(Status);

    // Update payment status
    const payment = await prisma.payment.update({
      where: { orderId },
      data: {
        status: status.toUpperCase() as any,
        fiuuResponse: paymentData,
        paidAt: status === 'success' ? new Date() : null,
        transactionId: TransID,
        authCode: AuthCode
      }
    });

    // Update registration status
    if (status === 'success') {
      await prisma.leagueRegistration.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'CONFIRMED' }
      });
    } else if (status === 'failed') {
      await prisma.leagueRegistration.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'PAYMENT_FAILED' }
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Payment notification error:', error);
    res.status(500).send('Error processing notification');
  }
};

export const getPaymentStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { userId: queryUserId } = req.query;
    const userId = req.user?.id || queryUserId as string; // Allow userId from query for testing

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated or userId not provided' });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        orderId,
        userId
      },
      include: {
        registrations: {
          include: {
            season: {
              include: {
                league: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      success: true,
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        registrations: payment.registrations
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

export const getUserPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const payments = await prisma.payment.findMany({
      where: { userId },
      include: {
        registrations: {
          include: {
            season: {
              include: {
                league: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      payments
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ error: 'Failed to get user payments' });
  }
};