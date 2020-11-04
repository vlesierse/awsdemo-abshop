import * as cdk from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import * as iam from '@aws-cdk/aws-iam';
import { HelmChart, KubernetesManifest } from '@aws-cdk/aws-eks';

export interface AppMeshProps {
  cluster: eks.Cluster,
  namespace?: string
}

export interface AppMeshProps {
  cluster: eks.Cluster,
  namespace?: string
}

export class AppMesh extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: AppMeshProps) {
    super(scope, id);

    const { cluster } = props;
    const namespace = props.namespace ?? 'appmesh-system';

    // Namespace
    const manifest = new KubernetesManifest(this, 'Namespace', {
      cluster,
      manifest: [{
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: namespace,
        }
      }]
    });

    // Service Account
    const serviceAccount = new eks.ServiceAccount(this, 'ServiceAccount', {
      cluster, namespace,
      name: 'appmesh-controller'
    })
    serviceAccount.node.addDependency(manifest);
    serviceAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppMeshFullAccess'));
    serviceAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudMapFullAccess'));

    // Helm Chart
    const chart = new HelmChart(this, 'Chart', {
      cluster,
      chart: 'appmesh-controller',
      repository: 'https://aws.github.io/eks-charts',
      namespace: namespace,
      values: {
        region: cdk.Stack.of(this).region,
        serviceAccount: {
          create: false,
          name: serviceAccount.serviceAccountName
        }
      },
      wait: true
    });
    chart.node.addDependency(manifest);;
  }

  public addGateway() {

  }
}