import { prisma } from "../lib/prisma";
import { PrismaClient, Prisma } from '@prisma/client';
import { Request, Response } from "express";

export const createPromoCode = async (req: Request, res: Response) => {
    const { code, discountValue, isPercentage, expiresAt, description, seasonIds } = req.body;

    if (!code || !discountValue) {
        return res.status(400).json({ error: "Missing required fields: code and discountValue." });
    }

    try {
        const newPromoCode = await prisma.promoCode.create({
            data: {
                code,
                discountValue: new Prisma.Decimal(discountValue),
                isPercentage: isPercentage ?? false,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                description,
                // Connect to existing seasons if seasonIds are provided
                seasons: seasonIds ? { connect: seasonIds.map((id: string) => ({ id })) } : undefined,
            },
        });
        res.status(201).json(newPromoCode);
    } catch (error: any) {
        console.error('Error creating promo code:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2002: Unique constraint failed (e.g., if code is duplicated)
            if (error.code === 'P2002') {
                return res.status(409).json({ error: `Promo code '${code}' already exists.` });
            }
        }
        if (error instanceof Prisma.PrismaClientValidationError) {
            return res.status(400).json({ error: "Invalid data format or type for promo code creation." });
        }
        res.status(500).json({ error: 'Failed to create promo code.' });
    }
};

export const linkPromoCodeToSeason = async (req: any, res: any) => {
    const { seasonId, code } = req.params;

    try {
        // 1. Check if the Season and PromoCode exist
        const season = await prisma.season.findUnique({ where: { id: seasonId } });
        const promoCode = await prisma.promoCode.findUnique({ where: { code: code } });

        if (!season) return res.status(404).json({ error: "Season not found." });
        if (!promoCode) return res.status(404).json({ error: "Promo Code not found." });

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

        res.status(200).json(updatedSeason);
    } catch (error: any) {
        console.error(`Error linking promo code ${code} to season ${seasonId}:`, error);
        res.status(500).json({ error: 'Failed to link promo code.' });
    }
};