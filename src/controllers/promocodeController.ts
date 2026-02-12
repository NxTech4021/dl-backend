import { prisma } from "../lib/prisma";
import { PrismaClient, Prisma } from '@prisma/client';
import { Request, Response } from "express";
import { sendSuccess, sendError } from '../utils/response';

export const createPromoCode = async (req: Request, res: Response) => {
    const { code, discountValue, isPercentage, expiresAt, description, seasonIds } = req.body;

    if (!code || !discountValue) {
        return sendError(res, "Missing required fields: code and discountValue.", 400);
    }

    try {
        const data: Prisma.PromoCodeCreateInput = {
            code,
            discountValue: new Prisma.Decimal(discountValue),
            isPercentage: isPercentage ?? false,
        };

        if (expiresAt) {
            data.expiresAt = new Date(expiresAt);
        }

        if (description) {
            data.description = description;
        }

        // Connect to existing seasons if seasonIds are provided
        if (seasonIds && Array.isArray(seasonIds) && seasonIds.length > 0) {
            data.seasons = { connect: seasonIds.map((id: string) => ({ id })) };
        }

        const newPromoCode = await prisma.promoCode.create({
            data,
        });
        sendSuccess(res, newPromoCode, undefined, 201);
    } catch (error: any) {
        console.error('Error creating promo code:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2002: Unique constraint failed (e.g., if code is duplicated)
            if (error.code === 'P2002') {
                return sendError(res, `Promo code '${code}' already exists.`, 409);
            }
        }
        if (error instanceof Prisma.PrismaClientValidationError) {
            return sendError(res, "Invalid data format or type for promo code creation.", 400);
        }
        sendError(res, 'Failed to create promo code.');
    }
};

export const linkPromoCodeToSeason = async (req: any, res: any) => {
    const { seasonId, code } = req.params;

    try {
        // 1. Check if the Season and PromoCode exist
        const season = await prisma.season.findUnique({ where: { id: seasonId } });
        const promoCode = await prisma.promoCode.findUnique({ where: { code: code } });

        if (!season) return sendError(res, "Season not found.", 404);
        if (!promoCode) return sendError(res, "Promo Code not found.", 404);

        // 2. Link them using the many-to-many relationship
        const updatedSeason = await prisma.season.update({
            where: { id: seasonId },
            data: {
                promoCodes: {
                    connect: { id: promoCode.id } // Connects by ID is safer than unique code field
                },
                promoCodeSupported: true // Set the flag
            },
            include: { promoCodes: true }
        });

        sendSuccess(res, updatedSeason);
    } catch (error: any) {
        console.error(`Error linking promo code ${code} to season ${seasonId}:`, error);
        sendError(res, 'Failed to link promo code.');
    }
};