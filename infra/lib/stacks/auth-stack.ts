import * as cdk  from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda  from 'aws-cdk-lib/aws-lambda';
import * as nodejs  from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path    from 'path';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Pre-token-generation Lambda ──────────────────────────────
    // Injects custom:role and custom:condoIds into ID token claims
    const preTokenFn = new nodejs.NodejsFunction(this, 'PreTokenTrigger', {
      entry:   path.join(__dirname, '../../../lambdas/lambda-auth/pre-token-trigger.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      bundling: { minify: true, sourceMap: false },
    });

    // ── User Pool ─────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName:  'parking-residential',
      selfSignUpEnabled: false,
      signInAliases:     { username: true, email: false },
      autoVerify:        { email: false },
      passwordPolicy: {
        minLength:        8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits:    true,
        requireSymbols:   false,
      },
      mfa:               cognito.Mfa.OPTIONAL,
      mfaSecondFactor:   { sms: false, otp: true },
      accountRecovery:   cognito.AccountRecovery.NONE,
      removalPolicy:     cdk.RemovalPolicy.RETAIN,

      // Custom attributes
      customAttributes: {
        role:     new cognito.StringAttribute({ mutable: true }),   // admin | sindico | morador
        condoId:  new cognito.StringAttribute({ mutable: true }),   // morador: single condo
        condoIds: new cognito.StringAttribute({ mutable: true, maxLen: 2048 }), // sindico: comma-sep
        unidadeId:new cognito.StringAttribute({ mutable: true }),   // morador: unit id
      },

      lambdaTriggers: {
        preTokenGeneration: preTokenFn,
      },
    });

    // ── App Client (SPA — no secret) ──────────────────────────────
    const client = this.userPool.addClient('SpaClient', {
      userPoolClientName: 'parking-spa',
      generateSecret:     false,
      authFlows: {
        userPassword:      true,
        userSrp:           true,
        adminUserPassword: true,
      },
      accessTokenValidity:  cdk.Duration.hours(1),
      idTokenValidity:      cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });
    this.userPoolClientId = client.userPoolClientId;

    // ── Groups ────────────────────────────────────────────────────
    new cognito.CfnUserPoolGroup(this, 'GroupAdmin', {
      userPoolId:  this.userPool.userPoolId,
      groupName:   'admin-master',
      description: 'Global administrator',
    });
    new cognito.CfnUserPoolGroup(this, 'GroupSindico', {
      userPoolId:  this.userPool.userPoolId,
      groupName:   'sindicos',
      description: 'Condo managers',
    });
    new cognito.CfnUserPoolGroup(this, 'GroupMorador', {
      userPoolId:  this.userPool.userPoolId,
      groupName:   'moradores',
      description: 'Residents (read-only)',
    });

    // ── Outputs ───────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId',       { value: this.userPool.userPoolId,        exportName: 'ParkingUserPoolId' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClientId,           exportName: 'ParkingUserPoolClientId' });
  }
}
