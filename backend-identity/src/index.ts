import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import identityRouter from './routes/identity';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const requiredEnv = ['EUID_PACKAGE_ID', 'AUTHORITY_ADDRESS'];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[warn] Missing env variable ${key}`);
  }
});

app.use(
  cors({
    origin: allowedOrigin ?? '*',
  })
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'identity-simulator' });
});

app.use('/kyc', identityRouter);

app.listen(port, () => {
  console.log(`[identity] listening on port ${port}`);
});
