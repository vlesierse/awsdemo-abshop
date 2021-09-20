import * as cdk from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'

export interface KubernetesManifestFileProps {
  readonly cluster: eks.ICluster;
  readonly manifestFile: string;
} 

export class KubernetesManifestFile extends eks.KubernetesManifest {
  constructor(scope: cdk.Construct, id: string, props: KubernetesManifestFileProps) {
    super(scope, id, { cluster: props.cluster, manifest: yaml.loadAll(fs.readFileSync(path.join(__dirname, props.manifestFile), 'utf8')) as any });
  }
}