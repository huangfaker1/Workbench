import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const METRIC_TOKEN_PATTERN = /\[\[([^\]]+)\]\]/g;

function splitValues(value) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTokenMetricNames(expression) {
  const names = new Set();
  if (!expression) return names;
  let match;
  METRIC_TOKEN_PATTERN.lastIndex = 0;
  while ((match = METRIC_TOKEN_PATTERN.exec(expression)) !== null) {
    const name = match[1]?.trim();
    if (name) {
      names.add(name);
    }
  }
  return names;
}

function computeDependenciesFromFormula(formula, metrics, excludeMetricId) {
  if (!formula) return [];
  const expression = String(formula);
  if (!expression.trim()) return [];

  const matches = new Map();
  const metricsByName = new Map();
  metrics.forEach((metric) => {
    if (!metric?.name) return;
    metricsByName.set(metric.name, metric);
  });

  const explicitNames = extractTokenMetricNames(expression);

  explicitNames.forEach((name) => {
    const metric = metricsByName.get(name);
    if (metric && metric.id !== excludeMetricId) {
      matches.set(metric.id, metric);
    }
  });

  const fallbackExpression = explicitNames.size > 0 ? expression.replace(METRIC_TOKEN_PATTERN, ' ') : expression;

  const sortedMetrics = metrics
    .filter((metric) => metric && metric.id !== excludeMetricId)
    .sort((a, b) => {
      const nameA = a?.name || '';
      const nameB = b?.name || '';
      return nameB.length - nameA.length;
    });

  sortedMetrics.forEach((metric) => {
    if (!metric?.name) return;
    if (matches.has(metric.id)) return;
    const pattern = new RegExp(`\\[\\[\s*${escapeForRegex(metric.name)}\s*\\]\\]|${escapeForRegex(metric.name)}`, 'g');
    if (pattern.test(fallbackExpression)) {
      matches.set(metric.id, metric);
    }
  });

  return Array.from(matches.values());
}

function MetricForm({
  initialValue = {},
  onSubmit,
  onCancel,
  submitLabel,
  availableMetrics,
  includeVersion,
  disableName,
  currentMetricId
}) {
  const [name, setName] = useState(initialValue.name || '');
  const [owner, setOwner] = useState(initialValue.owner || '');
  const [status, setStatus] = useState(initialValue.status || 'draft');
  const [refreshFrequency, setRefreshFrequency] = useState(initialValue.refreshFrequency || 'monthly');
  const [domainTags, setDomainTags] = useState((initialValue.domainTags || []).join(', '));

  const [version, setVersion] = useState(initialValue.version || '');
  const [definition, setDefinition] = useState(initialValue.definition || '');
  const [formula, setFormula] = useState(initialValue.formula || '');
  const [source, setSource] = useState(initialValue.source || '');
  const [constraints, setConstraints] = useState((initialValue.constraints || []).join('\n'));
  const [lineageNotes, setLineageNotes] = useState(initialValue.lineageNotes || '');
  const [changeDescription, setChangeDescription] = useState(initialValue.changeDescription || '');
  const [createdBy, setCreatedBy] = useState(initialValue.createdBy || initialValue.owner || '');

  useEffect(() => {
    if (!includeVersion) return;
    if (createdBy) return;
    if (!owner) return;
    setCreatedBy(owner);
  }, [owner, createdBy, includeVersion]);

  const excludeMetricId = initialValue.id || currentMetricId || null;
  const detectedDependencies = useMemo(
    () => computeDependenciesFromFormula(formula, availableMetrics, excludeMetricId),
    [formula, availableMetrics, excludeMetricId]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      name,
      owner,
      status,
      refreshFrequency,
      domainTags: splitValues(domainTags)
    };

    if (includeVersion) {
      payload.version = version;
      payload.definition = definition;
      payload.formula = formula;
      payload.source = source;
      payload.constraints = splitValues(constraints);
      payload.dependencies = detectedDependencies.map((metric) => metric.id);
      payload.lineageNotes = lineageNotes;
      payload.changeDescription = changeDescription;
      payload.createdBy = createdBy;
      payload.owner = owner;
      payload.status = status;
    }

    if (!name) return;
    if (includeVersion && (!version || !definition || !formula || !source)) return;

    onSubmit(payload);
  };

  return (
    <form className="metric-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span>指标名称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={disableName}
          />
        </label>
        <label>
          <span>Owner</span>
          <input value={owner} onChange={(event) => setOwner(event.target.value)} />
        </label>
        <label>
          <span>状态</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="draft">草稿</option>
            <option value="active">生效</option>
            <option value="deprecated">废弃</option>
          </select>
        </label>
        <label>
          <span>刷新频率</span>
          <input value={refreshFrequency} onChange={(event) => setRefreshFrequency(event.target.value)} />
        </label>
        <label className="full-width">
          <span>领域标签</span>
          <input
            value={domainTags}
            onChange={(event) => setDomainTags(event.target.value)}
            placeholder="以逗号或换行分隔"
          />
        </label>
      </div>

      {includeVersion ? (
        <fieldset>
          <legend>版本信息</legend>
          <div className="form-grid">
            <label>
              <span>版本号</span>
              <input value={version} onChange={(event) => setVersion(event.target.value)} required />
            </label>
            <label>
              <span>发布人</span>
              <input value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} required />
            </label>
            <label className="full-width">
              <span>来源</span>
              <input value={source} onChange={(event) => setSource(event.target.value)} required />
            </label>
          </div>
          <label>
            <span>定义</span>
            <textarea value={definition} onChange={(event) => setDefinition(event.target.value)} rows={3} required />
          </label>
          <label>
            <span>公式</span>
            <textarea value={formula} onChange={(event) => setFormula(event.target.value)} rows={3} required />
            <p className="muted form-hint">使用 [[指标名称]] 来引用其他指标，系统会自动识别依赖</p>
          </label>
          <label>
            <span>约束（换行分隔）</span>
            <textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} rows={3} />
          </label>
          <div className="auto-deps-preview">
            <span>系统识别依赖</span>
            <div className="auto-deps-tags">
              {detectedDependencies.length ? (
                detectedDependencies.map((metric) => (
                  <span key={metric.id} className="tag pill">{metric.name}</span>
                ))
              ) : (
                <span className="muted">未识别到指标名称，请在公式中引用现有指标</span>
              )}
            </div>
          </div>
          <label>
            <span>血缘说明</span>
            <textarea value={lineageNotes} onChange={(event) => setLineageNotes(event.target.value)} rows={2} />
          </label>
          <label>
            <span>变更说明</span>
            <textarea value={changeDescription} onChange={(event) => setChangeDescription(event.target.value)} rows={2} />
          </label>
        </fieldset>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

MetricForm.propTypes = {
  initialValue: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  submitLabel: PropTypes.string,
  availableMetrics: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string, name: PropTypes.string })
  ),
  includeVersion: PropTypes.bool,
  disableName: PropTypes.bool,
  currentMetricId: PropTypes.string
};

MetricForm.defaultProps = {
  initialValue: {},
  submitLabel: '提交',
  availableMetrics: [],
  includeVersion: false,
  disableName: false,
  currentMetricId: null
};

export default MetricForm;
