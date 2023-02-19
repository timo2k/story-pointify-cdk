import * as cdk from 'aws-cdk-lib';
import { Color, Dashboard, GraphWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const disconnectionsMetric = new Metric({
      namespace: 'story-pointify',
      metricName: 'closedConnection',
      statistic: 'sum',
    });

    const newConnectionsMetric = new Metric({
      namespace: 'story-pointify',
      metricName: 'newConnection',
      statistic: 'sum',
    });

    const messagesDeliveredMetric = new Metric({
      namespace: 'story-pointify',
      metricName: 'messageDelivered',
      statistic: 'sum',
    });

    const closedConnectionsWidget = new GraphWidget({
      title: 'Closed Connections',
      width: 12,
      left: [
        disconnectionsMetric.with({
          color: Color.RED,
        }),
      ],
    });

    const newConnectionWidget = new GraphWidget({
      title: 'New Connections',
      width: 12,
      left: [
        newConnectionsMetric.with({
          color: Color.GREEN,
        }),
      ],
    });

    const messagesDeliveredWidgets = new GraphWidget({
      title: 'Messages Delivered',
      width: 24,
      left: [
        messagesDeliveredMetric.with({
          color: Color.GREEN,
        }),
      ],
    });

    new Dashboard(this, 'Story Pointify Dashboard', {
      widgets: [[newConnectionWidget, closedConnectionsWidget], [messagesDeliveredWidgets]],
    });
  }
}
