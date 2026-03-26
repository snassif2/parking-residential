#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack }     from '../lib/stacks/auth-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack }  from '../lib/stacks/storage-stack';
import { ApiStack }      from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:  process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const auth     = new AuthStack(app,     'ParkingAuth',     { env });
const database = new DatabaseStack(app, 'ParkingDatabase', { env });
const storage  = new StorageStack(app,  'ParkingStorage',  { env });

const api = new ApiStack(app, 'ParkingApi', {
  env,
  userPool:   auth.userPool,
  table:      database.table,
  filesBucket: storage.filesBucket,
});

new FrontendStack(app, 'ParkingFrontend', {
  env,
  apiUrl:         api.apiUrl,
  userPoolId:     auth.userPool.userPoolId,
  userPoolClientId: auth.userPoolClientId,
});

app.synth();
