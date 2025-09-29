import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(); 

export const createSeason = async (req: any, res: any) => {
    const { name, startDate, endDate, sport, description } = req.body;

    // Basic validation
    if (!name || !startDate || !endDate || !sport) {
        return res.status(400).json({ error: "Missing required fields: name, startDate, endDate, and sport." });
    }

    try {
        // Optionally, check if a season with the same name already exists
        const existingSeason = await prisma.season.findUnique({
            where: { name_sport: { name, sport } } 
        });

        if (existingSeason) {
            return res.status(400).json({ error: "A season with this name already exists for this sport." });
        }
        
        const newSeason = await prisma.season.create({
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                sport,
                description,
                status: 'UPCOMING', 
            },
        });

        res.status(201).json(newSeason);
    } catch (error) {
        console.error("Error creating season:", error);
        res.status(500).json({ error: "Failed to create season." });
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
    } catch (error) {
        console.error("Error fetching seasons:", error);
        res.status(500).json({ error: "Failed to fetch seasons." });
    }
};


export const updateSeason = async (req: any, res: any) => {
    const { id } = req.params;
    const { name, startDate, endDate, status, description, current } = req.body;

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
    } catch (error) {
        // P2025 is the Prisma error code for a record not found during an update/delete
        if (error.code === 'P2025') {
            return res.status(404).json({ error: "Season not found for update." });
        }
        console.error("Error updating season:", error);
        res.status(500).json({ error: "Failed to update season." });
    }
};