#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebSocket } from '../lib/websocket-stack';
import { DatabaseStack } from '../lib/database-stack';

const app = new cdk.App();

// Sets the log level for the lambda functions
// Allowed values:
// DEBUG | INFO | WARN | ERROR
const LOG_LEVEL = 'ERROR';

const databaseStack = new DatabaseStack(app, 'DatabaseStack', {});

const webSocketApiStack = new WebSocket(app, 'WebsocketStack', {
  connectionsTable: databaseStack.connectionsTable,
  roomsTable: databaseStack.roomsTable,
});
webSocketApiStack.addDependency(databaseStack);
