/*instrumentation.ts*/
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import {metrics} from '@opentelemetry/api';

const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'Instana OTEL Extractor',
    [ATTR_SERVICE_VERSION]: '1.0',
});

const sdk = new NodeSDK({
  resource: resource,
  traceExporter: new ConsoleSpanExporter()
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: new ConsoleMetricExporter(),
  // Default is 60000ms (60 seconds). Set to 10 seconds for demonstrative purposes only.
  exportIntervalMillis: 10000,
});

const myServiceMeterProvider = new MeterProvider({
  resource: resource,
  readers: [metricReader],
});

export const startNodeSDK = () => {

  // Set this MeterProvider to be global to the app being instrumented.
  sdk.start();
  metrics.setGlobalMeterProvider(myServiceMeterProvider);
  console.log("sdk started");
};

// *****************
// Code above sets the tracer and metrics on the global scope
// Another approach is to create instances and export them from this module
// See code below
// *****************

// const traceExporter = new ConsoleSpanExporter();
// const traceProvider = new NodeTracerProvider({
//   resource: resourceFromAttributes({
//     [ATTR_SERVICE_NAME]: 'Instana OTEL Extractor',
//     [ATTR_SERVICE_VERSION]: '1.0'
//   }),
//   spanProcessors: [new BatchSpanProcessor(traceExporter)]
// });

// export const getTracer = (serviceName: string) => {

//   return traceProvider.getTracer(serviceName);

// };

// const metricExporter = new OTLPMetricExporter(metricsOptions);
// const metricExporter = new OTLPMetricExporter();
// Console exporter worked just fine
// const metricExporter = new ConsoleMetricExporter();
// const meterProvider = new MeterProvider({
//   readers: [
//     new PeriodicExportingMetricReader({
//       exporter: metricExporter
//     }),
//   ],
// });

// export const getMeter = (serviceName: string) => {

//   return meterProvider.getMeter(serviceName);

// };
