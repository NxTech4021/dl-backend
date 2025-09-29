import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient(); 

export const createSeason = async (req: any, res: any) => {
     const { 
        name, 
        startDate, 
        endDate, 
        regiDeadline,       
        sportType,        
        seasonType,         
        description 
    } = req.body;

    // Basic validation
    if (!name || !startDate || !endDate || !sportType) {
        return res.status(400).json({ error: "Missing required fields: name, startDate, endDate, and sport." });
    }

    try {
        // FIX: Use findFirst() instead of findUnique() for compound unique keys
        const existingSeason = await prisma.season.findFirst({
            where: { 
                name: name, 
                sportType: sportType 
            } 
        });

        if (existingSeason) {
            // Return 409 Conflict, since the record effectively exists
            return res.status(409).json({ error: "A season with this name and sport type already exists." });
        }
        const newSeason = await prisma.season.create({
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                regiDeadline: new Date(endDate),
                sportType,
                seasonType,
                description,
                status: 'UPCOMING', 
            },
        });

        res.status(201).json(newSeason);
    } catch (error: any) {
        console.error("Error creating season:", error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return res.status(409).json({ error: "Unique constraint failed. A season with this name and sport already exists." });
            }
        }
        if (error instanceof Prisma.PrismaClientValidationError) {
            return res.status(400).json({ error: "Invalid data format for season creation." });
        }
        res.status(500).json({ error: "Failed to create season. Please try again later." });
    }
};

export const getSeasons = async (req: any, res: any) => {
    const { id } = req.params;
    const { current } = req.query; 

    try {
        if (id) {
            // Fetch a single season by ID
            const season = await prisma.season.findUnique({
                where: { id },
                include: { divisions: true }
            });

            if (!season) {
                return res.status(404).json({ error: "Season not found." });
            }
            return res.status(200).json(season);
        }
        
        if (current === 'true') {
            // Fetch the currently active season
            const currentSeason = await prisma.season.findFirst({
                where: { current: true, status: 'ACTIVE' },
                include: { divisions: { select: { id: true, name: true } } }
            });
            
            if (!currentSeason) {
                return res.status(404).json({ error: "No active season found." });
            }
            return res.status(200).json(currentSeason);
        }

        // Fetch all seasons, ordered by start date (most recent first)
        const seasons = await prisma.season.findMany({
            orderBy: { startDate: 'desc' },
            select: { id: true, name: true, startDate: true, endDate: true, status: true, sport: true, current: true } 
        });

        res.status(200).json(seasons);
    } catch (error: any) {
        console.error("Error fetching seasons:", error);

        if (error instanceof Prisma.PrismaClientValidationError) {
            return res.status(400).json({ error: "Invalid query parameters for fetching seasons." });
        }
        res.status(500).json({ error: "Failed to fetch seasons. Please try again later." });
    }
};


export const updateSeason = async (req: any, res: any) => {
    const { id } = req.params;
    const { name, startDate, endDate, status, description, current } = req.body;

    if (!id) {
        return res.status(400).json({ error: "Missing required parameter: id." });
    }

    try {
        const updatedSeason = await prisma.season.update({
            where: { id },
            data: {
                name,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                status,
                description,
                current,
            },
        });

        res.status(200).json(updatedSeason);
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                return res.status(404).json({ error: "Season not found for update." });
            }
            if (error.code === 'P2002') {
                return res.status(409).json({ error: "Unique constraint failed. A season with this name and sport already exists." });
            }
        }
        if (error instanceof Prisma.PrismaClientValidationError) {
            return res.status(400).json({ error: "Invalid data format for season update." });
        }
        console.error("Error updating season:", error);
        res.status(500).json({ error: "Failed to update season. Please try again later." });
    }
};