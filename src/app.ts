import express from 'express';
import cors from 'cors';
import exampleRouter from './routes/authRoute';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/example', exampleRouter);

export default app;
