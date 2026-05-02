async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = '请求失败';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (error) {
      // ignore json parse error
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  listNotes: () => request('/api/notes'),
  getNote: (id) => request(`/api/notes/${id}`),
  createNote: (payload) => request('/api/notes', { method: 'POST', body: JSON.stringify(payload) }),
  updateNote: (id, payload) => request(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),
  getNoteHistory: (id) => request(`/api/notes/${id}/history`),
  getNoteRelatedMetrics: (id) => request(`/api/notes/${id}/related-metrics`),

  listMetrics: (query) => {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    return request(`/api/metrics${suffix}`);
  },
  searchMetrics: (query) => {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
    return request(`/api/metrics/search${suffix}`);
  },
  getMetric: (id) => request(`/api/metrics/${id}`),
  createMetric: (payload) => request('/api/metrics', { method: 'POST', body: JSON.stringify(payload) }),
  updateMetric: (id, payload) => request(`/api/metrics/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  publishMetricVersion: (id, payload) => request(`/api/metrics/${id}/publish`, { method: 'POST', body: JSON.stringify(payload) }),
  getMetricVersions: (id) => request(`/api/metrics/${id}/versions`),
  getMetricLinkedNotes: (id) => request(`/api/metrics/${id}/linked-notes`),

  // Decision system
  getDashboard: () => request('/api/dashboard'),
  listDecisions: (filters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/decisions${suffix}`);
  },
  getDecision: (id) => request(`/api/decisions/${id}`),
  createDecision: (payload) => request('/api/decisions', { method: 'POST', body: JSON.stringify(payload) }),
  updateDecision: (id, payload) => request(`/api/decisions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDecision: (id) => request(`/api/decisions/${id}`, { method: 'DELETE' }),

  listActionsForDecision: (decisionId) => request(`/api/decisions/${decisionId}/actions`),
  createAction: (decisionId, payload) => request(`/api/decisions/${decisionId}/actions`, { method: 'POST', body: JSON.stringify(payload) }),
  listAllActions: (filters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.owner) params.set('owner', filters.owner);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/actions${suffix}`);
  },
  updateAction: (id, payload) => request(`/api/actions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAction: (id) => request(`/api/actions/${id}`, { method: 'DELETE' }),

  listAnomalies: (filters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.metricId) params.set('metricId', filters.metricId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/anomalies${suffix}`);
  },
  getAnomaly: (id) => request(`/api/anomalies/${id}`),
  createAnomaly: (payload) => request('/api/anomalies', { method: 'POST', body: JSON.stringify(payload) }),
  updateAnomaly: (id, payload) => request(`/api/anomalies/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  traceAnomaly: (id) => request(`/api/anomalies/${id}/trace`, { method: 'POST' }),

  listScenarios: () => request('/api/scenarios'),
  getScenario: (id) => request(`/api/scenarios/${id}`),
  createScenario: (payload) => request('/api/scenarios', { method: 'POST', body: JSON.stringify(payload) }),
  updateScenario: (id, payload) => request(`/api/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteScenario: (id) => request(`/api/scenarios/${id}`, { method: 'DELETE' }),
  runSimulation: (id) => request(`/api/scenarios/${id}/simulate`, { method: 'POST' })
};
