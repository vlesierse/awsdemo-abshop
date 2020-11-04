import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as ABShop from '../lib/abshop-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new ABShop.ABShopStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
