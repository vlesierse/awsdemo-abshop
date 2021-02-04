#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ABShopInfrastructureStack } from '../lib/abshop-infrastructure-stack';
import { ABShopApplicationStack } from '../lib/abshop-application-stack';

const app = new cdk.App();
const infrastructure = new ABShopInfrastructureStack(app, 'ABShopInfrastructure');
new ABShopApplicationStack(app, 'ABShopApplication', { cluster: infrastructure.cluster });
