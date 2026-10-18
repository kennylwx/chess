const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

if (!requestUrl || !requestToken) {
  throw new Error('GitHub OIDC is unavailable. The workflow needs id-token: write.');
}

const oidcUrl = new URL(requestUrl);
oidcUrl.searchParams.set('audience', 'npm:registry.npmjs.org');
const oidcResponse = await fetch(oidcUrl, {
  headers: { Authorization: `Bearer ${requestToken}` },
  signal: AbortSignal.timeout(30_000),
});
if (!oidcResponse.ok) {
  throw new Error(`GitHub OIDC request failed (HTTP ${oidcResponse.status}).`);
}

const { value: oidcToken } = await oidcResponse.json();
if (!oidcToken) throw new Error('GitHub OIDC response did not contain a token.');

const packageName = encodeURIComponent('zchess');
const npmResponse = await fetch(`https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${packageName}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${oidcToken}` },
  signal: AbortSignal.timeout(30_000),
});
if (!npmResponse.ok) {
  throw new Error(`npm rejected this workflow as a trusted publisher (HTTP ${npmResponse.status}). First publish zchess from your npm account, then configure its trusted publisher for kennylwx/zchess, release.yml, and production.`);
}

console.log('npm trusted publisher exchange succeeded.');
