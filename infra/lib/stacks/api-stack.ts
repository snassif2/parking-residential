import * as cdk      from 'aws-cdk-lib';
import * as apigwv2   from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers  from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cognito   from 'aws-cdk-lib/aws-cognito';
import * as dynamodb  from 'aws-cdk-lib/aws-dynamodb';
import * as s3        from 'aws-cdk-lib/aws-s3';
import * as lambda    from 'aws-cdk-lib/aws-lambda';
import * as nodejs    from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path      from 'path';
import { Construct }  from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  userPool:    cognito.UserPool;
  table:       dynamodb.Table;
  filesBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { userPool, table, filesBucket } = props;

    const lambdasDir = path.join(__dirname, '../../../lambdas');

    // ── Shared env vars for all Lambdas ────────────────────────────
    const sharedEnv = {
      TABLE_NAME:           table.tableName,
      FILES_BUCKET:         filesBucket.bucketName,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
    };

    const defaults = {
      runtime:     lambda.Runtime.NODEJS_20_X,
      timeout:     cdk.Duration.seconds(10),
      memorySize:  256,
      environment: sharedEnv,
      bundling:    { minify: true, sourceMap: false, externalModules: [] as string[] },
    };

    // ── Lambda functions ──────────────────────────────────────────
    const fnAuth = new nodejs.NodejsFunction(this, 'FnAuth', {
      ...defaults,
      entry:   path.join(lambdasDir, 'lambda-auth/handler.ts'),
      environment: { ...sharedEnv, COGNITO_CLIENT_ID: '' },  // filled post-deploy
    });

    const fnCondominios   = new nodejs.NodejsFunction(this, 'FnCondominios',   { ...defaults, entry: path.join(lambdasDir, 'lambda-condominios/handler.ts') });
    const fnUnidades      = new nodejs.NodejsFunction(this, 'FnUnidades',      { ...defaults, entry: path.join(lambdasDir, 'lambda-unidades/handler.ts') });
    const fnVagas         = new nodejs.NodejsFunction(this, 'FnVagas',         { ...defaults, entry: path.join(lambdasDir, 'lambda-vagas/handler.ts') });
    const fnPreferenciais = new nodejs.NodejsFunction(this, 'FnPreferenciais', { ...defaults, entry: path.join(lambdasDir, 'lambda-preferenciais/handler.ts') });
    const fnSorteio       = new nodejs.NodejsFunction(this, 'FnSorteio',       { ...defaults, timeout: cdk.Duration.seconds(15), entry: path.join(lambdasDir, 'lambda-sorteio/handler.ts') });
    const fnExportacao    = new nodejs.NodejsFunction(this, 'FnExportacao',    { ...defaults, timeout: cdk.Duration.seconds(30), memorySize: 512, entry: path.join(lambdasDir, 'lambda-exportacao/handler.ts') });

    // ── IAM permissions ───────────────────────────────────────────
    table.grantReadWriteData(fnCondominios);
    table.grantReadWriteData(fnUnidades);
    table.grantReadWriteData(fnVagas);
    table.grantReadWriteData(fnPreferenciais);
    table.grantReadWriteData(fnSorteio);
    table.grantReadData(fnExportacao);
    filesBucket.grantReadWrite(fnExportacao);
    userPool.grant(fnAuth, 'cognito-idp:InitiateAuth', 'cognito-idp:ChangePassword');

    // ── HTTP API ──────────────────────────────────────────────────
    const api = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName:     'parking-residential',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Cognito JWT authorizer
    const authorizer = new authorizers.HttpJwtAuthorizer('CognitoAuth', userPool.userPoolProviderUrl, {
      jwtAudience: [],   // populated at deploy time via CDK parameter
      identitySource: ['$request.header.Authorization'],
    });

    const noAuth = { authorizationType: apigwv2.HttpAuthorizerType.NONE };

    // ── Helper to add routes ──────────────────────────────────────
    const add = (methods: apigwv2.HttpMethod[], path: string, fn: lambda.IFunction, auth = true) => {
      api.addRoutes({
        methods,
        path,
        integration: new integrations.HttpLambdaIntegration(`${fn.node.id}-${path.replace(/\//g,'-')}`, fn),
        authorizer:  auth ? authorizer : undefined,
      });
    };

    // Auth routes (no JWT required)
    add([apigwv2.HttpMethod.POST], '/auth/login',           fnAuth, false);
    add([apigwv2.HttpMethod.POST], '/auth/change-password', fnAuth, false);

    // Condomínios
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], '/condominios',         fnCondominios);
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE], '/condominios/{condoId}', fnCondominios);

    // Unidades
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], '/condominios/{condoId}/unidades',            fnUnidades);
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE], '/condominios/{condoId}/unidades/{uid}', fnUnidades);

    // Vagas
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], '/condominios/{condoId}/vagas',             fnVagas);
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE], '/condominios/{condoId}/vagas/{vid}',   fnVagas);

    // Preferenciais
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], '/condominios/{condoId}/preferenciais',             fnPreferenciais);
    add([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE], '/condominios/{condoId}/preferenciais/{pid}', fnPreferenciais);

    // Sorteio + resultados
    add([apigwv2.HttpMethod.GET],  '/condominios/{condoId}/sorteio/preview',  fnSorteio);
    add([apigwv2.HttpMethod.POST], '/condominios/{condoId}/sorteio/teste',    fnSorteio);
    add([apigwv2.HttpMethod.POST], '/condominios/{condoId}/sorteio/oficial',  fnSorteio);
    add([apigwv2.HttpMethod.GET],  '/condominios/{condoId}/resultados',       fnSorteio);
    add([apigwv2.HttpMethod.GET],  '/condominios/{condoId}/resultados/{sid}', fnSorteio);

    // Export / import / PDF
    add([apigwv2.HttpMethod.GET],  '/condominios/{condoId}/resultados/{sid}/pdf', fnExportacao);
    add([apigwv2.HttpMethod.GET],  '/condominios/{condoId}/export',               fnExportacao);
    add([apigwv2.HttpMethod.POST], '/condominios/{condoId}/import',               fnExportacao);

    this.apiUrl = api.url!;

    new cdk.CfnOutput(this, 'ApiUrl', { value: this.apiUrl, exportName: 'ParkingApiUrl' });
  }
}
