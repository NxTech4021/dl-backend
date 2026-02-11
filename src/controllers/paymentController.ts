import { Request, Response } from "express";
import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import * as paymentService from "../services/paymentService";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { getFiuuConfig } from "../config/fiuu";
import {
  buildCheckoutPayload,
  formatAmount,
  generateOrderId,
  resolvePaymentStatus,
  verifyNotificationSignature,
} from "../services/payment/fiuuGateway";


export const getPayments = async (req: Request, res: Response) => {
  try {
    const { status, amountMin, amountMax, page, limit } = req.query;

    // Parse pagination parameters
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;
    const skip = (pageNum - 1) * limitNum;
    const take = Math.min(limitNum, 100); // Max 100 items

    // Build where clause
    const where: any = {};
    if (status) where.status = status as PaymentStatus;
    if (amountMin || amountMax) {
      where.amount = {};
      if (amountMin) where.amount.gte = parseFloat(amountMin as string);
      if (amountMax) where.amount.lte = parseFloat(amountMax as string);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          season: { select: { id: true, name: true } },
          seasonMembership: {
            select: {
              id: true,
              paymentStatus: true,
              status: true,
              user: { select: { id: true, name: true, email: true } },
              season: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    // Transform for frontend
    const transformedPayments = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt,
      notes: payment.notes,
      seasonMembership: payment.seasonMembership,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    const pagination = {
      page: pageNum,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    };

    if (transformedPayments.length === 0) {
      return sendPaginated(res, transformedPayments, pagination, "No payments found");
    }

    return sendPaginated(res, transformedPayments, pagination, "Payments fetched successfully");
  } catch (error) {
    console.error("Error fetching payments:", error);
    return sendError(res, "Error fetching payments", 500);
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Payment ID is required", 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        season: { select: { id: true, name: true } },
        seasonMembership: {
          select: {
            id: true,
            paymentStatus: true,
            status: true,
            user: { select: { id: true, name: true, email: true } },
            season: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!payment) {
      return sendError(res, "Payment not found", 404);
    }

    // Transform for detailed view
    const transformedPayment = {
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt,
      notes: payment.notes,
      seasonMembership: payment.seasonMembership,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };

    return sendSuccess(res, transformedPayment, "Payment details fetched successfully");
  } catch (error: any) {
    console.error("Error fetching payment:", error);
    return sendError(res, "Error fetching payment", 500);
  }
};

export const createPayment = async (req: Request, res: Response) => {
  try {
    const { amount, paymentMethod, status, notes } = req.body;

    if (!amount) {
      return sendError(res, "Missing required field: amount", 400);
    }

    if (status && !Object.values(PaymentStatus).includes(status)) {
      return sendError(res, `Invalid status provided. Must be one of: ${Object.values(PaymentStatus).join(', ')}`, 400);
    }

    // Use service for business logic
    const newPayment = await paymentService.createPayment({
      amount: parseFloat(amount),
      paymentMethod,
      status,
      notes,
    });

    return sendSuccess(res, newPayment, "Payment created successfully", 201);
  } catch (error: any) {
    console.error("Create payment error:", error);
    return sendError(res, "Error creating payment", 500);
  }
};

export const updatePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Payment ID is required", 400);
    }

    const updateData = { ...req.body };

    // Convert amount to number if provided
    if (updateData.amount) {
      updateData.amount = parseFloat(updateData.amount);
    }

    // Validate status if provided
    if (updateData.status && !Object.values(PaymentStatus).includes(updateData.status)) {
      return sendError(res, `Invalid status provided. Must be one of: ${Object.values(PaymentStatus).join(', ')}`, 400);
    }

    // Use service for business logic
    const updatedPayment = await paymentService.updatePayment(id, updateData);

    return sendSuccess(res, updatedPayment, "Payment updated successfully");
  } catch (error: any) {
    console.error("Error updating payment:", error);
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    }
    return sendError(res, "Error updating payment", 500);
  }
};

export const markPaymentAsPaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Payment ID is required", 400);
    }

    // Use service for business logic
    const updatedPayment = await paymentService.markPaymentAsPaid(id);

    return sendSuccess(res, updatedPayment, "Payment marked as paid successfully");
  } catch (error: any) {
    console.error("Error marking payment as paid:", error);
    if (error.message.includes('not found') || error.message.includes('already marked')) {
      return sendError(res, error.message, 400);
    }
    return sendError(res, "Error marking payment as paid", 500);
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Payment ID is required", 400);
    }

    // Use service for business logic
    await paymentService.deletePayment(id);

    return sendSuccess(res, null, "Payment deleted successfully");
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    if (error.message.includes('Cannot delete')) {
      return sendError(res, error.message, 400);
    } else if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    } else {
      return sendError(res, "Error deleting payment", 500);
    }
  }
};

export const createFiuuCheckout = async (req: Request, res: Response) => {
  const { userId, seasonId } = req.body as {
    userId?: string;
    seasonId?: string;
  };

  if (!userId || !seasonId) {
    return sendError(res, "userId and seasonId are required.", 400);
  }

  try {
    const config = getFiuuConfig(req.get("x-forwarded-host") || req.get("host"));

    const [user, season, existingMembership] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phoneNumber: true },
      }),
      prisma.season.findUnique({
        where: { id: seasonId },
        select: {
          id: true,
          name: true,
          entryFee: true,
          paymentRequired: true,
          isActive: true,
          startDate: true,
          regiDeadline: true,
          status: true,
        },
      }),
      prisma.seasonMembership.findFirst({
        where: { userId, seasonId },
      }),
    ]);

    if (!user) {
      return sendError(res, "User not found.", 404);
    }

    if (!season) {
      return sendError(res, "Season not found.", 404);
    }

    if (!season.paymentRequired) {
      return sendError(res, "This season does not require payment.", 400);
    }

    if (!season.entryFee) {
      return sendError(res, "Season entry fee is not configured.", 400);
    }

    // Block if already fully paid/active
    if (existingMembership?.paymentStatus === PaymentStatus.COMPLETED) {
      return sendError(res, "Payment already completed for this season.", 400);
    }

    // Do not auto-register; only create payment intent. Membership will be created on successful payment.
    const membershipId = existingMembership?.id;

    const amount = formatAmount(season.entryFee);
    const existingPayment = await prisma.payment.findFirst({
      where: {
        userId,
        seasonId,
        paymentMethod: "FIUU",
        status: PaymentStatus.PENDING,
      },
    });

    const orderId = existingPayment?.orderId ?? generateOrderId("DL");
    const callbackBase = config.callbackBaseUrl.replace(/\/$/, "");

    const checkout = buildCheckoutPayload({
      config,
      amount,
      orderId,
      description: `${season.name} Entry Fee`,
      customer: {
        name: user.name,
        email: user.email,
        phone: user.phoneNumber,
      },
      returnUrl: `${callbackBase}/api/payments/fiuu/return`,
      notificationUrl: `${callbackBase}/api/payments/fiuu/ipn`,
      callbackUrl: `${callbackBase}/api/payments/fiuu/ipn`,
    });

    const sharedMetadata: Prisma.JsonObject = {
      ...(existingPayment?.metadata as Prisma.JsonObject | undefined),
      checkout: checkout.params,
      lastGeneratedAt: new Date().toISOString(),
    };

    const paymentRecord = existingPayment
      ? await prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: new Prisma.Decimal(amount),
            currency: "MYR",
            status: PaymentStatus.PENDING,
            paymentMethod: "FIUU",
            metadata: sharedMetadata,
          },
        })
      : await prisma.payment.create({
          data: {
            orderId,
            amount: new Prisma.Decimal(amount),
            currency: "MYR",
            status: PaymentStatus.PENDING,
            paymentMethod: "FIUU",
            user: { connect: { id: user.id } },
            season: { connect: { id: season.id } },
            metadata: sharedMetadata,
          },
        });

    return sendSuccess(
      res,
      {
        paymentId: paymentRecord.id,
        orderId: paymentRecord.orderId,
        amount,
        currency: "MYR",
        membershipId,
        checkout,
      },
      "FIUU checkout generated successfully.",
      201,
    );
  } catch (error) {
    console.error("Error creating FIUU checkout:", error);
    return sendError(res, "Failed to start FIUU payment.", 500);
  }
};

export const handleFiuuReturn = async (req: Request, res: Response) => {
  const payload = { ...req.query, ...req.body };
  const config = getFiuuConfig(req.get("x-forwarded-host") || req.get("host"));
  const orderId = (payload.orderid || payload.order_id) as string | undefined;

  if (!orderId) {
    return res
      .status(400)
      .send(renderReturnPage(PaymentStatus.FAILED, "Missing order reference."));
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { orderId } });

    if (!payment) {
      return res
        .status(404)
        .send(renderReturnPage(PaymentStatus.FAILED, "Payment not found."));
    }

    const verified = verifyNotificationSignature(payload, config);

    // SECURITY: Reject if signature verification fails
    if (!verified) {
      console.error('SECURITY: Payment return signature verification failed', {
        orderId,
        paymentId: payment.id,
        ip: req.ip || req.connection?.remoteAddress,
        timestamp: new Date().toISOString(),
      });
      return res.status(200).send(
        renderReturnPage(PaymentStatus.FAILED, "Payment verification failed. Please contact support if you believe this is an error.")
      );
    }

    // Only proceed with payment update if signature verification passes
    const status = resolvePaymentStatus(payload);
    await updatePaymentFromGateway(payment.id, status, payload, verified);

    const message =
      status === PaymentStatus.COMPLETED
        ? "Payment successful! You can return to the Deuce League app."
        : status === PaymentStatus.PENDING
        ? "Payment is pending confirmation. Please check back later."
        : "Payment was not completed. You can retry from the app.";

    return res
      .status(200)
      .send(renderReturnPage(status, message, payment.orderId));
  } catch (error) {
    console.error("Error handling FIUU return:", error);
    return res
      .status(500)
      .send(renderReturnPage(PaymentStatus.FAILED, "Internal server error."));
  }
};

export const handleFiuuNotification = async (req: Request, res: Response) => {
  const payload = { ...req.body, ...req.query };
  const config = getFiuuConfig(req.get("x-forwarded-host") || req.get("host"));
  const orderId = (payload.orderid || payload.order_id) as string | undefined;

  if (!orderId) {
    return res.status(400).send("Missing order reference.");
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { orderId } });

    if (!payment) {
      return res.status(404).send("Payment not found.");
    }

    const verified = verifyNotificationSignature(payload, config);

    // SECURITY: Reject requests that fail signature verification
    if (!verified) {
      console.error('SECURITY: Payment webhook signature verification failed', {
        orderId,
        paymentId: payment.id,
        ip: req.ip || req.connection?.remoteAddress,
        timestamp: new Date().toISOString(),
      });
      return sendError(res, "Invalid signature", 403);
    }

    // Only proceed with payment update if signature verification passes
    const status = resolvePaymentStatus(payload);
    await updatePaymentFromGateway(payment.id, status, payload, verified);

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing FIUU notification:", error);
    return res.status(500).send("ERROR");
  }
};

function renderReturnPage(
  status: PaymentStatus,
  message: string,
  orderId?: string,
): string {
  const statusText = status === PaymentStatus.COMPLETED ? "success" : status.toLowerCase();
  const payload = JSON.stringify({ status, message, orderId });

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Payment ${statusText}</title>
      <style>
        body { font-family: "Inter", system-ui, -apple-system, sans-serif; background: #f9fafb; color: #111827; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 0 16px; }
        .card { background: #fff; border-radius: 16px; padding: 32px 28px; text-align: center; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); }
        .card h1 { margin: 0 0 12px; font-size: 24px; color: ${status === PaymentStatus.COMPLETED ? "#059669" : "#b91c1c"}; }
        .card p { margin: 0 0 24px; font-size: 16px; line-height: 1.5; color: #374151; }
        .card button { appearance: none; border: none; border-radius: 999px; padding: 12px 24px; font-weight: 600; font-size: 15px; cursor: pointer; background: #4f46e5; color: #fff; transition: background 0.2s ease; }
        .card button:hover { background: #4338ca; }
        .order { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${status === PaymentStatus.COMPLETED ? "Payment Successful" : "Payment Update"}</h1>
        ${orderId ? `<div class="order">Reference: ${orderId}</div>` : ""}
        <p>${message}</p>
        <button onclick="closeWindow()">Back to App</button>
      </div>
      <script>
        function closeWindow() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage('${payload}');
          }
          window.location.href = 'https://expo.dev';
        }
        closeWindow();
      </script>
    </body>
  </html>`;
}

async function updatePaymentFromGateway(
  paymentId: string,
  status: PaymentStatus,
  payload: Record<string, any>,
  verified: boolean,
) {
  // Use interactive transaction to ensure atomicity of all payment and membership updates
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return;
    }

    const existingMetadata = (payment.metadata as Prisma.JsonObject | undefined) || {};
    const metadata: Prisma.JsonObject = {
      ...existingMetadata,
      lastNotification: payload,
      verified,
      lastUpdatedAt: new Date().toISOString(),
    };

    const updateData: Prisma.PaymentUpdateInput = {
      status,
      fiuuTransactionId:
        (payload.tranID as string) ||
        (payload.transaction_id as string) ||
        payment.fiuuTransactionId ||
        null,
      fiuuChannel: (payload.channel as string) || payment.fiuuChannel || null,
      fiuuStatusCode:
        (payload.status as string) || (payload.stat as string) || payment.fiuuStatusCode || null,
      fiuuMessage:
        (payload.errdesc as string) ||
        (payload.error_desc as string) ||
        payment.fiuuMessage ||
        null,
      verificationHash: verified ? "VERIFIED" : "UNVERIFIED",
      metadata,
    };

    if (status === PaymentStatus.COMPLETED && !payment.paidAt) {
      updateData.paidAt = new Date();
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: updateData,
    });

    // If membership is not yet linked and payment is completed, create it now.
    let membershipId = payment.seasonMembershipId;
    if (!membershipId && status === PaymentStatus.COMPLETED && payment.userId && payment.seasonId) {
      // Create membership and increment counter atomically within the transaction
      const membership = await tx.seasonMembership.create({
        data: {
          status: "ACTIVE",
          paymentStatus: PaymentStatus.COMPLETED,
          user: { connect: { id: payment.userId } },
          season: { connect: { id: payment.seasonId } },
        },
        include: {
          user: true,
          season: true,
        },
      });

      await tx.season.update({
        where: { id: payment.seasonId },
        data: { registeredUserCount: { increment: 1 } },
      });

      // Link payment to the newly created membership
      await tx.payment.update({
        where: { id: paymentId },
        data: { seasonMembershipId: membership.id },
      });

      membershipId = membership.id;
    }

    if (!membershipId) return;

    const membershipUpdate: Prisma.SeasonMembershipUpdateInput = {
      paymentStatus:
        status === PaymentStatus.CANCELLED
          ? PaymentStatus.PENDING
          : status,
    };

    if (status === PaymentStatus.COMPLETED) {
      membershipUpdate.status = "ACTIVE";
    } else if (status === PaymentStatus.FAILED || status === PaymentStatus.CANCELLED) {
      membershipUpdate.status = "PENDING";
    }

    await tx.seasonMembership.update({
      where: { id: membershipId },
      data: membershipUpdate,
    });
  });
}
