import axios from 'axios';

/**
 * Creates an Axios instance configured for Jira REST API v3.
 * Reads credentials from environment variables on each call
 * so updated config is picked up without restart.
 */
function getClient() {
  const baseURL = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseURL || !email || !apiToken) {
    throw new Error('Jira configuration is incomplete. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.');
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

  return axios.create({
    baseURL: `${baseURL.replace(/\/$/, '')}/rest/api/3`,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * Create a Jira issue.
 * @param {object} params - { projectKey, summary, description, issueType }
 * @returns {object} Created issue data from Jira
 */
export async function createIssue({ projectKey, summary, description, issueType = 'Bug' }) {
  const client = getClient();

  const body = {
    fields: {
      project: { key: projectKey },
      summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: description || '' }],
          },
        ],
      },
      issuetype: { name: issueType },
    },
  };

  const response = await client.post('/issue', body);
  return response.data;
}

/**
 * Retrieve a Jira issue by key.
 * @param {string} issueKey - e.g. "CTB-123"
 * @returns {object} Issue data from Jira
 */
export async function getIssue(issueKey) {
  const client = getClient();
  const response = await client.get(`/issue/${issueKey}`);
  return response.data;
}

/**
 * Search Jira issues using JQL.
 * @param {string} jql - JQL query string
 * @param {number} maxResults - Max results to return (default 50)
 * @returns {object} Search results from Jira
 */
export async function searchIssues(jql, maxResults = 50) {
  const client = getClient();
  const response = await client.get('/search', {
    params: { jql, maxResults },
  });
  return response.data;
}
