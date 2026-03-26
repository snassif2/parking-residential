import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  ChangePasswordCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ok, errorResponse, badRequest } from '../shared/utils/response';

const cognito   = new CognitoIdentityProviderClient({});
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const POOL_ID   = process.env.COGNITO_USER_POOL_ID!;

export const handler = async (event: APIGatewayProxyEventV2) => {
  const method = event.requestContext.http.method;
  const path   = event.requestContext.http.path;

  try {
    if (method === 'POST' && path.endsWith('/auth/login')) return await login(event);
    if (method === 'POST' && path.endsWith('/auth/change-password')) return await changePassword(event);
    return errorResponse({ statusCode: 404, message: 'Not found' });
  } catch (err) {
    return errorResponse(err);
  }
};

async function login(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body || '{}');
  if (!body.username || !body.password) return badRequest('username and password required');

  const cmd = new InitiateAuthCommand({
    AuthFlow:       'USER_PASSWORD_AUTH',
    ClientId:       CLIENT_ID,
    AuthParameters: { USERNAME: body.username, PASSWORD: body.password },
  });

  const res = await cognito.send(cmd);
  if (!res.AuthenticationResult) return errorResponse({ statusCode: 401, message: 'Authentication failed' });

  return ok({
    accessToken:  res.AuthenticationResult.AccessToken,
    idToken:      res.AuthenticationResult.IdToken,
    refreshToken: res.AuthenticationResult.RefreshToken,
    expiresIn:    res.AuthenticationResult.ExpiresIn,
  });
}

async function changePassword(event: APIGatewayProxyEventV2) {
  const body = JSON.parse(event.body || '{}');
  if (!body.accessToken || !body.oldPassword || !body.newPassword) return badRequest('accessToken, oldPassword, newPassword required');

  await cognito.send(new ChangePasswordCommand({
    AccessToken:      body.accessToken,
    PreviousPassword: body.oldPassword,
    ProposedPassword: body.newPassword,
  }));

  return ok({ message: 'Password changed' });
}
