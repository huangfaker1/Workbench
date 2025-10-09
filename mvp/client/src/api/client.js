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
  getMetricLinkedNotes: (id) => request(`/api/metrics/${id}/linked-notes`)
};
