import { DynamoDBClient }          from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient }   from '@aws-sdk/lib-dynamodb';

const raw = new DynamoDBClient({ region: process.env.AWS_REGION });

export const db = DynamoDBDocumentClient.from(raw, {
  marshallOptions:   { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

export const TABLE = process.env.TABLE_NAME!;
