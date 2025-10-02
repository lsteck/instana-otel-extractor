import _ from 'lodash';

import { metrics } from '@opentelemetry/api';

// meter not set on Global scope yet. 
// const meter = metrics.getMeter("Instana OTEL Extractor");
let meter = null;

type Metric = {
    id: string,
    infraTagCategory: string,
    category: string,
    label: string,
    description: string,
    format: string
}

type InfraEntity = {
    name: string,
    metrics: Metric[]
};

const createEntities = (plugins): InfraEntity[] => {
    const entities: InfraEntity[] = new Array();
    plugins.forEach(plugin => {
        entities.push({
            name: plugin,
            metrics: []
        });
    });
    return entities;
}

// Get infrastructure entity types
const getInfraEntityTypes = async (throttle, startTime): Promise<InfraEntity[]> => {
    const baseDomain = process.env.BASE_DOMAIN;
    const apiToken = process.env.API_TOKEN;
    const headers = new Headers({
        'Content-Type': 'application/json',
        'authorization': `apiToken ${apiToken}`
    });

    try {

        const response = await throttle(() => {
            const body = {
                "tagFilterExpression": {
                    "type": "EXPRESSION",
                    "logicalOperator": "AND",
                    "elements": []
                },
                "timeFrame": {
                    "windowSize": startTime
                }
            };

            return fetch(baseDomain + '/api/infrastructure-monitoring/analyze/entity-types', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
        });

        if (!response.ok) {
            console.log('Got error');
            console.log(response.status);
            console.log(response.err);
            throw new Error('error getting entity types');
        };
        const data = await response.json();
        return createEntities(data?.plugins);
    } catch (err) {
        console.log("getInfraEntityTypes error");
        console.log(err);
    }
};


// Get the available metrics for infrastructure entity type
// https://instana.github.io/openapi/#operation/getAvailableMetrics
const getInfraEntityTypeMetrics = async (throttle, startTime, entityType) => {
    const baseDomain = process.env.BASE_DOMAIN;
    const apiToken = process.env.API_TOKEN;
    const headers = new Headers({
        'Content-Type': 'application/json',
        'authorization': `apiToken ${apiToken}`
    });

    try {

        const response = await throttle(() => {

            const body = {
                "tagFilterExpression": {
                    "type": "EXPRESSION",
                    "logicalOperator": "AND",
                    "elements": []
                },
                "timeFrame": {
                    "windowSize": startTime
                },
                "query": "",
                "type": entityType
            };

            return fetch(baseDomain + '/api/infrastructure-monitoring/analyze/metrics', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
        });

        if (!response.ok) {
            console.log('Got error');
            console.log(response.status);
            console.log(response.err);
            throw new Error('error getting entity metrics');
        };
        const data = await response.json();
        return data?.metrics;
    } catch (err) {
        console.log("InfraGetMetrics error");
        console.log(err);
    }
};

// Get the Metrics available for Entities (plugins)
const getMetrics = async (throttle: any, startTime: any, entity: InfraEntity) => {
    // const entityMetrics: Metric[] = new Array();
    const metrics = await getInfraEntityTypeMetrics(throttle, startTime, entity.name);
    if (metrics && metrics.length > 0) {
        metrics.forEach(m => {
            entity.metrics.push({
                id: m.id,
                infraTagCategory: m.infraTagCategory,
                category: m.category,
                label: m.label,
                description: m.description,
                format: m.format
            });
        })
    };
};

// Get the Metrics Types available for Entities (plugins)
const getInfraEntityMetricTypes = async (throttle, startTime, entityTypes: InfraEntity[]) => {
    await Promise.all(entityTypes.map(async entity => {
        await getMetrics(throttle, startTime, entity);
    }));
};

// Build Metrics Body for Metrics for Entity Type call
const buildMetricsBody = (metricsBlock: Metric[]) => {
    const metricsBody = new Array();
    // Max number of variables that can be passed into API is 10
    metricsBlock.forEach((metric, index) => {
        metricsBody.push(
            {
                "metric": metric.id,
                "aggregation": "PER_SECOND",
                "label": metric.label
            }
        );
    });
    return metricsBody;
};

const getInfraEntitysAndMetrics = async (throttle, startTime, entityType, metricsBlock: Metric[]) => {
    const metricsBody = buildMetricsBody(metricsBlock);
    const baseDomain = process.env.BASE_DOMAIN;
    const apiToken = process.env.API_TOKEN;
    const headers = new Headers({
        'Content-Type': 'application/json',
        'authorization': `apiToken ${apiToken}`
    });

    try {

        const response = await throttle(() => {

            const body = {
                "timeFrame": {
                    "windowSize": startTime
                },
                "tagFilterExpression": {
                    "type": "EXPRESSION",
                    "logicalOperator": "AND",
                    "elements": []
                },
                "pagination": {
                    "retrievalSize": 200
                },
                "type": entityType,
                "metrics": metricsBody,
                "order": {
                    "by": "label",
                    "direction": "ASC"
                }
            };


            return fetch(baseDomain + '/api/infrastructure-monitoring/analyze/entities', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
        });

        if (!response.ok) {
            console.log('Got error');
            console.log(response.status);
            console.log(response.err);
            throw new Error('error getting entitys and metrics', { "cause": response.status });
        };
        const data = await response.json();
        return data?.items;
    } catch (err) {
        console.log("getInfraEntitysAndMetrics error");
        console.log(err);
        if (err?.cause && err.cause === 429) {
            throw new Error("Rate Limit reached");
        }
    }
};



const OTELexportEntityMetric = (metricsBlock: Metric[], entityWithMetricValues) => {
    entityWithMetricValues.forEach(item => {
        if (!_.isEmpty(item.metrics)) {
            const metricKey = Object.keys(item.metrics)[0];
            const metricTime = item.metrics[metricKey][0][0];
            const metricValue = item.metrics[metricKey][0][1];
            const metric: Metric = metricsBlock.find(m => {
                return metricKey.startsWith(m.id);
            });
            entityWithMetricValues = {
                "plugin": item.plugin,
                "entity": item.label,
                "metric_name": metricKey,
                "metric_time": metricTime,
                "metric_value": metricValue,
                "metric_label": metric.label,
                "metric_description": metric.description,
                "metric_format": metric.format
            };
            const counter = meter.createUpDownCounter(entityWithMetricValues.metric_name,
                {
                    "description": entityWithMetricValues.metric_description,
                    "unit": entityWithMetricValues.metric_format
                });
            counter.add(entityWithMetricValues.metric_value);
        };
    });
}


// Get entities and requested metrics for infrastructure entity type
//https://instana.github.io/openapi/#operation/getEntities
const getAllInfraEntitiesAndMetrics = async (throttle, startTime, entityTypes: InfraEntity[]) => {
    entityTypes.forEach(async entity => {
        // API limits query to 10 metrics at a time
        for (let i = 0; i < entity.metrics?.length; i += 10) {
            const metricsBlock = entity.metrics.slice(i, i + 10);
            const entitiesAndMetricsItems = await getInfraEntitysAndMetrics(throttle, startTime, entity.name, metricsBlock);
            OTELexportEntityMetric(metricsBlock, entitiesAndMetricsItems);
        }

    });
};


export async function exportInfrastructureMetrics(throttle, startTime) {
    meter = metrics.getMeter("Instana OTEL Extractor");
    const entityTypes: Array<InfraEntity> = await getInfraEntityTypes(throttle, startTime);
    await getInfraEntityMetricTypes(throttle, startTime, entityTypes);
    await getAllInfraEntitiesAndMetrics(throttle, startTime, entityTypes);
    return;
}
