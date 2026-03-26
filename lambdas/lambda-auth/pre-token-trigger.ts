import type { PreTokenGenerationTriggerHandler } from 'aws-lambda';

// Injects custom:role into the ID token so API Gateway authorizer can read it
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const attrs = event.request.userAttributes;
  const groups = event.request.groupConfiguration?.groupsToOverride || [];

  let role = 'morador';
  if (groups.includes('admin-master')) role = 'admin';
  else if (groups.includes('sindicos'))  role = 'sindico';

  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        'custom:role': role,
      },
    },
  };

  return event;
};
