import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createSignedJwt({ clientEmail, privateKey, tokenUrl = GOOGLE_TOKEN_URL, issuedAt = Math.floor(Date.now() / 1000) }) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: clientEmail,
    scope: GOOGLE_CALENDAR_SCOPE,
    aud: tokenUrl,
    exp: issuedAt + 3600,
    iat: issuedAt,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function loadGoogleServiceAccountFromEnv(env = process.env) {
  const inlineJson = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const jsonPath = env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH?.trim();

  if (!inlineJson && !jsonPath) {
    return null;
  }

  const raw = inlineJson || await fs.readFile(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Google service account JSON must include client_email and private_key');
  }

  return parsed;
}

export async function getGoogleAccessToken(serviceAccount, { fetchImpl = fetch } = {}) {
  const assertion = createSignedJwt({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  });

  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    throw new Error(`Failed to obtain Google access token (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload.access_token;
}

async function googleCalendarRequest(pathname, { method = 'GET', accessToken, body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`https://www.googleapis.com/calendar/v3${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Google Calendar API ${method} ${pathname} failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

export async function createGoogleCalendarClient({ env = process.env, fetchImpl = fetch } = {}) {
  const serviceAccount = await loadGoogleServiceAccountFromEnv(env);
  if (!serviceAccount) {
    return null;
  }

  const accessToken = await getGoogleAccessToken(serviceAccount, { fetchImpl });

  return {
    async insertEvent(calendarId, event) {
      return googleCalendarRequest(`/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        accessToken,
        body: event,
        fetchImpl,
      });
    },
    async patchEvent(calendarId, eventId, event) {
      return googleCalendarRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        accessToken,
        body: event,
        fetchImpl,
      });
    },
    async deleteEvent(calendarId, eventId) {
      return googleCalendarRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        accessToken,
        fetchImpl,
      });
    },
  };
}
