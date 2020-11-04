import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import { ABShopService } from './abshop-service';
import { KubernetesManifestFile } from './eks/KubernetesManifestFile';
import { AppMesh } from './eks/AppMesh';
import { CloudWatchAgent } from './eks/CloudWatchAgent';
import { PrometheusAgent } from './eks/PrometheusAgent';
import { ClusterAutoScaler } from './eks/ClusterAutoScaler';

export class ABShopStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    var vpc = new ec2.Vpc(this, "VPC");
    var cluster = new eks.Cluster(this, "Cluster", { vpc, version: eks.KubernetesVersion.V1_17, defaultCapacity: 0 });
    const defaultCapacity = cluster.addAutoScalingGroupCapacity('Default', { instanceType: new ec2.InstanceType("m5.large"), minCapacity: 2, maxCapacity: 4 });
    new ClusterAutoScaler(this, "ClusterAutoScaler", { cluster, autoScalingGroup: defaultCapacity });

    // Container Insights
    new CloudWatchAgent(this, 'CloudWatchAgent', { cluster} );
    new PrometheusAgent(this, 'PrometheusAgent', { cluster} );

    // App Mesh
    const mesh = new AppMesh(this, 'AppMesh', { cluster });
    

    // Application
    const application = new KubernetesManifestFile(this, 'ApplicationManifest', { cluster, manifestFile: '../../../manifests/application.yaml' });
    application.node.addDependency(mesh);
    new KubernetesManifestFile(this, 'Redis', { cluster, manifestFile: '../../../manifests/redis.yaml' })
      .node.addDependency(application);
    new ABShopService(this, 'ImageService', {
      cluster,
      imageDirectory: '../../src/imageservice',
      manifestFile: '../../manifests/services/imageservice.yaml'
    }).node.addDependency(application);
    new ABShopService(this, 'CatalogService', {
      cluster,
      imageDirectory: '../../src/catalogservice',
      manifestFile: '../../manifests/services/catalogservice.yaml'
    }).node.addDependency(application);
    new ABShopService(this, 'CartService', {
      cluster,
      imageDirectory: '../../src/cartservice',
      manifestFile: '../../manifests/services/cartservice.yaml',
    }).node.addDependency(application);
    new ABShopService(this, 'OrderService', {
      cluster,
      imageDirectory: '../../src/orderservice',
      manifestFile: '../../manifests/services/orderservice.yaml',
    }).node.addDependency(application);
    new ABShopService(this, 'RecommenderService', {
      cluster,
      imageDirectory: '../../src/recommenderservice',
      manifestFile: '../../manifests/services/recommenderservice.yaml',
    }).node.addDependency(application);
    new ABShopService(this, 'FrontendService', {
      cluster,
      imageDirectory: '../../src/frontend',
      manifestFile: '../../manifests/services/frontend.yaml',
      manifestContainerName: 'frontend'
    }).node.addDependency(application);
  } 
}
