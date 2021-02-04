import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import { AppMesh } from './eks/AppMesh';
import { CloudWatchAgent } from './eks/CloudWatchAgent';

export class ABShopInfrastructureStack extends cdk.Stack {

  public cluster: eks.Cluster;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    var vpc = new ec2.Vpc(this, "VPC");
    this.cluster = new eks.Cluster(this, "Cluster", { vpc, version: eks.KubernetesVersion.V1_17, defaultCapacity: 3 });

    // Container Insights
    const agent = new CloudWatchAgent(this, 'CloudWatchAgent', { cluster: this.cluster} );

    // App Mesh
    const mesh = new AppMesh(this, 'AppMesh', { cluster: this.cluster });
  } 
}
