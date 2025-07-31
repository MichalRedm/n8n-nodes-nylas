# n8n-nodes-nylas

This is an n8n community node. It lets you use Nylas API in your n8n workflows.

Nylas is a communication API that provides a unified platform for integrating email, calendar, and contacts into applications.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

This node supports the following resources and operations:

### Email
*   **Send Message**: Send an email message to specified recipients.
*   **List Messages**: Retrieve a list of email messages, with optional subject filtering.

### Calendar
*   **Create Event**: Create a new event in a specified calendar.
*   **Delete Event**: Delete an existing event from a calendar.
*   **List Calendars**: Retrieve a list of available calendars.
*   **List Events**: Retrieve a list of events from a calendar, with optional time filtering.
*   **Update Event**: Update an existing event in a calendar.

### Contact
*   **List Contacts**: Retrieve a list of contacts, with optional email or phone number filtering.
*   **Create Contact**: Create a new contact.
*   **Update Contact**: Update an existing contact.
*   **Delete Contact**: Delete an existing contact.

## Credentials

To use the Nylas node, you need to provide your Nylas API credentials. This node uses **Access Token** authentication.

### Prerequisites
Before setting up credentials in n8n, you need to:
1.  Obtain an Access Token from Nylas. This is typically done via OAuth 2.0 authentication flow, where your application requests access to a user's Nylas account.
2.  Obtain the **Grant ID** for the connected account. The Grant ID is a unique identifier for a user's connection to Nylas, obtained after successful authentication.

### Setting up Credentials in n8n
1.  In n8n, click on "Credentials" in the left sidebar.
2.  Search for "Nylas API" and select it.
3.  Enter your **Access Token** (obtained via OAuth 2.0).
4.  Enter the **API URI**. The default is `https://api.us.nylas.com`.
5.  Save your credentials.

## Compatibility

This node is compatible with n8n `n8nNodesApiVersion: 1` and `n8n-workflow: *`. It is developed and tested against Node.js version 20.15 or higher.

## Resources

*   [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
*   [Nylas API Documentation](https://developer.nylas.com/docs)
