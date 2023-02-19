import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Logger } from '@aws-lambda-powertools/logger';

const { CONNECTIONS_TABLE_NAME, LOG_LEVEL } = process.env;
const logger = new Logger({
  serviceName: 'websocketMessagingService',
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
    let response: APIGatewayProxyResult = { statusCode: 200, body: 'OK' };

    try {
      let connectionData = await ddb.send(
        new QueryCommand({
          TableName: CONNECTIONS_TABLE_NAME,
          KeyConditionExpression: 'connectionId = :id',
          ExpressionAttributeValues: {
            ':id': { S: event.requestContext.connectionId! },
          },
        })
      );

      logger.debug(`Retrieved connection items: ${JSON.stringify(connectionData)}`);

      if (connectionData.Items?.length! > 0) {
        await ddb.send(
          new DeleteItemCommand({
            TableName: CONNECTIONS_TABLE_NAME,
            Key: { connectionId: { S: event.requestContext.connectionId! } },
          })
        );

        metrics.addMetric('closedConnection', MetricUnits.Count, 1);
      }
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
