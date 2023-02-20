import { WebSocketApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Stack, StackProps } from 'aws-cdk-lib';
import {
  MockIntegration,
  PassthroughBehavior,
  RestApi,
  IResource,
  LambdaIntegration,
} from 'aws-cdk-lib/aws-apigateway';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

export interface RestApiProps extends StackProps {
  messagesTable: Table;
  roomsTable: Table;
  connectionsTable: Table;
  webSocketApi: WebSocketApi;
  logLevel: string;
}

export class RestApiStack extends Stack {
  public apiGatewayEndpoint: string;
  public restApi: RestApi;

  constructor(scope: Construct, id: string, props?: RestApiProps) {
    super(scope, id, props);

    const sharedLambdaProps: NodejsFunctionProps = {
      bundling: {
        externalModules: ['aws-sdk'],
        nodeModules: ['@aws-lambda-powertools/logger', '@aws-lambda-powertools/tracer', 'aws-jwt-verify'],
      },
      depsLockFilePath: join(__dirname, '../resources/', 'package-lock.json'),
      environment: {
        CHANNELS_TABLE_NAME: props?.roomsTable.tableName!,
        CONNECTIONS_TABLE_NAME: props?.connectionsTable.tableName!,
        MESSAGES_TABLE_NAME: props?.messagesTable.tableName!,
        WEBSOCKET_API_URL: `${props?.webSocketApi.apiEndpoint!}/prod`,
        LOG_LEVEL: props?.logLevel!,
      },
      runtime: Runtime.NODEJS_18_X,
    };

    // Add Lambda Functions to Gateway
    const postRoomsHandler = new NodejsFunction(this, 'postRoomsHandler', {
      entry: join(__dirname, `/../resources/handlers/rest/post-rooms.ts`),
      ...sharedLambdaProps,
    });

    // Grant Access to he DynamoDB tables
    props?.roomsTable.grantReadWriteData(postRoomsHandler);

    const postRoomsIntegration = new LambdaIntegration(postRoomsHandler);

    this.restApi = new RestApi(this, 'storyPointifyRestApi', {
      restApiName: 'Story Pointify RESTs API lol',
    });

    this.apiGatewayEndpoint = this.restApi.url;

    const api = this.restApi.root.addResource('api');

    const rooms = api.addResource('rooms');
    rooms.addMethod('POST', postRoomsIntegration);

    addCorsOptions(rooms);
  }
}

export function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod(
    'OPTIONS',
    new MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers':
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'false'",
            'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    }
  );
}
