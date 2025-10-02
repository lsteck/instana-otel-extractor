
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer("Instana OTEL SDK Tracer");


class UniqueTraceArray extends Array {
  constructor(array) {
    super();
    array.forEach(a => {
      if (!this.find(v => v.trace.id === a.trace.id)) this.push(a);
    });
  }
}


const getTraceBlock = async (throttle, startTime, ingestionTime, offset) => {
  const baseDomain = process.env.BASE_DOMAIN;
  const apiToken = process.env.API_TOKEN;
  const headers = new Headers({
    'Content-Type': 'application/json',
    'authorization': `apiToken ${apiToken}`
  });

  try {
    const response = await throttle(() => {
      const body = {
        "includeInternal": false,
        "includeSynthetic": false,
        "tagFilterExpression": {
          "type": "EXPRESSION",
          "logicalOperator": "AND",
          "elements": [
            {
              "type": "TAG_FILTER",
              "name": "application.name",
              "operator": "EQUALS",
              "entity": "DESTINATION",
              "value": "All Services"
            }
          ]
        },
        "order": {
          "by": "traceLabel",
          "direction": "DESC"
        }
      }
      if (ingestionTime) {
        body.pagination = {
          "ingestionTime": ingestionTime,
          "offset": offset
        };
      } else {
        body.timeFrame = {
          "windowSize": startTime
        };
      }

      return fetch(`${baseDomain}/api/application-monitoring/analyze/traces`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
    });
    if (!response.ok) {
      console.log('Got error');
      console.log(response.status);
      console.log(response.err);
      throw new Error('error getting traces');
    };
    const data = await response.json();
    return data;
  } catch (err) {
    console.log("getTraceBlock error");
    console.log(err);
  }
};

// Get all Trace IDs
// https://instana.github.io/openapi/#operation/getTraces
// Traces are returned in blocks
const getTraces = async (throttle, startTime) => {
  let ingestionTime = null;
  let offset = null;
  let traces = new Array();
  try {
    let block = null;
    do {
      block = await getTraceBlock(throttle, startTime, ingestionTime, offset);
      if (block.items.length > 0) {
        traces = traces.concat(block.items);
        ingestionTime = block.items[block.items.length - 1].cursor.ingestionTime;
        offset = block.items[block.items.length - 1].cursor.offset;
        startOffset = block.items[0].cursor.offset;
      };
    } while (block.canLoadMore);
    return traces;
  } catch (err) {
    console.log("getTraces error");
    console.log(err);
  }

};

// Get the trace details (spans) for a trace id
// https://instana.github.io/openapi/#operation/getTraceDownload
async function getTraceSpans(throttle, traceId: string) {
  const baseDomain = process.env.BASE_DOMAIN;
  const apiToken = process.env.API_TOKEN;
  const headers = new Headers({
    'Content-Type': 'application/json',
    'authorization': `apiToken ${apiToken}`
  });

  try {
    const response = await throttle(() => {
      return fetch(`${baseDomain}/api/application-monitoring/v2/analyze/traces/${traceId}`, {
        method: 'GET',
        headers: headers
      });
    });
    if (!response.ok) {
      console.log('Got error');
      console.log(response.status);
      console.log(response.err);
      throw new Error('error getting trace spans');
    };
    const data = await response.json();
    return data.items;
  } catch (err) {
    console.log("getTraceSpans error");
    console.log(err);
  }

}

function exportSpan(traceId: string, instanaSpan: Array<any>) {
  const span = tracer.startSpan(instanaSpan.name,
    {
      attributes: {
        'instana.traceId': traceId,
        'instana.spanId': instanaSpan.id,
        'instana.timestamp': instanaSpan.timestamp,
        'instana.parentSpanId': instanaSpan.parentId,
        'instana.foreignParentId': instanaSpan.foreignParentId,
        'instana.duration': instanaSpan.duration,
        'instana.minSelfTime': instanaSpan.minSelfTime,
        'instana.networkTime': instanaSpan.networkTime,
        'instana.callCount': instanaSpan.callCount,
        'instana.errorCount': instanaSpan.errorCount
      }
    }
  );
  span.end();
}

async function exportSpans(throttle, traces: Array<any>) {
  traces.forEach(async traceItem => {
    const spans = await getTraceSpans(throttle, traceItem.trace.id);
    spans.forEach(span => {
      exportSpan(traceItem.trace.id, span);
    });
  });
}


export async function exportTraces(throttle, startTime) {
  let traces = await getTraces(throttle, startTime);
  let uniqueTraces = new UniqueTraceArray(traces);
  await exportSpans(throttle, uniqueTraces);
}
