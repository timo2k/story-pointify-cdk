import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand, QueryCommand, QueryCommandOutput } from '@aws-sdk/client-dynamodb';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Logger } from '@aws-lambda-powertools/logger';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { StatusChangeEvent } from '../../models/status-change-event.model';
import { Status } from '../../models/status.enum';

const { CONNECTIONS_TABLE_NAME, LOG_LEVEL, STATUS_QUEUE_URL } = process.env;
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
const SQS = tracer.captureAWSv3Client(new SQSClient({ region: process.env.AWS_REGION }));

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any) {
    logger.addContext(context);
    let response: APIGatewayProxyResult = { statusCode: 200, body: 'OK' };

    try {
      let connectionData: any = await ddb.send(
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
        let statusChangeEvent = new StatusChangeEvent({
          userId: connectionData.Items[0].userId.S,
          currentStatus: Status.OFFLINE,
          eventDate: new Date(),
        });

        logger.debug(`Broadcasting message details ${JSON.stringify(statusChangeEvent)}`);

        let sqsResults = await SQS.send(
          new SendMessageCommand({
            QueueUrl: STATUS_QUEUE_URL,
            MessageBody: JSON.stringify(statusChangeEvent),
            MessageAttributes: {
              Type: {
                StringValue: 'StatusUpdate',
                DataType: 'String',
              },
            },
          })
        );

        logger.debug(`queue send result: ${JSON.stringify(sqsResults)}`);

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
