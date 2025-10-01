# instana-otel-extractor
Extract OTEL Signals from Instana

This is an example of how to extract OTEL Signals from Instana and send them to an OTEL collector for processing.

# Requirements
## Instana
This is a Node.js application that uses the [Instana REST API's](https://www.ibm.com/docs/en/instana-observability/current?topic=apis-instana-rest-api) to pull the [OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/). To access the API you need to provide the following values in an `.env` file.
1. `BASE_DOMAIN` - Your Instana Base Domain name.
2. `API_TOKEN` - Your Instana API Token.

See the [.env.example](./env.example) file

## Node
This is a Node.js application using TypeScript. 
1. [Download and instal Node](https://nodejs.org/en/download)  
2. Install the node modules with command `npm install`

# Running the application

## Start the server
The application exposes REST APIs used to retrieve the OpenTelemetry signles from Instana.  Execute the command `npx tsx app.ts` to execute the program

## Pull the signels
The application exposes two endpoints to retrive the signels.
1. `/infrastructure/metrics?startTime=5000` Retrieves the metrics
2. `/traces?startTime=20000` Retrieves the traces.

The startTime is Epoch/Unix timestamp that specifies how far back in time the signels should be retrieved.  For example `startTime=5000` is 5 minutes so it will query for signels that occured in the last 5 minutes.

# Exporting the Signels
Current the application is configured the to send the signels to the console.  Update the [instrumentation.ts](./instrumentation.ts) file to send the signels to your OpenTelemetry collector.  See the [Exporters usage with Node.js](https://opentelemetry.io/docs/languages/js/exporters/#usage-with-nodejs) for an example to configure.
