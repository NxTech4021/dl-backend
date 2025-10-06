import { Router } from "express";
import {
  createSponsorship,
  getSponsorships,
  getSponsorshipById,
  updateSponsorship,
  deleteSponsorship,
} from "../controllers/sponsorController";

const sponsorRoutes = Router();

sponsorRoutes.post("/create", createSponsorship);
sponsorRoutes.get("/", getSponsorships);
sponsorRoutes.get("/:id", getSponsorshipById);
sponsorRoutes.put("/:id", updateSponsorship);
sponsorRoutes.delete("/:id", deleteSponsorship);

export default sponsorRoutes;
