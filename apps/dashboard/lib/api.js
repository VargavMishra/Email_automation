function buildError(message, status, payload) {
  const error = new Error(message);
  error.status = status;
  error.payload = payload;
  return error;
}

const API_REQUEST_TIMEOUT_MS = 60000;

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {})
      },
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw buildError('Request timed out while waiting for backend email processing.', 504);
    }

    throw buildError('Network error while reaching the backend API.', 502);
  }

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw buildError(
      payload?.message ?? payload?.error ?? `Request failed with status ${response.status}.`,
      response.status,
      payload
    );
  }

  return payload;
}

export function login(input) {
  return request('/api/auth/login', {
    method: 'POST',
    body: input
  });
}

export function signup(input) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: input
  });
}

export function forgotPassword(input) {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: input
  });
}

export function resetPassword(input) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: input
  });
}

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST'
  });
}

export function getSession() {
  return request('/api/auth/me');
}

export function getDashboardData() {
  return request('/api/studio/dashboard');
}

export function createClient(body) {
  return request('/api/studio/clients', {
    method: 'POST',
    body
  });
}

export function updateClient(clientId, body) {
  return request(`/api/studio/clients/${clientId}`, {
    method: 'PATCH',
    body
  });
}

export function createProject(body) {
  return request('/api/studio/projects', {
    method: 'POST',
    body
  });
}

export function updateProject(projectId, body) {
  return request(`/api/studio/projects/${projectId}`, {
    method: 'PATCH',
    body
  });
}

export function previewTemplate(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });

  return request(`/api/studio/templates/preview?${searchParams.toString()}`);
}

export function deleteClient(clientId) {
  return request(`/api/studio/clients/${clientId}`, {
    method: 'DELETE'
  });
}

export function deleteProject(projectId) {
  return request(`/api/studio/projects/${projectId}`, {
    method: 'DELETE'
  });
}

export function manualSendProject(projectId, body) {
  return request(`/api/studio/projects/${projectId}/manual-send`, {
    method: 'POST',
    body
  });
}
