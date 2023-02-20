import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import { Room } from '../../models/room.model';

const { CHANNELS_TABLE_NAME, LOG_LEVEL } = process.env;
const logger = new Logger({ serviceName: 'storyPointifyService', logLevel: LOG_LEVEL });
const tracer = new Tracer({ serviceName: 'storyPointifyService' });
const ddb = tracer.captureAWSv3Client(
  new DynamoDBClient({
    apiVersion: '2012-08-10',
    region: process.env.AWS_REGION,
  })
);

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any) {
    let response: APIGatewayProxyResult = { statusCode: 200, body: '' };

    logger.addContext(context);

    try {
      const postData: Room = JSON.parse(event.body!);
      logger.debug(`POST data: ${JSON.stringify(postData)}`);

      const roomParams: PutItemCommandInput = {
        TableName: CHANNELS_TABLE_NAME,
        Item: {
          id: { S: postData.id },
        },
      };

      logger.debug(`Inserting room details ${JSON.stringify(roomParams)}`);
      await ddb.send(new PutItemCommand(roomParams));
      logger.debug(JSON.stringify(event));
      logger.debug('Post Room executed successfully!');
    } catch (e: any) {
      response = { statusCode: 500, body: e.stack };
    }

    return response;
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;
