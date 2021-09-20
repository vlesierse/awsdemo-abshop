import * as cdk from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import * as assets from '@aws-cdk/aws-ecr-assets';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'

export interface ABShopServiceProps {
  cluster: eks.Cluster
  manifestFile: string
  manifestContainerName?: string
  imageDirectory: string
}

export class ABShopService extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ABShopServiceProps) {
    super(scope, id);

    const image = new assets.DockerImageAsset(this, 'ImageServiceImage', {
      directory: path.join(__dirname, props.imageDirectory)
    });

    const manifestContainerName = props.manifestContainerName ?? id.toLowerCase();

    const manifestContent = yaml.loadAll(fs.readFileSync(path.join(__dirname, props.manifestFile), 'utf8')) as any;
    manifestContent.filter((m: { kind: string; }) => m.kind == 'Deployment').forEach((deployment: { spec: { template: { spec: { containers: any[]; }; }; }; }) => {
      const container = deployment.spec.template.spec.containers.find((c: { name: string; }) => c.name.toLowerCase() == manifestContainerName);
      container.image = image.imageUri;
    });
    new eks.KubernetesManifest(this, 'Manifest', { cluster: props.cluster, manifest: manifestContent });
  }
}