import fs from 'node:fs';
import path from 'node:path';

const url = process.env.APPSYNC_GRAPHQL_URL;
const apiKey = process.env.APPSYNC_API_KEY;

if (!url || !apiKey) {
  throw new Error('Missing APPSYNC_GRAPHQL_URL or APPSYNC_API_KEY environment variable');
}

const payload = {
  data: {
    url,
    api_key: apiKey,
    default_authorization_type: 'API_KEY',
    region: process.env.AWS_REGION || 'eu-central-1',
  },
};

const targets = [
  path.resolve('backend_config.json'),
  path.resolve('src', 'backend_config.json'),
];

for (const target of targets) {
  fs.writeFileSync(target, JSON.stringify(payload, null, 2));
}

console.log('Wrote AppSync config to backend_config.json and src/backend_config.json');
