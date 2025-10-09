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
  searchMetrics
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

app.use((err, _req, res, _next) => {
  console.error('Unexpected error', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
