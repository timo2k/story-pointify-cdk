import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyResult, SQSEvent } from 'aws-lambda';
import { StatusChangeEvent } from '../../models/status-change-event.model';
import { WebsocketBroadcaster } from '../../utils/websocket-broadcaster.util';

const { CONNECTIONS_TABLE_NAME, LOG_LEVEL, APIGW_ENDPOINT } = process.env;
const logger = new Logger({ serviceName: 'storyPointifyService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'storyPointifyService' });
const metrics = new Metrics({ namespace: 'story-pointify' });
const ddb = tracer.captureAWSv3Client(
  new DynamoDBClient({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION,
  })
);
const broadcaster = new WebsocketBroadcaster(metrics, ddb, logger, CONNECTIONS_TABLE_NAME!);

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: SQSEvent, context: any): Promise<any> {
    let response: APIGatewayProxyResult = { statusCode: 200, body: '' };
    logger.addContext(context);

    try {
      logger.debug(`Triggered SQS processor lambda with payload: ${JSON.stringify(event)}`);
      logger.debug(`ApiGatewayUrl: ${APIGW_ENDPOINT}`);

      await Promise.all(
        event.Records.map(async (record) => {
          let statusChangeEvent = JSON.parse(record.body) as StatusChangeEvent;
          await broadcaster.broadcast(statusChangeEvent, APIGW_ENDPOINT!);

          logger.debug(`Event record has been processed: ${record.body}`);
        })
      );
    } catch (e: any) {
      response = { statusCode: 500, body: e.stack };
      logger.debug(`Error: ${JSON.stringify(e.stack)}`);
    }

    return response;
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;
