#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ABShopStack } from '../lib/abshop-stack';

const app = new cdk.App();
new ABShopStack(app, 'ABShop');
