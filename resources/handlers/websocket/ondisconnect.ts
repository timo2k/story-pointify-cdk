import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  DeleteItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';

const { CONNECTIONS_TABLE_NAME } = process.env;

const ddb = new DynamoDBClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
});

class Lambda implements LambdaInterface {
  public async handler(event: APIGatewayProxyEvent, context: any) {
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

      if (connectionData.Items?.length! > 0) {
        await ddb.send(
          new DeleteItemCommand({
            TableName: CONNECTIONS_TABLE_NAME,
            Key: { connectionId: { S: event.requestContext.connectionId! } },
          })
        );
      }
    } catch (e: any) {
      const body = e.stack || JSON.stringify(e, null, 2);
      response = { statusCode: 500, body: body };
    }

    return response;
  }
}

export const handlerClass = new Lambda();
export const handler = handlerClass.handler;
