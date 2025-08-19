import express from 'express';
import cors from 'cors';
import exampleRouter from './routes/authRoute';
import onboardingRouter from './routes/onboarding';

const app = express();

app.use(cors());
app.use(express.json());

console.log('Backend running...');

// Routes
app.use('/api/example', exampleRouter);
app.use('/api/onboarding', onboardingRouter);

export default app;
