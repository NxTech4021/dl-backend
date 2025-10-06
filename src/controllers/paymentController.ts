import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import * as paymentService from '../services/paymentService';
import { ApiResponse } from '../utils/ApiResponse';

const prisma = new PrismaClient();

export const getPayments = async (req: Request, res: Response) => {
  try {
    const { status, amountMin, amountMax } = req.query;

    // Build where clause
    const where: any = {};
    if (status) where.status = status as PaymentStatus;
    if (amountMin || amountMax) {
      where.amount = {};
      if (amountMin) where.amount.gte = parseFloat(amountMin as string);
      if (amountMax) where.amount.lte = parseFloat(amountMax as string);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        registrations: {
          include: {
            player: {
              select: {
                name: true,
                email: true
              }
            },
            team: {
              select: {
                name: true
              }
            },
            season: {
              select: {
                name: true,
                league: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform for frontend
    const transformedPayments = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt,
      notes: payment.notes,
      registrations: payment.registrations,
      registrationCount: payment.registrations.length,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    if (transformedPayments.length === 0) {
      return res.status(200).json(
        new ApiResponse(true, 200, [], "No payments found")
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, transformedPayments, "Payments fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching payments:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching payments")
    );
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            team: {
              select: {
                id: true,
                name: true
              }
            },
            season: {
              select: {
                id: true,
                name: true,
                league: {
                  select: {
                    name: true,
                    sport: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            },
            division: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, 'Payment not found')
      );
    }

    // Transform for detailed view
    const transformedPayment = {
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt,
      notes: payment.notes,
      registrations: payment.registrations,
      registrationCount: payment.registrations.length,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };

    return res.status(200).json(
      new ApiResponse(true, 200, transformedPayment, "Payment details fetched successfully")
    );
  } catch (error: any) {
    console.error("Error fetching payment:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching payment")
    );
  }
};

export const createPayment = async (req: Request, res: Response) => {
  try {
    const { amount, paymentMethod, status, notes } = req.body;

    if (!amount) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, 'Missing required field: amount')
      );
    }

    if (status && !Object.values(PaymentStatus).includes(status)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, `Invalid status provided. Must be one of: ${Object.values(PaymentStatus).join(', ')}`)
      );
    }

    // Use service for business logic
    const newPayment = await paymentService.createPayment({
      amount: parseFloat(amount),
      paymentMethod,
      status,
      notes,
    });

    return res.status(201).json(
      new ApiResponse(true, 201, newPayment, "Payment created successfully")
    );
  } catch (error: any) {
    console.error("Create payment error:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error creating payment")
    );
  }
};

export const updatePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Convert amount to number if provided
    if (updateData.amount) {
      updateData.amount = parseFloat(updateData.amount);
    }

    // Validate status if provided
    if (updateData.status && !Object.values(PaymentStatus).includes(updateData.status)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, `Invalid status provided. Must be one of: ${Object.values(PaymentStatus).join(', ')}`)
      );
    }

    // Use service for business logic
    const updatedPayment = await paymentService.updatePayment(id, updateData);
    
    return res.status(200).json(
      new ApiResponse(true, 200, updatedPayment, "Payment updated successfully")
    );
  } catch (error: any) {
    console.error("Error updating payment:", error);
    if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error updating payment")
    );
  }
};

export const markPaymentAsPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use service for business logic
    const updatedPayment = await paymentService.markPaymentAsPaid(id);
    
    return res.status(200).json(
      new ApiResponse(true, 200, updatedPayment, "Payment marked as paid successfully")
    );
  } catch (error: any) {
    console.error("Error marking payment as paid:", error);
    if (error.message.includes('not found') || error.message.includes('already marked')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    }
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error marking payment as paid")
    );
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use service for business logic
    await paymentService.deletePayment(id);
    
    return res.status(200).json(
      new ApiResponse(true, 200, null, "Payment deleted successfully")
    );
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, error.message)
      );
    } else if (error.message.includes('not found')) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, error.message)
      );
    } else {
      return res.status(500).json(
        new ApiResponse(false, 500, null, "Error deleting payment")
      );
    }
  }
};