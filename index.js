const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://mail.google.com/'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(
  process.cwd(),
  '/config/google/doordash/token.json'
);
const CREDENTIALS_PATH = path.join(
  process.cwd(),
  '/config/google/doordash/google_credentials.json'
);

// ? Reads previously authorized credentials from the save file.
const loadSavedCredentialsIfExist = async () => {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
};

// ? Serializes credentials to a file compatible with GoogleAUth.fromJSON.
const saveCredentials = async (client) => {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
};

//?Load or request or authorization to call APIs.
const authorize = async (email_id) => {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return { client, email_id };
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return { client, email_id };
};

// ? Get Mail Message
const getMessageFromId = async ({ userId, id, auth }) => {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.get({
    userId,
    id,
  });
  return res.data;
};

// ? Lists the labels in the user's account.
const listLabels = async ({ client: auth, email_id }) => {
  const gmail = google.gmail({ version: 'v1', auth });
  const {
    data: { messages },
  } = await gmail.users.messages.list({
    userId: 'kitchencentral@voosh.in',
    q: `from:(<no-reply@doordash.com>) to:(${email_id}) Your verification code is`,
  });

  if (!messages || messages.length === 0) {
    console.log('No Messages found.');
    return;
  }

  const search_message = messages.map(async (message, index) => {
    const message_content = await getMessageFromId({
      id: message.id,
      userId: 'kitchencentral@voosh.in',
      auth,
    });

    return message_content.snippet;
  });

  const promised_message = await Promise.all(search_message);
  let finalValue = promised_message[0];
  finalValue = finalValue.split('Your verification code is: ');
  return finalValue[1].substring(0, 6);
};

const emailAuthenticationDoorDash = async (emailId) => {
  return await authorize(emailId).then(listLabels).catch(console.error);
};

module.exports = {
  emailAuthenticationDoorDash,
};
