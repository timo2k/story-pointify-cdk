import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import * as cdk from 'aws-cdk-lib';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Construct } from 'constructs';
import { join } from 'path';
import { Duration, StackProps } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';

export interface WebSocketProps extends StackProps {
  roomsTable: Table;
  connectionsTable: Table;
  logLevel: string;
}

export class WebSocket extends cdk.Stack {
  public websocketApi: WebSocketApi;

  constructor(scope: Construct, id: string, props?: WebSocketProps) {
    super(scope, id, props);

    // SQS queue for user status updates
    const statusQueue = new sqs.Queue(this, 'user-status-queue', {
      visibilityTimeout: Duration.seconds(30),
      receiveMessageWaitTime: Duration.seconds(20),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });
    // Enforce TLS call from any services
    statusQueue.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ['sqs:*'],
        resources: [statusQueue.queueArn],
        conditions: {
          Bool: { 'aws:SecureTransport': 'false' },
        },
      })
    );
    NagSuppressions.addResourceSuppressions(
      statusQueue,
      [
        {
          id: 'AwsSolutions-SQS3',
          reason:
            "Supress warning about missing DLQ. DLQ is not mission-critical here, a missing status update won't cause service disruptuion.",
        },
      ],
      true
    );

    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: ['aws-sdk'],
        nodeModules: [
          '@aws-lambda-powertools/logger',
          '@aws-lambda-powertools/tracer',
          'aws-jwt-verify',
          '@aws-lambda-powertools/metrics',
        ],
      },
      depsLockFilePath: join(__dirname, '../resources/', 'package-lock.json'),
      environment: {
        CONNECTIONS_TABLE_NAME: props?.connectionsTable.tableName!,
        ROOMS_TABLE_NAME: props?.roomsTable.tableName!,
        LOG_LEVEL: props?.logLevel!,
        STATUS_QUEUE_URL: statusQueue.queueUrl,
      },
      handler: 'handler',
      runtime: Runtime.NODEJS_18_X,
      tracing: Tracing.ACTIVE,
    };

    // Add Lambda Functions
    const onConnectHandler = new NodejsFunction(this, 'onConnectHandler', {
      entry: join(__dirname, `/../resources/handlers/websocket/onconnect.ts`),
      ...nodeJsFunctionProps,
    });
    props?.connectionsTable.grantReadWriteData(onConnectHandler);
    statusQueue.grantSendMessages(onConnectHandler);

    const onDisconnectHandler = new NodejsFunction(this, 'onDisconnectHandler', {
      entry: join(__dirname, `/../resources/handlers/websocket/ondisconnect.ts`),
      ...nodeJsFunctionProps,
    });
    props?.connectionsTable.grantReadWriteData(onDisconnectHandler);
    statusQueue.grantSendMessages(onDisconnectHandler);

    // Create Websocket API-Gateway
    this.websocketApi = new WebSocketApi(this, 'StoryPointifyWebsocketApi', {
      apiName: 'Story Pointify Websocket API lol',
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('ConnectIntegration', onConnectHandler),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('onDisconnectHandler', onDisconnectHandler),
      },
    });

    const prodStage = new WebSocketStage(this, 'Prod', {
      webSocketApi: this.websocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    nodeJsFunctionProps.environment!['APIGW_ENDPOINT'] = prodStage.url.replace('wss://', '');
  }
}
