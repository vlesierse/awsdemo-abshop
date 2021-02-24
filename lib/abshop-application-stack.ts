import * as cdk from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import { ABShopService } from './abshop-service';
import { KubernetesManifestFile } from './KubernetesManifestFile';
import { AppMeshGateway } from './AppMeshGateway';

export interface ABShopApplicationProps {
  cluster: eks.Cluster
}

export class ABShopApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ABShopApplicationProps) {
    super(scope, id);

    const { cluster } = props;
    const application = new KubernetesManifestFile(this, 'ApplicationManifest', { cluster, manifestFile: '../manifests/application.yaml' });
    new AppMeshGateway(this, 'Gateway', { cluster, namespace: 'abshop', name: 'abshop-gw' }).node.addDependency(application);
    new KubernetesManifestFile(this, 'Redis', { cluster, manifestFile: '../manifests/services/redis.yaml' })
      .node.addDependency(application);
    new ABShopService(this, 'ImageService', {
      cluster,
      imageDirectory: '../src/imageservice',
      manifestFile: '../manifests/services/imageservice.yaml'
    }).node.addDependency(application);
    new ABShopService(this, 'CatalogService', {
      cluster,
      imageDirectory: '../src/catalogservice',
      manifestFile: '../manifests/services/catalogservice.yaml'
    }).node.addDependency(application);
    new ABShopService(this, 'CartService', {
      cluster,
      imageDirectory: '../src/cartservice',
      manifestFile: '../manifests/services/cartservice.yaml',
    }).node.addDependency(application);
    new ABShopService(this, 'OrderService', {
      cluster,
      imageDirectory: '../src/orderservice',
      manifestFile: '../manifests/services/orderservice.yaml',
    }).node.addDependency(application);
    new ABShopService(this, 'RecommenderService', {
      cluster,
      imageDirectory: '../src/recommenderservice',
      manifestFile: '../manifests/services/recommenderservice.yaml',
    }).node.addDependency(application);
    new ABShopService(this, 'FrontendService', {
      cluster,
      imageDirectory: '../src/frontend',
      manifestFile: '../manifests/services/frontend.yaml',
      manifestContainerName: 'frontend'
    }).node.addDependency(application);
  }
}
