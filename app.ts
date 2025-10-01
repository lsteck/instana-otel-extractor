import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();

import express, { type Express } from 'express';
// import { getTracer } from './instrumentation';
//startNodeSDK();
// import { trace } from '@opentelemetry/api';
// const tracer = getTracer('Instana OTEL App');


import { exportTraces } from './traces';
import { exportInfrastructureMetrics } from './infrastructureMetrics';

import { throttledQueue, hours } from 'throttled-queue';
const throttle = throttledQueue({
  maxPerInterval: 5000,
  interval: hours(1),
  evenlySpaced: false,
});

const PORT: number = parseInt(process.env.PORT || '8080');
const app: Express = express();


app.get('/traces', async (req, res) => {
  try {

    let startTime = req.query.startTime ? parseInt(req.query.startTime.toString()) : NaN;
    if (isNaN(startTime)) {
      startTime = 20000;
    }
    console.log(`start: ${startTime}`);
    await exportTraces(throttle, startTime);
    res.send('processing');
  } catch (err) {
    return "Error exporting traces " + err;
  }

});



app.get('/infrastructure/metrics', async (req, res) => {
  try {

    let startTime = req.query.startTime ? parseInt(req.query.startTime.toString()) : NaN;
    if (isNaN(startTime)) {
      startTime = 5000;
    }
    console.log(`start: ${startTime}`);
    const entittyTypes = await exportInfrastructureMetrics(throttle, startTime);
    res.send('processing');
  } catch (err) {
    return "Error exporting infrastructure metrics " + err;
  }

});


app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
