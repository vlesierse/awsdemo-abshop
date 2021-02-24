import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import { AppMesh } from './AppMesh';
import { CloudWatchAgent } from './CloudWatchAgent';
import { CfnOutput } from '@aws-cdk/core';

export class ABShopInfrastructureStack extends cdk.Stack {

  public cluster: eks.Cluster;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    var vpc = new ec2.Vpc(this, "VPC");
    this.cluster = new eks.Cluster(this, "Cluster", { vpc, version: eks.KubernetesVersion.V1_18, defaultCapacity: 3 });

    new CfnOutput(this, 'UpdateKubeConfig', { value: `aws eks update-kubeconfig --name ${this.cluster.clusterName} --region ${this.region} --role-arn ${this.cluster.kubectlRole?.roleArn}` });

    // Container Insights
    new CloudWatchAgent(this, 'CloudWatchAgent', { cluster: this.cluster} );

    // App Mesh
    new AppMesh(this, 'AppMesh', { cluster: this.cluster });
  }
}
