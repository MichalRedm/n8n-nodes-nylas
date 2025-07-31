import {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class NylasApi implements ICredentialType {
  name = 'nylasApi';
  displayName = 'Nylas API';
  documentationUrl = 'https://docs.n8n.io/integrations/builtin/credentials/nylas/';
  properties: INodeProperties[] = [
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'The access token for Nylas API. This is typically obtained via OAuth 2.0.',
    },
    {
      displayName: 'API URI',
      name: 'apiUri',
      type: 'string',
      default: 'https://api.us.nylas.com',
      required: true,
      description: 'The base URI for the Nylas API (e.g., https://api.us.nylas.com).',
    },
  ];

  authenticate = {
    type: 'generic' as const,
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.accessToken}}',
      },
    },
  };

	test = {
    request: {
      baseURL: '={{$credentials.apiUri}}',
      url: '/v3/applications',
      method: 'GET' as const,
    },
  };
}
