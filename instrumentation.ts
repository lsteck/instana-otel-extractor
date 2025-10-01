/*instrumentation.ts*/
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter, NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
// remove resources attributes from traces
// import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

// This was in NodeSDK block below.
//   resource: resourceFromAttributes({
//     [ATTR_SERVICE_NAME]: 'Instana OTEL Exporter',
//     [ATTR_SERVICE_VERSION]: '1.0',
//   }),

const sdk = new NodeSDK({
  resource: undefined,
  resourceDetectors: undefined,
  traceExporter: new ConsoleSpanExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
  }),
});


export const startNodeSDK = () => {
  sdk.start();
};

const traceExporter = new ConsoleSpanExporter();
const traceProvider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'Instana OTEL Exporter',
    [ATTR_SERVICE_VERSION]: '1.0'
  }),
  spanProcessors: [new BatchSpanProcessor(traceExporter)]
});

export const getTracer = (serviceName: string) => {

  return traceProvider.getTracer(serviceName);

};

// const metricExporter = new OTLPMetricExporter(metricsOptions);
// const metricExporter = new OTLPMetricExporter();
// Console exporter worked just fine
const metricExporter = new ConsoleMetricExporter();
const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter
    }),
  ],
});

export const getMeter = (serviceName: string) => {

  return meterProvider.getMeter(serviceName);

};

// module.exports = {startNodeSDK};
