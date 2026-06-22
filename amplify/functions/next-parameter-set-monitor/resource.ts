import { defineFunction } from '@aws-amplify/backend';
import { Duration } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

export const nextParameterSetMonitor = defineFunction((scope) => {
  return new NodejsFunction(scope, 'next-parameter-set-monitor-lambda', {
    entry: join(currentDir, 'handler.ts'),
    handler: 'handler',
    runtime: Runtime.NODEJS_20_X,
    timeout: Duration.seconds(30),
    memorySize: 512,
  });
});