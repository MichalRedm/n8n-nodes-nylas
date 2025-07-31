import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
  IRequestOptions,
	NodeOperationError,
	NodeApiError,
} from 'n8n-workflow';

// Define interfaces for Nylas API request bodies for type safety
interface NylasEmailRecipient {
  name?: string;
  email: string;
}

interface NylasEmailSendRequest {
  to: NylasEmailRecipient[];
  subject: string;
  body: string;
  send_at?: number; // Unix timestamp
  use_draft?: boolean;
}

interface NylasCalendarEventWhen {
  start_time: number; // Unix timestamp
  end_time: number;   // Unix timestamp
  object?: string; // "time" or "date", default "time" for our use case
}

interface NylasCalendarParticipant {
  name?: string;
  email: string;
}

interface NylasCalendarEventRequest {
  calendar_id: string;
  title: string;
  when: NylasCalendarEventWhen;
  participants?: NylasCalendarParticipant[];
  location?: string;
  description?: string;
}

interface NylasContactEmail {
  type?: string;
  email: string;
}

interface NylasContactPhoneNumber {
  type?: string;
  number: string;
}

interface NylasContactRequest {
  given_name?: string;
  surname?: string;
  emails?: NylasContactEmail[];
  phone_numbers?: NylasContactPhoneNumber[];
  web_pages?: Array<{ type?: string; url: string }>;
}

export class Nylas implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Nylas',
    name: 'nylas',
    icon: 'file:nylas.svg',
    group: ['integrations'],
    version: 1,
    description: 'Automate email, calendar, and contacts with Nylas API',
    defaults: {
      name: 'Nylas',
    },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'nylasApi',
        required: true,
      },
    ],
    properties: [
      // Resource selection
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Email',
            value: 'email',
          },
          {
            name: 'Calendar',
            value: 'calendar',
          },
          {
            name: 'Contact',
            value: 'contact',
          },
        ],
        default: 'email',
        description: 'The Nylas resource to interact with (Email, Calendar, or Contact)',
      },
      // Operation selection (dynamic based on resource)
      // Email Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: [
              'email',
            ],
          },
        },
        options: [
          {
            name: 'Send Message',
            value: 'sendMessage',
            action: 'Send message via email',
          },
          {
            name: 'List Messages',
            value: 'listMessages',
            action: 'List messages from an email',
          },
        ],
        default: 'sendMessage',
      },
      // Calendar Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: [
              'calendar',
            ],
          },
        },
        options: [
          {
            name: 'Create Event',
            value: 'createEvent',
            action: 'Create event in a calendar',
          },
          {
            name: 'Delete Event',
            value: 'deleteEvent',
            action: 'Delete event from a calendar',
          },
          {
            name: 'List Calendars',
            value: 'listCalendars',
            action: 'List calendars',
          },
          {
            name: 'List Events',
            value: 'listEvents',
            action: 'List events from a calendar',
          },
          {
            name: 'Update Event',
            value: 'updateEvent',
            action: 'Update event from a calendar',
          },
        ],
        default: 'listCalendars',
      },
      // Contact Operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: {
            resource: [
              'contact',
            ],
          },
        },
        options: [
          {
            name: 'List Contacts',
            value: 'listContacts',
            action: 'List contacts',
          },
          {
            name: 'Create Contact',
            value: 'createContact',
            action: 'Create contact',
          },
          {
            name: 'Update Contact',
            value: 'updateContact',
            action: 'Update contact',
          },
          {
            name: 'Delete Contact',
            value: 'deleteContact',
            action: 'Delete contact',
          },
        ],
        default: 'listContacts',
      },
      // Common parameter: Grant ID
      {
        displayName: 'Grant ID',
        name: 'grantId',
        type: 'string',
        default: '',
        required: true,
        description: 'The Nylas Grant ID for the connected account (e.g., user email or calendar). This ID is obtained after a user authenticates with Nylas.',
      },
      // --- Email Send Message Parameters ---
      {
				displayName: 'Recipients',
				name: 'recipients',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				default: {
					recipient: [
						{
							email: '',
							name: '',
						},
					],
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['sendMessage'],
					},
				},
				description: 'List of email recipients',
				options: [
					{
						name: 'recipient',
						displayName: 'Recipient',
						values: [
							{
								displayName: 'Email',
								name: 'email',
								type: 'string',
								required: true,
								placeholder: 'john@example.com',
								description: 'Email address of the recipient',
								default: '',
							},
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								placeholder: 'John Doe',
								description: 'Display name of the recipient (optional)',
								default: '',
							},
						],
					},
				],
			},
      {
        displayName: 'Subject',
        name: 'subject',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['email'],
            operation: ['sendMessage'],
          },
        },
        description: 'The subject line of the email',
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        typeOptions: {
          rows: 5,
        },
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['email'],
            operation: ['sendMessage'],
          },
        },
        description: 'The main content of the email message',
      },
      {
        displayName: 'Scheduled Send (Unix Timestamp)',
        name: 'sendAt',
        type: 'number',
        default: 0,
        placeholder: 'e.g., 1719105508',
        displayOptions: {
          show: {
            resource: ['email'],
            operation: ['sendMessage'],
          },
        },
        description: 'Optional: Unix timestamp (in seconds) for when to send the email. Set to 0 for immediate send.',
      },
      {
        displayName: 'Use Draft',
        name: 'useDraft',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: {
            resource: ['email'],
            operation: ['sendMessage'],
          },
        },
        description: 'Whether the message is saved as a draft on the provider (Google/Microsoft only) until the scheduled send time',
      },
      // --- Email List Messages Parameters ---
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 50,
        typeOptions: {
          minValue: 1,
        },
        displayOptions: {
          show: {
            resource: ['email', 'calendar', 'contact'],
            operation: ['listMessages', 'listCalendars', 'listEvents', 'listContacts'],
          },
        },
        description: 'Max number of results to return',
      },
      {
        displayName: 'Subject Filter',
        name: 'subjectFilter',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['email'],
            operation: ['listMessages'],
          },
        },
        description: 'Optional: Filter messages by subject (case-insensitive partial match)',
      },
      // --- Calendar Common Parameters ---
      {
        displayName: 'Calendar ID',
        name: 'calendarId',
        type: 'string',
        default: 'primary',
        required: true,
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['createEvent', 'listEvents', 'updateEvent'],
          },
        },
        description: 'The ID of the calendar to interact with. Use "primary" for the default calendar.',
      },
      {
        displayName: 'Event ID',
        name: 'eventId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['updateEvent', 'deleteEvent'],
          },
        },
        description: 'The ID of the event to update or delete',
      },
      // --- Calendar Create/Update Event Parameters ---
      {
        displayName: 'Event Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['createEvent', 'updateEvent'],
          },
        },
        description: 'The title of the calendar event',
      },
      {
        displayName: 'Start Time (Unix Timestamp)',
        name: 'startTime',
        type: 'number',
        default: 0,
        required: true,
        placeholder: 'e.g., 1719105508',
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['createEvent', 'updateEvent'],
          },
        },
        description: 'Unix timestamp (in seconds) for the event start time',
      },
      {
        displayName: 'End Time (Unix Timestamp)',
        name: 'endTime',
        type: 'number',
        default: 0,
        required: true,
        placeholder: 'e.g., 1719109108',
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['createEvent', 'updateEvent'],
          },
        },
        description: 'Unix timestamp (in seconds) for the event end time',
      },
      {
        displayName: 'Participants',
        name: 'participants',
        type: 'json',
        default: '[]',
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['createEvent', 'updateEvent'],
          },
        },
        description: 'JSON array of participant objects (e.g., [{"email": "john.doe@example.com"}])',
      },
      {
        displayName: 'Location',
        name: 'location',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['createEvent', 'updateEvent'],
          },
        },
        description: 'Optional: The physical or virtual location of the event',
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        default: '',
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['createEvent', 'updateEvent'],
          },
        },
        description: 'Optional: A detailed description of the event',
      },
      // --- Calendar List Events Specific Parameters ---
      {
        displayName: 'Events Start Filter (Unix Timestamp)',
        name: 'start',
        type: 'number',
        default: 0,
        placeholder: 'e.g., 1719105508',
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['listEvents'],
          },
        },
        description: 'Optional: Filter events starting after this Unix timestamp (in seconds)',
      },
      {
        displayName: 'Events End Filter (Unix Timestamp)',
        name: 'end',
        type: 'number',
        default: 0,
        placeholder: 'e.g., 1719109108',
        displayOptions: {
          show: {
            resource: ['calendar'],
            operation: ['listEvents'],
          },
        },
        description: 'Optional: Filter events ending before this Unix timestamp (in seconds)',
      },
      // --- Contact Create/Update/List Parameters ---
      {
        displayName: 'Contact ID',
        name: 'contactId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['updateContact', 'deleteContact'],
          },
        },
        description: 'The ID of the contact to update or delete',
      },
      {
        displayName: 'Given Name',
        name: 'givenName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['createContact', 'updateContact'],
          },
        },
        description: 'The first name of the contact',
      },
      {
        displayName: 'Surname',
        name: 'surname',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['createContact', 'updateContact'],
          },
        },
        description: 'The last name of the contact',
      },
      {
        displayName: 'Emails',
        name: 'emails',
        type: 'json',
        default: '[{"type": "work", "email": ""}]',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['createContact', 'updateContact'],
          },
        },
        description: 'JSON array of email objects (e.g., [{"type": "work", "email": "john.doe@example.com"}])',
      },
      {
        displayName: 'Phone Numbers',
        name: 'phoneNumbers',
        type: 'json',
        default: '[]',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['createContact', 'updateContact'],
          },
        },
        description: 'JSON array of phone number objects (e.g., [{"type": "mobile", "number": "+15551234567"}])',
      },
      // --- Contact List Contacts Specific Parameters ---
      {
        displayName: 'Email Filter',
        name: 'emailFilter',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['listContacts'],
          },
        },
        description: 'Optional: Filter contacts by email address',
      },
      {
        displayName: 'Phone Number Filter',
        name: 'phoneNumberFilter',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['listContacts'],
          },
        },
        description: 'Optional: Filter contacts by phone number',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('nylasApi'); // Retrieve credentials securely

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const resource = this.getNodeParameter('resource', itemIndex) as string;
      const operation = this.getNodeParameter('operation', itemIndex) as string;
      const grantId = this.getNodeParameter('grantId', itemIndex) as string;

      let responseData: any;
      let options: IRequestOptions;

      try {
        switch (resource) {
          case 'email':
            switch (operation) {
              case 'sendMessage': {
								// Get recipients from the fixedCollection
								const recipientsData = this.getNodeParameter('recipients', itemIndex, {}) as {
									recipient?: Array<{ email: string; name?: string }>;
								};

								const recipientList = recipientsData.recipient || [];

								// Validate recipients
								if (recipientList.length === 0) {
									throw new NodeOperationError(this.getNode(), 'At least one recipient is required');
								}

								const toRecipients: NylasEmailRecipient[] = [];

								for (let i = 0; i < recipientList.length; i++) {
									const recipient = recipientList[i];

									if (!recipient.email || recipient.email.trim() === '') {
										throw new NodeOperationError(this.getNode(), `Recipient ${i + 1}: Email address is required`);
									}

									// Validate email format (basic validation)
									const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
									if (!emailRegex.test(recipient.email.trim())) {
										throw new NodeOperationError(this.getNode(), `Recipient ${i + 1}: Invalid email format - ${recipient.email}`);
									}

									const recipientObj: NylasEmailRecipient = {
										email: recipient.email.trim(),
									};

									// Add name if provided
									if (recipient.name && recipient.name.trim()) {
										recipientObj.name = recipient.name.trim();
									}

									toRecipients.push(recipientObj);
								}

								const subject = this.getNodeParameter('subject', itemIndex) as string;
								const body = this.getNodeParameter('body', itemIndex) as string;
								const sendAt = this.getNodeParameter('sendAt', itemIndex, 0) as number;
								const useDraft = this.getNodeParameter('useDraft', itemIndex, false) as boolean;

								// Validate required fields
								if (!subject.trim()) {
									throw new NodeOperationError(this.getNode(), 'Subject cannot be empty');
								}
								if (!body.trim()) {
									throw new NodeOperationError(this.getNode(), 'Body cannot be empty');
								}

								const requestBody: NylasEmailSendRequest = {
									to: toRecipients,
									subject: subject.trim(),
									body: body,
								};

								// Add optional parameters only if they have valid values
								if (sendAt > 0) {
									requestBody.send_at = sendAt;
								}
								if (useDraft) {
									requestBody.use_draft = useDraft;
								}

								options = {
									method: 'POST',
									uri: `${credentials.apiUri}/v3/grants/${grantId}/messages/send`,
									body: requestBody,
									json: true,
									headers: {
										'Content-Type': 'application/json',
									},
								};

								try {
									responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
								} catch (error: any) {
									// Use NodeApiError for API-related errors
									const errorMessage = error.response?.body?.message || error.message || 'Unknown error occurred';
									const statusCode = error.response?.statusCode;

									throw new NodeApiError(this.getNode(), error, {
										message: `Nylas API Error: ${errorMessage}`,
										httpCode: statusCode,
										description: 'Failed to send email via Nylas API',
									});
								}
								break;
							}
              case 'listMessages': {
                const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
                const subjectFilter = this.getNodeParameter('subjectFilter', itemIndex, '') as string;

                const qs: { [key: string]: any } = { limit: limit };
                if (subjectFilter) {
                  qs.subject = subjectFilter;
                }

                options = {
                  method: 'GET',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/messages`,
                  qs: qs,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
            }
            break;

          case 'calendar':
            switch (operation) {
              case 'listCalendars': {
                const limit = this.getNodeParameter('limit', itemIndex, 50) as number;

                options = {
                  method: 'GET',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/calendars`,
                  qs: { limit: limit },
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
              case 'createEvent': {
                const calendarId = this.getNodeParameter('calendarId', itemIndex) as string;
                const title = this.getNodeParameter('title', itemIndex) as string;
                const startTime = this.getNodeParameter('startTime', itemIndex) as number;
                const endTime = this.getNodeParameter('endTime', itemIndex) as number;
                const participants = this.getNodeParameter('participants', itemIndex) as NylasCalendarParticipant[];
                const location = this.getNodeParameter('location', itemIndex, '') as string;
                const description = this.getNodeParameter('description', itemIndex, '') as string;

                const requestBody: NylasCalendarEventRequest = {
                  calendar_id: calendarId,
                  title: title,
                  when: {
                    start_time: startTime,
                    end_time: endTime,
                    object: 'time',
                  },
                };
                if (participants && participants.length > 0) requestBody.participants = participants;
                if (location) requestBody.location = location;
                if (description) requestBody.description = description;

                options = {
                  method: 'POST',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/events`,
                  body: requestBody,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
              case 'listEvents': {
                const calendarId = this.getNodeParameter('calendarId', itemIndex) as string;
                const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
                const start = this.getNodeParameter('start', itemIndex, 0) as number;
                const end = this.getNodeParameter('end', itemIndex, 0) as number;

                const qs: { [key: string]: any } = { calendar_id: calendarId, limit: limit };
                if (start > 0) qs.start = start;
                if (end > 0) qs.end = end;

                options = {
                  method: 'GET',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/events`,
                  qs: qs,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
              case 'updateEvent': {
                const eventId = this.getNodeParameter('eventId', itemIndex) as string;
                const calendarId = this.getNodeParameter('calendarId', itemIndex) as string;
                const title = this.getNodeParameter('title', itemIndex, '') as string;
                const startTime = this.getNodeParameter('startTime', itemIndex, 0) as number;
                const endTime = this.getNodeParameter('endTime', itemIndex, 0) as number;
                const participants = this.getNodeParameter('participants', itemIndex) as NylasCalendarParticipant[];
                const location = this.getNodeParameter('location', itemIndex, '') as string;
                const description = this.getNodeParameter('description', itemIndex, '') as string;

                const requestBody: Partial<NylasCalendarEventRequest> = {
                  calendar_id: calendarId,
                };
                if (title) requestBody.title = title;
                if (startTime > 0 && endTime > 0) {
                  requestBody.when = { start_time: startTime, end_time: endTime, object: 'time' };
                }
                if (participants && participants.length > 0) requestBody.participants = participants;
                if (location) requestBody.location = location;
                if (description) requestBody.description = description;

                options = {
                  method: 'PUT',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/events/${eventId}`,
                  body: requestBody,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
              case 'deleteEvent': {
                const eventId = this.getNodeParameter('eventId', itemIndex) as string;

                options = {
                  method: 'DELETE',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/events/${eventId}`,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
            }
            break;

          case 'contact':
            switch (operation) {
              case 'listContacts': {
                const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
                const emailFilter = this.getNodeParameter('emailFilter', itemIndex, '') as string;
                const phoneNumberFilter = this.getNodeParameter('phoneNumberFilter', itemIndex, '') as string;

                const qs: { [key: string]: any } = { limit: limit };
                if (emailFilter) qs.email = emailFilter;
                if (phoneNumberFilter) qs.phone_number = phoneNumberFilter;

                options = {
                  method: 'GET',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/contacts`,
                  qs: qs,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
              case 'createContact': {
                const givenName = this.getNodeParameter('givenName', itemIndex) as string;
                const surname = this.getNodeParameter('surname', itemIndex) as string;
                const emails = this.getNodeParameter('emails', itemIndex) as NylasContactEmail[];
                const phoneNumbers = this.getNodeParameter('phoneNumbers', itemIndex) as NylasContactPhoneNumber[];

                const requestBody: NylasContactRequest = {
                  given_name: givenName,
                  surname: surname,
                };
                if (emails && emails.length > 0) requestBody.emails = emails;
                if (phoneNumbers && phoneNumbers.length > 0) requestBody.phone_numbers = phoneNumbers;

                options = {
                  method: 'POST',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/contacts`,
                  body: requestBody,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
              case 'updateContact': {
                const contactId = this.getNodeParameter('contactId', itemIndex) as string;
                const givenName = this.getNodeParameter('givenName', itemIndex, '') as string;
                const surname = this.getNodeParameter('surname', itemIndex, '') as string;
                const emails = this.getNodeParameter('emails', itemIndex) as NylasContactEmail[];
                const phoneNumbers = this.getNodeParameter('phoneNumbers', itemIndex) as NylasContactPhoneNumber[];

                const requestBody: Partial<NylasContactRequest> = {};
                if (givenName) requestBody.given_name = givenName;
                if (surname) requestBody.surname = surname;
                if (emails && emails.length > 0) requestBody.emails = emails;
                if (phoneNumbers && phoneNumbers.length > 0) requestBody.phone_numbers = phoneNumbers;

                options = {
                  method: 'PUT',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/contacts/${contactId}`,
                  body: requestBody,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
              case 'deleteContact': {
                const contactId = this.getNodeParameter('contactId', itemIndex) as string;

                options = {
                  method: 'DELETE',
                  uri: `${credentials.apiUri}/v3/grants/${grantId}/contacts/${contactId}`,
                  json: true,
                };
                responseData = await this.helpers.requestWithAuthentication.call(this, 'nylasApi', options);
                break;
              }
            }
            break;
        }
        returnData.push({ json: responseData });
      } catch (error: any) {
        // Error handling for individual items
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error; // Re-throw if not configured to continue on fail
        }
      }
    }
    return [returnData];
  }
}
