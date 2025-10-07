import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../utils/format';
import MetricForm from '../components/MetricForm';
import MetricDependencyGraph from '../components/MetricDependencyGraph';

const METRIC_TOKEN_PATTERN = /\[\[([^\]]+)\]\]/g;

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deriveDependencyAlias(formulaText, metricName) {
  if (!formulaText || !metricName) return null;
  const normalizedFormula = formulaText.replace(METRIC_TOKEN_PATTERN, (_, name) => `[[${name.trim()}]]`);
  const tokenPattern = new RegExp(`1\\s*-\\s*\[\[\s*${escapeForRegex(metricName)}\s*\]\]`);
  if (tokenPattern.test(normalizedFormula)) {
    return `1 − ${metricName}`;
  }
  const plainPattern = new RegExp(`1\\s*-\\s*${escapeForRegex(metricName)}`);
  if (plainPattern.test(normalizedFormula)) {
    return `1 − ${metricName}`;
  }
  return null;
}

function findOperatorBeforeAlias(formula, aliasStartIndex) {
  if (!formula || aliasStartIndex < 0) return null;
  let i = aliasStartIndex - 1;
  let depth = 0;
  while (i >= 0) {
    const char = formula[i];
    if (char === ')') {
      depth += 1;
      i -= 1;
      continue;
    }
    if (char === '(') {
      if (depth > 0) {
        depth -= 1;
        i -= 1;
        continue;
      }
      i -= 1;
      continue;
    }
    if (depth === 0 && '*/+-'.includes(char)) {
      return char;
    }
    i -= 1;
  }
  return null;
}

function MetricSummaryCard({ metric, isActive, onSelect }) {
  return (
    <li>
      <button type="button" className={isActive ? 'active' : ''} onClick={() => onSelect(metric.id)}>
        <h3>{metric.name}</h3>
        <div className="metric-meta">
          <span>Owner：{metric.owner || '未指定'}</span>
          <span>刷新：{metric.refreshFrequency || '未知'}</span>
        </div>
        <div className="metric-tags">
          {metric.domainTags?.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          <span className={`status ${metric.status}`}>{metric.status}</span>
        </div>
      </button>
    </li>
  );
}

MetricSummaryCard.propTypes = {
  metric: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    owner: PropTypes.string,
    refreshFrequency: PropTypes.string,
    domainTags: PropTypes.arrayOf(PropTypes.string),
    status: PropTypes.string
  }).isRequired,
  isActive: PropTypes.bool,
  onSelect: PropTypes.func.isRequired
};

MetricSummaryCard.defaultProps = {
  isActive: false
};

function DependencyList({ dependencies, metricsIndex, onNavigate }) {
  if (!dependencies || dependencies.length === 0) {
    return <p className="muted">暂无依赖</p>;
  }

  return (
    <ul className="dependency-list">
      {dependencies.map((dependencyId) => {
        const meta = metricsIndex.get(dependencyId);
        return (
          <li key={dependencyId}>
            {meta ? (
              <button type="button" className="link-button" onClick={() => onNavigate(meta.id)}>
                {meta.name}
              </button>
            ) : (
              <span>{dependencyId}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

DependencyList.propTypes = {
  dependencies: PropTypes.arrayOf(PropTypes.string),
  metricsIndex: PropTypes.instanceOf(Map).isRequired,
  onNavigate: PropTypes.func
};

DependencyList.defaultProps = {
  dependencies: [],
  onNavigate: undefined
};

function LinkedNoteList({ notes }) {
  if (!notes || notes.length === 0) {
    return <p className="muted">暂无引用笔记</p>;
  }
  return (
    <ul className="linked-notes">
      {notes.map((note) => (
        <li key={note.id}>
          <h4>{note.title}</h4>
          <p>{note.summary}</p>
          <span className="muted">更新于 {formatDate(note.updatedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

LinkedNoteList.propTypes = {
  notes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      summary: PropTypes.string,
      updatedAt: PropTypes.string
    })
  )
};

LinkedNoteList.defaultProps = {
  notes: []
};

function MetricsWorkspace({ initialMetricId, onMetricNavigate }) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const { data: metricsData, loading, error, execute: reloadMetrics, setData } = useAsync(
    () => api.listMetrics(searchKeyword),
    [searchKeyword]
  );

  const [selectedMetricId, setSelectedMetricId] = useState(null);
  const [metricDetail, setMetricDetail] = useState(null);
  const [mode, setMode] = useState('view'); // view | create | edit | newVersion
  const detailCacheRef = useRef(new Map());
  const [graphData, setGraphData] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphPaneWidth, setGraphPaneWidth] = useState(640);
  const contentRef = useRef(null);
  const isResizingRef = useRef(false);
  const showGraphPane = mode === 'view' && !!metricDetail;

  const metrics = metricsData || [];

  const metricsIndex = useMemo(() => {
    const map = new Map();
    metrics.forEach((metric) => {
      map.set(metric.id, metric);
      map.set(metric.name, metric);
    });
    return map;
  }, [metrics]);

  useEffect(() => {
    if (initialMetricId) {
      setSelectedMetricId(initialMetricId);
      setMode('view');
    }
  }, [initialMetricId]);

useEffect(() => {
  if (!metrics.length) {
    if (mode === 'view') {
      setSelectedMetricId(null);
    }
    return;
  }
  const exists = selectedMetricId && metrics.some((metric) => metric.id === selectedMetricId);
  if (!exists) {
    setSelectedMetricId(metrics[0].id);
  }
}, [metrics, selectedMetricId, mode]);

  useEffect(() => {
    if (!selectedMetricId) {
      setMetricDetail(null);
      return;
    }
    let cancelled = false;
    async function fetchDetail() {
      try {
        const detail = await api.getMetric(selectedMetricId);
        if (!cancelled) {
          setMetricDetail(detail);
          detailCacheRef.current.set(detail.id, detail);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedMetricId]);

  const handleCreateMetric = async (payload) => {
    try {
      const created = await api.createMetric(payload);
      const list = await reloadMetrics();
      if (list) {
        setData(list);
        detailCacheRef.current = new Map();
      }
      setSelectedMetricId(created.id);
      setMode('view');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateMetric = async (payload) => {
    if (!metricDetail) return;
    try {
      const updated = await api.updateMetric(metricDetail.id, payload);
      const list = await reloadMetrics();
      if (list) {
        setData(list);
        detailCacheRef.current = new Map([[updated.id, updated]]);
      } else {
        detailCacheRef.current.set(updated.id, updated);
      }
      setMetricDetail(updated);
      setMode('view');
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePublishVersion = async (payload) => {
    if (!metricDetail) return;
    try {
      const updated = await api.publishMetricVersion(metricDetail.id, payload);
      setMetricDetail(updated);
      const list = await reloadMetrics();
      if (list) {
        setData(list);
        detailCacheRef.current = new Map([[updated.id, updated]]);
      } else {
        detailCacheRef.current.set(updated.id, updated);
      }
      setMode('view');
    } catch (err) {
      alert(err.message);
    }
  };

  const currentVersion = useMemo(() => {
    if (!metricDetail) return null;
    return metricDetail.versions?.find((version) => version.id === metricDetail.currentVersionId) || null;
  }, [metricDetail]);

  const newVersionInitial = useMemo(() => {
    if (!metricDetail) {
      return {
        name: '',
        owner: '',
        status: 'draft',
        refreshFrequency: '',
        domainTags: [],
        version: '',
        definition: '',
        formula: '',
        source: '',
        constraints: [],
        lineageNotes: ''
      };
    }
    return {
      name: metricDetail.name,
      owner: metricDetail.owner,
      status: metricDetail.status,
      refreshFrequency: metricDetail.refreshFrequency,
      domainTags: metricDetail.domainTags || [],
      version: '',
      definition: currentVersion?.definition || '',
      formula: currentVersion?.formula || '',
      source: currentVersion?.source || '',
      constraints: currentVersion?.constraints || [],
      lineageNotes: currentVersion?.lineageNotes || '',
      createdBy: currentVersion?.createdBy || metricDetail.owner || ''
    };
  }, [metricDetail, currentVersion]);

  const handoffNavigate = (metricId) => {
    if (!metricId) return;
    if (onMetricNavigate) {
      onMetricNavigate(metricId);
    }
    setMode('view');
    setSelectedMetricId(metricId);
  };

  const handlePointerMove = useCallback((event) => {
    if (!isResizingRef.current || !contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const minGraphWidth = 420;
    const minMainWidth = 520;
    const maxGraphWidth = Math.max(minGraphWidth, rect.width - minMainWidth);
    const rawWidth = rect.right - event.clientX;
    const clampedWidth = Math.min(Math.max(rawWidth, minGraphWidth), maxGraphWidth);
    setGraphPaneWidth(clampedWidth);
  }, []);

  const stopResizing = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', stopResizing);
  }, [handlePointerMove]);

  const startResizing = useCallback((event) => {
    if (!showGraphPane) return;
    isResizingRef.current = true;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', stopResizing);
    event.preventDefault();
  }, [handlePointerMove, stopResizing, showGraphPane]);

  useEffect(() => () => stopResizing(), [stopResizing]);

  useEffect(() => {
    if (!showGraphPane) {
      stopResizing();
    }
  }, [showGraphPane, stopResizing]);

  useEffect(() => {
    if (!showGraphPane) return;
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const minGraphWidth = 420;
    const minMainWidth = 520;
    const maxGraphWidth = Math.max(minGraphWidth, rect.width - minMainWidth);
    setGraphPaneWidth((prev) => {
      const clamped = Math.min(Math.max(prev, minGraphWidth), maxGraphWidth);
      return Number.isFinite(clamped) ? clamped : prev;
    });
  }, [showGraphPane, metrics.length]);

  const resolveSummary = useCallback(
    (key) => {
      if (!key) return null;
      const trimmed = key.trim();
      return metricsIndex.get(trimmed) || null;
    },
    [metricsIndex]
  );

  const normalizeFormula = useCallback((formula) => (formula || '').replace(/\s+/g, ''), []);

  const mapOperatorSymbol = useCallback((symbol) => {
    switch (symbol) {
      case '*':
        return '×';
      case '/':
        return '÷';
      case '-':
        return '−';
      case '+':
        return '+';
      case '=':
        return '＝';
      default:
        return symbol || '×';
    }
  }, []);

  const loadMetricDetail = useCallback(
    async (key) => {
      if (!key) return null;
      const summary = resolveSummary(key);
      const targetId = summary?.id || key.trim();
      if (!targetId) return null;
      const cache = detailCacheRef.current;
      if (cache.has(targetId)) {
        return cache.get(targetId);
      }
      try {
        const detail = await api.getMetric(targetId);
        cache.set(targetId, detail);
        return detail;
      } catch (err) {
        console.warn('依赖指标未找到：', targetId, err.message);
        if (summary) {
          const placeholder = {
            ...summary,
            id: summary.id,
            name: summary.name,
            status: summary.status || 'unknown',
            refreshFrequency: summary.refreshFrequency,
            currentVersionId: null,
            versions: [],
            changeLogs: [],
            linkedNotes: []
          };
          cache.set(targetId, placeholder);
          return placeholder;
        }
        return null;
      }
    },
    [resolveSummary]
  );

  const buildNode = useCallback(
    async (detail, path = new Set()) => {
      if (!detail) return null;
      const version =
        detail.versions?.find((versionItem) => versionItem.id === detail.currentVersionId) ||
        (detail.versions && detail.versions.length > 0 ? detail.versions[detail.versions.length - 1] : null);

      const dependenciesRaw = Array.isArray(version?.dependencies) ? version.dependencies : [];
      const originalFormula = version?.formula || '';
      const uniqueDeps = [];
      dependenciesRaw.forEach((dep) => {
        if (!dep) return;
        const trimmed = typeof dep === 'string' ? dep.trim() : dep;
        if (trimmed && !uniqueDeps.includes(trimmed)) {
          uniqueDeps.push(trimmed);
        }
      });

      const currentPath = new Set(path);
      currentPath.add(detail.id);

      const sanitizedFormula = normalizeFormula(version?.formula || '');
      const dependencyInfos = uniqueDeps
        .map((depKey, index) => {
          const summary = resolveSummary(depKey);
          const displayName = summary?.name || depKey;
          const sanitizedDisplayName = (displayName || '').replace(/\s+/g, '');
          const alias = deriveDependencyAlias(originalFormula, displayName);
          let aliasSegmentIndex = -1;
          if (alias && sanitizedFormula) {
            const aliasCandidates = [
              `1-[[${sanitizedDisplayName}]]`,
              `1-${sanitizedDisplayName}`
            ];
            for (const candidate of aliasCandidates) {
              const idx = sanitizedFormula.indexOf(candidate);
              if (idx !== -1) {
                aliasSegmentIndex = idx;
                break;
              }
            }
          }
          let formulaIndex = -1;
          if (sanitizedFormula) {
            const searchCandidates = [
              `[[${sanitizedDisplayName}]]`,
              sanitizedDisplayName,
              displayName
            ];
            searchCandidates.forEach((candidate) => {
              if (!candidate) return;
              const idx = sanitizedFormula.indexOf(candidate);
              if (idx !== -1 && (formulaIndex === -1 || idx < formulaIndex)) {
                formulaIndex = idx;
              }
            });
          }
          return {
            depKey,
            summary,
            displayName,
            displayAlias: alias,
            aliasSegmentIndex,
            formulaIndex,
            originalIndex: index
          };
        })
        .sort((a, b) => {
          const idxA = a.formulaIndex === -1 ? Number.MAX_SAFE_INTEGER : a.formulaIndex;
          const idxB = b.formulaIndex === -1 ? Number.MAX_SAFE_INTEGER : b.formulaIndex;
          if (idxA === idxB) {
            return a.originalIndex - b.originalIndex;
          }
          return idxA - idxB;
        });

      const operationBeforeMap = new Map();
      dependencyInfos.forEach((info, index) => {
        if (index === 0) {
          operationBeforeMap.set(info.depKey, '=');
          return;
        }
        if (!sanitizedFormula || info.formulaIndex < 0) {
          operationBeforeMap.set(info.depKey, '×');
          return;
        }
        let pointer = info.formulaIndex - 1;
        let symbol = '';
        while (pointer >= 0) {
          const ch = sanitizedFormula[pointer];
          if (ch === ')') {
            pointer--;
            continue;
          }
          if (ch === '(') {
            pointer--;
            continue;
          }
          if ('*/+-'.includes(ch)) {
            symbol = ch;
            break;
          }
          pointer--;
        }
        if (info.displayAlias) {
          const aliasOperator = findOperatorBeforeAlias(sanitizedFormula, info.aliasSegmentIndex);
          if (aliasOperator) {
            symbol = aliasOperator;
          }
        }
        operationBeforeMap.set(info.depKey, symbol || '×');
      });

      const children = [];
      for (const info of dependencyInfos) {
        const { depKey, summary } = info;
        const targetId = summary?.id || depKey;
        if (currentPath.has(targetId)) {
          children.push({
            id: targetId,
            name: summary?.name || depKey,
            displayNameOverride: info.displayAlias || null,
            status: 'loop',
            version: '循环引用',
            formula: '',
            note: '检测到循环依赖',
            children: [],
            operationBefore: mapOperatorSymbol(operationBeforeMap.get(depKey))
          });
          continue;
        }

        const childDetail = await loadMetricDetail(targetId);
        if (!childDetail) {
          children.push({
            id: targetId,
            name: summary?.name || depKey,
            displayNameOverride: info.displayAlias || null,
            status: 'missing',
            version: '未知',
            formula: '',
            note: '未在指标字典中找到该依赖',
            children: [],
            operationBefore: mapOperatorSymbol(operationBeforeMap.get(depKey))
          });
          continue;
        }

        const childNode = await buildNode(childDetail, currentPath);
        if (childNode) {
          childNode.operationBefore = mapOperatorSymbol(operationBeforeMap.get(depKey));
          if (info.displayAlias) {
            childNode.displayNameOverride = info.displayAlias;
          }
          children.push(childNode);
        }
      }

      return {
        id: detail.id,
        name: detail.name,
        status: detail.status || 'unknown',
        version: version?.version || '未发布',
        formula: version?.formula || '',
        note: version?.lineageNotes || '',
        children
      };
    },
    [loadMetricDetail, resolveSummary, mapOperatorSymbol, normalizeFormula]
  );

  useEffect(() => {
    if (!metricDetail) {
      setGraphData(null);
      return;
    }
    let cancelled = false;
    detailCacheRef.current.set(metricDetail.id, metricDetail);
    setGraphLoading(true);
    buildNode(metricDetail)
      .then((graph) => {
        if (!cancelled) {
          setGraphData(graph);
        }
      })
      .catch((err) => {
        console.error('构建血缘图失败', err);
        if (!cancelled) {
          setGraphData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGraphLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [metricDetail, buildNode]);

  return (
    <div className="workspace metrics-workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>指标库</h2>
          <button type="button" className="primary" onClick={() => setMode('create')}>
            新建指标
          </button>
        </div>
        <div className="search-box">
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="按名称或领域搜索"
          />
        </div>
        {loading ? <p>加载中...</p> : null}
        {error ? <p className="error">{error.message}</p> : null}
        <ul className="metric-list">
          {metrics.map((metric) => (
            <MetricSummaryCard
              key={metric.id}
              metric={metric}
              isActive={metric.id === selectedMetricId}
              onSelect={(id) => {
                setMode('view');
                setSelectedMetricId(id);
              }}
            />
          ))}
        </ul>
      </aside>

      <section
        ref={contentRef}
        className="content"
        style={{ gridTemplateColumns: showGraphPane ? `minmax(0, 1fr) 8px ${graphPaneWidth}px` : '1fr' }}
      >
        <div className="content-main">
          {mode === 'create' ? (
          <div className="card">
            <header className="card-header">
              <h2>新建指标</h2>
            </header>
            <MetricForm
              includeVersion
              initialValue={{
                status: 'draft',
                refreshFrequency: 'monthly',
                domainTags: [],
                categoryPath: activeCategoryPath,
                segments: [],
                aliases: [],
                applicability: '',
                lifecycleStage: '',
                perspective: '',
                dataOwner: '',
                templateId: ''
              }}
              availableMetrics={metrics}
              currentMetricId={null}
              onSubmit={handleCreateMetric}
              onCancel={() => setMode('view')}
              submitLabel="创建并发布"
            />
          </div>
          ) : null}

          {mode === 'edit' && metricDetail ? (
            <div className="card">
              <header className="card-header">
                <h2>编辑指标</h2>
              </header>
            <MetricForm
              initialValue={metricDetail}
              availableMetrics={metrics}
              currentMetricId={metricDetail?.id}
              onSubmit={handleUpdateMetric}
              onCancel={() => setMode('view')}
              submitLabel="保存"
              disableName
            />
            </div>
          ) : null}

          {mode === 'newVersion' && metricDetail ? (
            <div className="card">
              <header className="card-header">
                <h2>发布新版本</h2>
              </header>
            <MetricForm
              includeVersion
              initialValue={newVersionInitial}
              availableMetrics={metrics}
              currentMetricId={metricDetail.id}
              onSubmit={handlePublishVersion}
              onCancel={() => setMode('view')}
              submitLabel="发布"
              disableName
            />
            </div>
          ) : null}

          {mode === 'view' && metricDetail ? (
            <div className="card metric-detail-card">
              <header className="card-header">
                <div>
                  <h2>{metricDetail.name}</h2>
                  <p className="muted">
                    Owner：{metricDetail.owner || '未指定'} · 状态：{metricDetail.status} · 刷新频率：{metricDetail.refreshFrequency}
                  </p>
                  <div className="metric-tags">
                    {metricDetail.domainTags?.map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={() => setMode('edit')}>
                    编辑
                  </button>
                  <button type="button" onClick={() => setMode('newVersion')}>
                    发布新版本
                  </button>
                </div>
              </header>

              <section>
                <h3>当前版本</h3>
                {currentVersion ? (
                  <div className="version-block">
                    <p>版本号：{currentVersion.version}</p>
                    <p>来源：{currentVersion.source}</p>
                    <p>定义：{currentVersion.definition}</p>
                    <p>公式：{currentVersion.formula}</p>
                    <p>血缘说明：{currentVersion.lineageNotes || '—'}</p>
                    <p>发布时间：{formatDate(currentVersion.createdAt)} · 发布人：{currentVersion.createdBy}</p>
                    <h4>约束</h4>
                    <ul>
                      {currentVersion.constraints?.length
                        ? currentVersion.constraints.map((constraint, index) => (
                            <li key={`${constraint}-${index}`}>{constraint}</li>
                          ))
                        : <li>无</li>}
                    </ul>
                    <h4>依赖</h4>
                    <DependencyList
                      dependencies={currentVersion.dependencies}
                      metricsIndex={metricsIndex}
                      onNavigate={(id) => handoffNavigate(id)}
                    />
                  </div>
                ) : (
                  <p className="muted">尚未发布版本</p>
                )}
              </section>

              <section>
                <h3>版本历史</h3>
                <ul className="history-list">
                  {metricDetail.versions?.map((version) => (
                    <li key={version.id}>
                      <span>版本 {version.version}</span>
                      <span>发布人：{version.createdBy}</span>
                      <span>发布时间：{formatDate(version.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>变更登记</h3>
                <ul className="history-list">
                  {metricDetail.changeLogs?.map((log) => (
                    <li key={log.id}>
                      <span>
                        {log.versionFrom ? `${log.versionFrom} → ${log.versionTo}` : `创建为 ${log.versionTo}`}
                      </span>
                      <span>{log.description}</span>
                      <span>记录人：{log.createdBy}</span>
                      <span>时间：{formatDate(log.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>被引用的笔记</h3>
                <LinkedNoteList notes={metricDetail.linkedNotes} />
              </section>
            </div>
          ) : null}

          {mode === 'view' && !metricDetail ? <p className="muted">请选择一个指标</p> : null}
        </div>

        {showGraphPane ? (
          <>
            <div
              className="graph-resizer"
              onPointerDown={startResizing}
              role="separator"
              aria-orientation="vertical"
              aria-label="调整血缘图宽度"
            />
          <aside className="graph-pane" style={{ width: graphPaneWidth }}>
            <div className="card metric-graph-card">
              <div className="metric-graph-header">
                <h3>血缘结构图</h3>
                <p className="muted">自动解析公式并呈现依赖链路</p>
              </div>
              <MetricDependencyGraph
                graph={graphData}
                loading={graphLoading}
                onSelect={(metricId) => {
                  if (metricId && metricId !== metricDetail.id) {
                    handoffNavigate(metricId);
                  }
                }}
              />
            </div>
          </aside>
          </>
        ) : null}
      </section>
    </div>
  );
}

MetricsWorkspace.propTypes = {
  initialMetricId: PropTypes.string,
  onMetricNavigate: PropTypes.func
};

MetricsWorkspace.defaultProps = {
  initialMetricId: null,
  onMetricNavigate: undefined
};

export default MetricsWorkspace;
