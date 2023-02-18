import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const { CONNECTIONS_TABLE_NAME } = process.env;
const tracer = new Tracer({ serviceName: 'websocketMessagingService' });

const ddb = new DynamoDBClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  public async handler(event: APIGatewayProxyEvent, context: any) {
    let response: APIGatewayProxyResult = { statusCode: 200, body: 'OK' };

    const putParams = {
      TableName: CONNECTIONS_TABLE_NAME,
      Item: {
        connectionId: { S: event.requestContext.connectionId! },
      },
    };

    try {
      await ddb.send(new PutItemCommand(putParams));
    } catch (e: any) {
      const body = e.stack || JSON.stringify(e, null, 2);
      response = { statusCode: 500, body: body };
    }

    return response;
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;
