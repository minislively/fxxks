'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function codexHomeFrom({ args = {}, env = process.env } = {}) {
  return path.resolve(
    nonEmptyString(args['codex-home'])
      || nonEmptyString(env.FOOKS_CODEX_HOME)
      || nonEmptyString(env.CODEX_HOME)
      || path.join(os.homedir(), '.codex'),
  );
}

function safeReadJson(filePath) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (error) {
    return { ok: false, error };
  }
}

function codexAuthPathFrom({ args = {}, env = process.env } = {}) {
  return path.resolve(
    nonEmptyString(args['codex-auth-json'])
      || path.join(codexHomeFrom({ args, env }), 'auth.json'),
  );
}

function authHeaders(auth) {
  const headers = {
    Authorization: `Bearer ${auth.token}`,
  };
  if (auth.credentialKind === 'codex-oauth' && auth.accountId) {
    headers['chatgpt-account-id'] = auth.accountId;
  }
  return headers;
}

function resolveOpenAILiveAuth({ args = {}, env = process.env } = {}) {
  const mode = nonEmptyString(args['auth-mode'] || args['openai-auth-mode']) || 'auto';
  const reasons = [];
  if (!['auto', 'api-key', 'codex-oauth'].includes(mode)) {
    return {
      ok: false,
      mode,
      credentialKind: null,
      source: null,
      token: null,
      accountId: null,
      authJsonPath: null,
      headers: {},
      reasons: [`unsupported auth mode: ${mode}`],
    };
  }

  const envApiKey = nonEmptyString(env.OPENAI_API_KEY || env.OPEN_AI_APIKEY);
  if (mode !== 'codex-oauth' && envApiKey) {
    return {
      ok: true,
      mode,
      credentialKind: 'openai-api-key',
      source: env.OPENAI_API_KEY ? 'env:OPENAI_API_KEY' : 'env:OPEN_AI_APIKEY',
      token: envApiKey,
      accountId: null,
      authJsonPath: null,
      headers: { Authorization: `Bearer ${envApiKey}` },
      reasons: [],
    };
  }
  if (mode !== 'codex-oauth') {
    reasons.push('OPENAI_API_KEY/OPEN_AI_APIKEY not set');
  }

  const envOAuth = nonEmptyString(env.CODEX_OAUTH_ACCESS_TOKEN || env.OPENAI_OAUTH_ACCESS_TOKEN);
  const envAccountId = nonEmptyString(env.CODEX_ACCOUNT_ID || env.OPENAI_CHATGPT_ACCOUNT_ID);
  if (mode !== 'api-key' && envOAuth) {
    const resolved = {
      ok: true,
      mode,
      credentialKind: 'codex-oauth',
      source: env.CODEX_OAUTH_ACCESS_TOKEN ? 'env:CODEX_OAUTH_ACCESS_TOKEN' : 'env:OPENAI_OAUTH_ACCESS_TOKEN',
      token: envOAuth,
      accountId: envAccountId,
      authJsonPath: null,
      headers: {},
      reasons: envAccountId ? [] : ['Codex OAuth access token found in env without account id header'],
    };
    resolved.headers = authHeaders(resolved);
    return resolved;
  }
  if (mode !== 'api-key') {
    reasons.push('CODEX_OAUTH_ACCESS_TOKEN/OPENAI_OAUTH_ACCESS_TOKEN not set');
  }

  const authJsonPath = codexAuthPathFrom({ args, env });
  if (mode !== 'api-key') {
    if (!fs.existsSync(authJsonPath)) {
      reasons.push(`Codex auth.json not found at ${authJsonPath}`);
    } else {
      const parsed = safeReadJson(authJsonPath);
      if (!parsed.ok) {
        reasons.push(`Codex auth.json could not be parsed: ${parsed.error.message}`);
      } else {
        const authJson = parsed.value || {};
        const accessToken = nonEmptyString(authJson.tokens?.access_token);
        const accountId = nonEmptyString(authJson.tokens?.account_id);
        if (accessToken) {
          const resolved = {
            ok: true,
            mode,
            credentialKind: 'codex-oauth',
            source: 'codex-auth-json',
            token: accessToken,
            accountId,
            authJsonPath,
            authMode: nonEmptyString(authJson.auth_mode),
            headers: {},
            reasons: accountId ? [] : ['Codex auth.json access token found without tokens.account_id'],
          };
          resolved.headers = authHeaders(resolved);
          return resolved;
        }
        reasons.push(`Codex auth.json at ${authJsonPath} does not contain tokens.access_token`);

        const authJsonApiKey = nonEmptyString(authJson.OPENAI_API_KEY);
        if (mode === 'auto' && authJsonApiKey) {
          return {
            ok: true,
            mode,
            credentialKind: 'openai-api-key',
            source: 'codex-auth-json:OPENAI_API_KEY',
            token: authJsonApiKey,
            accountId: null,
            authJsonPath,
            headers: { Authorization: `Bearer ${authJsonApiKey}` },
            reasons: [],
          };
        }
      }
    }
  }

  return {
    ok: false,
    mode,
    credentialKind: null,
    source: null,
    token: null,
    accountId: null,
    authJsonPath: mode === 'api-key' ? null : authJsonPath,
    headers: {},
    reasons,
  };
}

function publicAuthSummary(auth) {
  return {
    ok: auth.ok,
    mode: auth.mode,
    credentialKind: auth.credentialKind,
    source: auth.source,
    authJsonPath: auth.authJsonPath,
    authMode: auth.authMode,
    hasAccountId: Boolean(auth.accountId),
    headerNames: Object.keys(auth.headers || {}),
    reasons: auth.reasons || [],
  };
}

module.exports = {
  codexHomeFrom,
  codexAuthPathFrom,
  resolveOpenAILiveAuth,
  publicAuthSummary,
};
