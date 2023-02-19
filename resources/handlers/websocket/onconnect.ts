import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Logger } from '@aws-lambda-powertools/logger';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const { CONNECTIONS_TABLE_NAME, LOG_LEVEL } = process.env;
const logger = new Logger({
  serviceName: 'storyPointifyService',
  logLevel: LOG_LEVEL,
});
const tracer = new Tracer({ serviceName: 'storyPointifyService' });
const metrics = new Metrics({ namespace: 'story-pointify' });

const ddb = tracer.captureAWSv3Client(
  new DynamoDBClient({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION,
  })
);

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any) {
    logger.addContext(context);
    logger.debug(JSON.stringify(event));
    logger.debug(JSON.stringify(context));
    let response: APIGatewayProxyResult = { statusCode: 200, body: 'OK' };

    const putParams = {
      TableName: CONNECTIONS_TABLE_NAME,
      Item: {
        connectionId: { S: event.requestContext.connectionId! },
      },
    };

    try {
      logger.debug(`Inserting connection details ${JSON.stringify(putParams)}`);
      await ddb.send(new PutItemCommand(putParams));

      metrics.addMetric('newConnection', MetricUnits.Count, 1);
      metrics.publishStoredMetrics();
    } catch (e: any) {
      const body = e.stack || JSON.stringify(e, null, 2);
      response = { statusCode: 500, body: body };
    }

    return response;
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;
