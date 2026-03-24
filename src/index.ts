/**
 * VitaFleet Checkout Service
 * Main application entry point
 * 
 * This service handles payment processing using Stripe v3 PaymentIntents API
 */

import express from 'express';
import { paymentRouter } from './payments/payment-controller';
import { webhookRouter } from './webhooks/webhook-controller';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vitafleet-checkout-service',
    version: '2.0.0',
    api: 'Stripe v3 PaymentIntents',
  });
});

// Routes
app.use('/', paymentRouter);
app.use('/', webhookRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.info(`VitaFleet Checkout Service listening on port ${PORT}`);
    console.info(`API Documentation: http://localhost:${PORT}/health`);
  });
}

export default app;
