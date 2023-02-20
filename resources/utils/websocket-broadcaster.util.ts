import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { DeleteItemCommand, DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export class WebsocketBroadcaster {
  constructor(
    private metrics: Metrics,
    private dynamoDbCLient: DynamoDBClient,
    private logger: Logger,
    private connectionsTableName: string
  ) {}

  private _apiGatewayEndpoint!: string;
  private _apigwManagementApi: ApiGatewayManagementApiClient;

  async broadcast(payload: any, apiGatewayEndpoint: string) {
    try {
      this.logger.debug('Retrieving active connections...');
      let connectionsData = await this.dynamoDbCLient.send(
        new ScanCommand({
          TableName: this.connectionsTableName,
          ProjectionExpression: 'connectionId',
        })
      );
      this.logger.debug(`ConnectionData: ${JSON.stringify(connectionsData)}`);
      this.logger.debug(`Cached ApiGatewayEndpoint: ${this._apiGatewayEndpoint}`);
      this.logger.debug(`New ApiGatewayEndpoint: ${apiGatewayEndpoint}`);

      this._apigwManagementApi = new ApiGatewayManagementApiClient({
        apiVersion: '2018-11-29',
        endpoint: apiGatewayEndpoint,
      });

      await Promise.all(
        connectionsData.Items!.map(async (connectionData) => {
          try {
            await this._apigwManagementApi.send(
              new PostToConnectionCommand({
                ConnectionId: connectionData.connectionId.S,
                Data: Buffer.from(JSON.stringify(payload)),
              })
            );
            this.metrics.addMetric('messageDelivered', MetricUnits.Count, 1);
            this.logger.debug(`Message sent to connection ${connectionData.connectionId}`);
          } catch (e: any) {
            this.logger.debug(`Error during message delivery: ${JSON.stringify(e)}`);

            if (e.statusCode === 410) {
              this.logger.debug(`Found stale connection, deleting ${connectionData.connectionId}`);
              this.dynamoDbCLient.send(
                new DeleteItemCommand({
                  TableName: this.connectionsTableName,
                  Key: {
                    connectionId: { S: connectionData.connectionId.toString() },
                  },
                })
              );
            }
          }
        })
      );
    } catch (e) {
      this.logger.debug(`Error: ${JSON.stringify(e)}`);
    }
  }
}
