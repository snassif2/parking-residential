import * as cdk      from 'aws-cdk-lib';
import * as dynamodb  from 'aws-cdk-lib/aws-dynamodb';
import { Construct }  from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Single table ──────────────────────────────────────────────
    this.table = new dynamodb.Table(this, 'MainTable', {
      tableName:    'SorteioVagas',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'expiresAt',   // auto-delete test sorteio records
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption:   dynamodb.TableEncryption.AWS_MANAGED,
    });

    // ── GSI1: users by condo ──────────────────────────────────────
    // PK=COND#{id}#USERS  SK=USER#{userId}
    this.table.addGlobalSecondaryIndex({
      indexName:        'GSI1',
      partitionKey:     { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey:          { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType:   dynamodb.ProjectionType.ALL,
    });

    // ── GSI2: condos by síndico ───────────────────────────────────
    // PK=SINDICO#{userId}  SK=COND#{condoId}
    this.table.addGlobalSecondaryIndex({
      indexName:        'GSI2',
      partitionKey:     { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey:          { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType:   dynamodb.ProjectionType.ALL,
    });

    // ── GSI3: spots by status ─────────────────────────────────────
    // PK=COND#{condoId}#VAGAS  SK={status}#{vagaId}
    this.table.addGlobalSecondaryIndex({
      indexName:        'GSI3',
      partitionKey:     { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey:          { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType:   dynamodb.ProjectionType.ALL,
    });

    // ── Outputs ───────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName, exportName: 'ParkingTableName' });
    new cdk.CfnOutput(this, 'TableArn',  { value: this.table.tableArn,  exportName: 'ParkingTableArn'  });
  }
}
