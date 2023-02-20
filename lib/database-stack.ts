import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  readonly roomsTable: Table;
  readonly connectionsTable: Table;
  readonly messagesTable: Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.connectionsTable = new Table(this, 'connections', {
      partitionKey: { name: 'connectionId', type: AttributeType.STRING },
      tableName: 'story-pointify-connection-ids',
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: false,
    });

    this.roomsTable = new Table(this, 'rooms', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: 'story-pointify-rooms',
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: false,
    });

    this.messagesTable = new Table(this, 'messages', {
      partitionKey: {
        name: 'roomId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'sentAt',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: 'story-pointify-messages',
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: false,
    });
  }
}
