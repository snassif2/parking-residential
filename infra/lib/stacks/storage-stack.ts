import * as cdk  from 'aws-cdk-lib';
import * as s3   from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly filesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Files bucket: PDFs + JSON exports ─────────────────────────
    this.filesBucket = new s3.Bucket(this, 'FilesBucket', {
      bucketName:           `parking-files-${this.account}-${this.region}`,
      blockPublicAccess:    s3.BlockPublicAccess.BLOCK_ALL,
      encryption:           s3.BucketEncryption.S3_MANAGED,
      versioned:            true,
      removalPolicy:        cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects:    false,
      cors: [{
        allowedOrigins: ['*'],           // tightened to CloudFront URL after deploy
        allowedMethods: [s3.HttpMethods.GET],
        allowedHeaders: ['*'],
        maxAge:         300,
      }],
      lifecycleRules: [{
        id:         'archive-old-pdfs',
        enabled:    true,
        prefix:     'pdfs/',
        transitions: [{
          storageClass:         s3.StorageClass.GLACIER,
          transitionAfter:      cdk.Duration.days(365),
        }],
      }, {
        id:         'expire-temp-imports',
        enabled:    true,
        prefix:     'imports/',
        expiration: cdk.Duration.days(7),
      }],
    });

    new cdk.CfnOutput(this, 'FilesBucketName', { value: this.filesBucket.bucketName, exportName: 'ParkingFilesBucket' });
  }
}
