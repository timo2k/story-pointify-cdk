#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebSocket } from '../lib/websocket-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ObservabilityStack } from '../lib/observability-stack';
import { RestApiStack } from '../lib/rest-api-stack';

const app = new cdk.App();

// Sets the log level for the lambda functions
// Allowed values:
// DEBUG | INFO | WARN | ERROR
const LOG_LEVEL = 'DEBUG';

const databaseStack = new DatabaseStack(app, 'DatabaseStack', {});

const webSocketApiStack = new WebSocket(app, 'WebsocketStack', {
  connectionsTable: databaseStack.connectionsTable,
  roomsTable: databaseStack.roomsTable,
  messagesTable: databaseStack.messagesTable,
  logLevel: LOG_LEVEL,
});
webSocketApiStack.addDependency(databaseStack);

const restApiStack = new RestApiStack(app, 'RestApiStack', {
  logLevel: LOG_LEVEL,
  messagesTable: databaseStack.messagesTable,
  roomsTable: databaseStack.roomsTable,
  connectionsTable: databaseStack.connectionsTable,
  webSocketApi: webSocketApiStack.websocketApi,
});
restApiStack.addDependency(webSocketApiStack);
restApiStack.addDependency(databaseStack);

new ObservabilityStack(app, 'ObservabilityStack');
