const express = require('express');
const cors = require('cors');

const {
  listNotes,
  getNoteById,
  getNoteHistory,
  getMetricsForNote,
  createNote,
  updateNote,
  deleteNote,
  listMetrics,
  getMetricById,
  createMetric,
  updateMetric,
  publishMetricVersion,
  getMetricVersions,
  getMetricLinkedNotes,
  searchMetrics,
  // Decision system
  listDecisions,
  getDecisionById,
  createDecision,
  updateDecision,
  deleteDecision,
  listActionsForDecision,
  listAllActions,
  createActionItem,
  updateActionItem,
  deleteActionItem,
  listAnomalies,
  getAnomalyById,
  createAnomaly,
  updateAnomaly,
  traceAnomaly,
  listScenarios,
  getScenarioById,
  createScenario,
  updateScenario,
  deleteScenario,
  runSimulation,
  getDashboardSummary
} = require('./dataStore');

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Notes endpoints
app.get('/api/notes', (_req, res) => {
  res.json(listNotes());
});

app.post('/api/notes', (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }
  const note = createNote(req.body);
  res.status(201).json(getNoteById(note.id));
});

app.get('/api/notes/:id', (req, res) => {
  const note = getNoteById(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'note not found' });
  }
  res.json(note);
});

app.put('/api/notes/:id', (req, res) => {
  const note = updateNote(req.params.id, req.body);
  if (!note) {
    return res.status(404).json({ error: 'note not found' });
  }
  res.json(getNoteById(req.params.id));
});

app.delete('/api/notes/:id', (req, res) => {
  const deleted = deleteNote(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'note not found' });
  }
  res.status(204).end();
});

app.get('/api/notes/:id/history', (req, res) => {
  const note = getNoteById(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'note not found' });
  }
  res.json(getNoteHistory(req.params.id));
});

app.get('/api/notes/:id/related-metrics', (req, res) => {
  const note = getNoteById(req.params.id);
  if (!note) {
    return res.status(404).json({ error: 'note not found' });
  }
  res.json(getMetricsForNote(req.params.id));
});

// Metrics endpoints
app.get('/api/metrics', (req, res) => {
  const { q } = req.query;
  res.json(listMetrics({ query: q }));
});

app.get('/api/metrics/search', (req, res) => {
  const { q } = req.query;
  res.json(searchMetrics(q));
});

app.post('/api/metrics', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const metric = createMetric(req.body);
  res.status(201).json(metric);
});

app.get('/api/metrics/:id', (req, res) => {
  const metric = getMetricById(req.params.id);
  if (!metric) {
    return res.status(404).json({ error: 'metric not found' });
  }
  res.json(metric);
});

app.put('/api/metrics/:id', (req, res) => {
  const metric = updateMetric(req.params.id, req.body);
  if (!metric) {
    return res.status(404).json({ error: 'metric not found' });
  }
  res.json(metric);
});

app.post('/api/metrics/:id/publish', (req, res) => {
  const { version, definition, formula, source } = req.body;
  if (!version || !definition || !formula || !source) {
    return res.status(400).json({ error: 'version, definition, formula, source are required' });
  }
  const metric = publishMetricVersion(req.params.id, req.body);
  if (!metric) {
    return res.status(404).json({ error: 'metric not found' });
  }
  res.json(metric);
});

app.get('/api/metrics/:id/versions', (req, res) => {
  const metric = getMetricById(req.params.id);
  if (!metric) {
    return res.status(404).json({ error: 'metric not found' });
  }
  res.json(getMetricVersions(req.params.id));
});

app.get('/api/metrics/:id/linked-notes', (req, res) => {
  const metric = getMetricById(req.params.id);
  if (!metric) {
    return res.status(404).json({ error: 'metric not found' });
  }
  res.json(getMetricLinkedNotes(req.params.id));
});

// ─── Decision System Routes ─────────────────────────────────────────────

app.get('/api/dashboard', (_req, res) => {
  res.json(getDashboardSummary());
});

// Decisions
app.get('/api/decisions', (req, res) => {
  const { status, priority } = req.query;
  res.json(listDecisions({ status, priority }));
});

app.post('/api/decisions', (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const decision = createDecision(req.body);
  res.status(201).json(decision);
});

app.get('/api/decisions/:id', (req, res) => {
  const decision = getDecisionById(req.params.id);
  if (!decision) {
    return res.status(404).json({ error: 'decision not found' });
  }
  res.json(decision);
});

app.put('/api/decisions/:id', (req, res) => {
  const decision = updateDecision(req.params.id, req.body);
  if (!decision) {
    return res.status(404).json({ error: 'decision not found' });
  }
  res.json(decision);
});

app.delete('/api/decisions/:id', (req, res) => {
  const deleted = deleteDecision(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'decision not found' });
  }
  res.status(204).end();
});

// Decision Action Items
app.get('/api/decisions/:id/actions', (req, res) => {
  const decision = getDecisionById(req.params.id);
  if (!decision) {
    return res.status(404).json({ error: 'decision not found' });
  }
  res.json(listActionsForDecision(req.params.id));
});

app.post('/api/decisions/:id/actions', (req, res) => {
  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'description is required' });
  }
  const action = createActionItem(req.params.id, req.body);
  if (!action) {
    return res.status(404).json({ error: 'decision not found' });
  }
  res.status(201).json(action);
});

// All Actions
app.get('/api/actions', (req, res) => {
  const { status, owner } = req.query;
  res.json(listAllActions({ status, owner }));
});

app.put('/api/actions/:id', (req, res) => {
  const action = updateActionItem(req.params.id, req.body);
  if (!action) {
    return res.status(404).json({ error: 'action not found' });
  }
  res.json(action);
});

app.delete('/api/actions/:id', (req, res) => {
  const deleted = deleteActionItem(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'action not found' });
  }
  res.status(204).end();
});

// Anomalies
app.get('/api/anomalies', (req, res) => {
  const { status, severity, metricId } = req.query;
  res.json(listAnomalies({ status, severity, metricId }));
});

app.post('/api/anomalies', (req, res) => {
  const { metricId, description } = req.body;
  if (!metricId || !description) {
    return res.status(400).json({ error: 'metricId and description are required' });
  }
  const anomaly = createAnomaly(req.body);
  res.status(201).json(anomaly);
});

app.get('/api/anomalies/:id', (req, res) => {
  const anomaly = getAnomalyById(req.params.id);
  if (!anomaly) {
    return res.status(404).json({ error: 'anomaly not found' });
  }
  res.json(anomaly);
});

app.put('/api/anomalies/:id', (req, res) => {
  const anomaly = updateAnomaly(req.params.id, req.body);
  if (!anomaly) {
    return res.status(404).json({ error: 'anomaly not found' });
  }
  res.json(anomaly);
});

app.post('/api/anomalies/:id/trace', (req, res) => {
  const result = traceAnomaly(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'anomaly not found' });
  }
  res.json(result);
});

// Scenarios
app.get('/api/scenarios', (_req, res) => {
  res.json(listScenarios());
});

app.post('/api/scenarios', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const scenario = createScenario(req.body);
  res.status(201).json(scenario);
});

app.get('/api/scenarios/:id', (req, res) => {
  const scenario = getScenarioById(req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'scenario not found' });
  }
  res.json(scenario);
});

app.put('/api/scenarios/:id', (req, res) => {
  const scenario = updateScenario(req.params.id, req.body);
  if (!scenario) {
    return res.status(404).json({ error: 'scenario not found' });
  }
  res.json(scenario);
});

app.delete('/api/scenarios/:id', (req, res) => {
  const deleted = deleteScenario(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'scenario not found' });
  }
  res.status(204).end();
});

app.post('/api/scenarios/:id/simulate', (req, res) => {
  const scenario = runSimulation(req.params.id);
  if (!scenario) {
    return res.status(404).json({ error: 'scenario not found' });
  }
  res.json(scenario);
});

// Error handler (keep last)
app.use((err, _req, res, _next) => {
  console.error('Unexpected error', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
