import express from 'express';
import { getExample } from '../controllers/authController';

const router = express.Router();

router.get('/', getExample);

export default router;
