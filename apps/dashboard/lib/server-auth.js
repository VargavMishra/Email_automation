const apiBaseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4500';

export const authCookieNames = {
  access: 'studio_access_token',
  refresh: 'studio_refresh_token'
};

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge
  };
}

async function backendRequest(path, options = {}) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    return {
      response,
      payload
    };
  } catch (error) {
    const isTimeoutError = error?.name === 'TimeoutError';
    return {
      response: {
        ok: false,
        status: isTimeoutError ? 504 : 502
      },
      payload: {
        message: isTimeoutError
          ? 'Backend request timed out. Please check Render logs and email provider settings.'
          : 'Backend request failed. Please verify API_BASE_URL and network connectivity.'
      }
    };
  }
}

async function fetchCurrentUser(accessToken) {
  return backendRequest('/api/auth/me', {
    accessToken
  });
}

export async function loginWithBackend(input) {
  return backendRequest('/api/auth/login', {
    method: 'POST',
    body: input
  });
}

export async function signupWithBackend(input) {
  return backendRequest('/api/auth/signup', {
    method: 'POST',
    body: input
  });
}

export async function forgotPasswordWithBackend(input) {
  return backendRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: input
  });
}

export async function resetPasswordWithBackend(input) {
  return backendRequest('/api/auth/reset-password', {
    method: 'POST',
    body: input
  });
}

export async function logoutFromBackend(refreshToken) {
  return backendRequest('/api/auth/logout', {
    method: 'POST',
    body: refreshToken ? { refreshToken } : {}
  });
}

export async function refreshTokens(refreshToken) {
  return backendRequest('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken }
  });
}

export function persistAuthCookies(response, tokens) {
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    return response;
  }

  response.cookies.set(authCookieNames.access, tokens.accessToken, cookieOptions(60 * 15));
  response.cookies.set(authCookieNames.refresh, tokens.refreshToken, cookieOptions(60 * 60 * 24 * 7));

  return response;
}

export function clearAuthCookies(response) {
  response.cookies.set(authCookieNames.access, '', cookieOptions(0));
  response.cookies.set(authCookieNames.refresh, '', cookieOptions(0));

  return response;
}

export async function resolveAuthenticatedSession({ accessToken, refreshToken }) {
  if (accessToken) {
    const me = await fetchCurrentUser(accessToken);

    if (me.response.ok) {
      return {
        ok: true,
        user: me.payload.user,
        accessToken,
        refreshedTokens: null
      };
    }

    if (me.response.status !== 401 || !refreshToken) {
      return {
        ok: false,
        status: me.response.status,
        payload: me.payload
      };
    }
  }

  if (!refreshToken) {
    return {
      ok: false,
      status: 401,
      payload: { message: 'Authentication required.' }
    };
  }

  const refresh = await refreshTokens(refreshToken);

  if (!refresh.response.ok) {
    return {
      ok: false,
      status: refresh.response.status,
      payload: refresh.payload
    };
  }

  const tokens = refresh.payload?.tokens;
  const me = await fetchCurrentUser(tokens.accessToken);

  if (!me.response.ok) {
    return {
      ok: false,
      status: me.response.status,
      payload: me.payload
    };
  }

  return {
    ok: true,
    user: me.payload.user,
    accessToken: tokens.accessToken,
    refreshedTokens: tokens
  };
}

export async function authenticatedBackendRequest({ path, method = 'GET', accessToken, body }) {
  return backendRequest(path, {
    method,
    accessToken,
    body
  });
}

export function authenticatedBackendStream({ path, accessToken, signal }) {
  return fetch(`${apiBaseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${accessToken}`
    },
    cache: 'no-store',
    signal
  });
}
