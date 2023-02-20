import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Message } from '../../models/message.model';
import { Payload } from '../../models/payload.model';
import { WebsocketBroadcaster } from '../../utils/websocket-broadcaster.util';

const { CONNECTIONS_TABLE_NAME, LOG_LEVEL, MESSAGES_TABLE_NAME } = process.env;
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
  private _apiGatewayEndpoint!: string;

  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any) {
    let response: APIGatewayProxyResult = { statusCode: 200, body: 'OK' };

    this._apiGatewayEndpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    logger.addContext(context);

    try {
      const postObject = JSON.parse(event.body || '').data as Payload;

      logger.debug(`Eventbody: ${event.body}`);
      logger.debug(`postObject: ${JSON.stringify(postObject)}`); // {"data": {"type": "Message", "text": "HALLO"}}

      if (postObject.type === 'Message') {
        // await this.processMessagePayload(postObject as Message, this._apiGatewayEndpoint);

        const payload: Message = postObject as Message;

        payload.messageId = uuidv4();
        const messageParams = {
          TableName: MESSAGES_TABLE_NAME,
          Item: {
            roomId: { S: '1234' }, //TODO: Hardcoded
            messageId: { S: payload.messageId },
            sender: { S: payload.sender },
            sentAt: { S: payload.sentAt!.toString() },
          },
        };
        logger.debug(`Inserting message details ${JSON.stringify(messageParams)}`);
        await ddb.send(new PutItemCommand(messageParams));
        logger.debug(`Broadcasting message details ${JSON.stringify(messageParams)}`);
        await broadcaster.broadcast(payload, this._apiGatewayEndpoint);
      } else {
        logger.info('Unrecognised payload type - ignore processing.');
      }

      metrics.publishStoredMetrics();
    } catch (e: any) {
      logger.error(`Error: ${JSON.stringify(e.stack)}`);
      response = { statusCode: 500, body: e.stack };
    }

    return response;
  }

  async processMessagePayload(payload: Message, apiGatewayEndpoint: string) {
    payload.messageId = uuidv4();
    const messageParams = {
      TableName: MESSAGES_TABLE_NAME,
      Item: {
        messageId: { S: payload.messageId },
        sender: { S: payload.sender },
        sentAt: { S: payload.sentAt!.toString() },
      },
    };
    logger.debug(`Inserting message details ${JSON.stringify(messageParams)}`);
    await ddb.send(new PutItemCommand(messageParams));
    logger.debug(`Broadcasting message details ${JSON.stringify(messageParams)}`);
    await broadcaster.broadcast(payload, apiGatewayEndpoint);
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;
