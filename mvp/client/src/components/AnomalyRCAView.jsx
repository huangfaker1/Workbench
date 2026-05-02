import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { formatDate } from '../utils/format';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function AnomalyRCAView({ onSelectDecision, onMetricNavigate }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [traceResult, setTraceResult] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const data = await api.listAnomalies({ severity: severityFilter || undefined });
        if (!cancelled) setAnomalies(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [severityFilter]);

  const handleSelect = async (anomalyId) => {
    try {
      const [detail, traced] = await Promise.all([
        api.getAnomaly(anomalyId),
        api.traceAnomaly(anomalyId)
      ]);
      setSelectedAnomaly(detail);
      setTraceResult(traced);
    } catch (err) {
      console.error(err);
    }
  };

  const sortedAnomalies = [...anomalies].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99;
    const sb = SEVERITY_ORDER[b.severity] ?? 99;
    return sa - sb;
  });

  return (
    <div className="anomaly-rca-view">
      <div className="anomaly-list-panel">
        <div className="anomaly-list-header">
          <h3>异常列表</h3>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="filter-select">
            <option value="">全部严重程度</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="anomaly-list-body">
          {loading ? <p className="muted">加载中...</p> : sortedAnomalies.length === 0 ? (
            <p className="muted">暂无异常</p>
          ) : (
            <ul className="anomaly-list">
              {sortedAnomalies.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`anomaly-list-item ${selectedAnomaly?.id === a.id ? 'active' : ''}`}
                    onClick={() => handleSelect(a.id)}
                  >
                    <span className={`severity-badge severity-${a.severity}`}>{a.severity}</span>
                    <div className="anomaly-item-info">
                      <span className="anomaly-item-name">{a.metricName}</span>
                      <span className="anomaly-item-desc">{a.description}</span>
                      <span className="anomaly-item-meta">
                        {formatDate(a.detectedAt)} · {a.status}
                        {a.deviation != null ? ` · ${a.deviation > 0 ? '+' : ''}${a.deviation}%` : ''}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="anomaly-detail-panel">
        {selectedAnomaly ? (
          <div className="anomaly-detail-card">
            <div className="anomaly-detail-header">
              <h3>{selectedAnomaly.metricName}</h3>
              <span className={`severity-badge severity-${selectedAnomaly.severity}`}>{selectedAnomaly.severity}</span>
            </div>
            <p className="anomaly-detail-desc">{selectedAnomaly.description}</p>
            <div className="anomaly-detail-meta">
              <span>状态: {selectedAnomaly.status}</span>
              <span>检测时间: {formatDate(selectedAnomaly.detectedAt)}</span>
              {selectedAnomaly.deviation != null && <span>偏差: {selectedAnomaly.deviation > 0 ? '+' : ''}{selectedAnomaly.deviation}%</span>}
              {selectedAnomaly.resolver && <span>解决人: {selectedAnomaly.resolver}</span>}
            </div>

            <div className="anomaly-trace-section">
              <h4>根因链 (上游依赖)</h4>
              {traceResult?.rootCauseMetricIds && traceResult.rootCauseMetricIds.length > 0 ? (
                <ul className="trace-chain">
                  {traceResult.rootCauseMetricIds.map((id, i) => (
                    <li key={id}>
                      <span className="trace-step">{i + 1}</span>
                      <button type="button" className="link-button" onClick={() => onMetricNavigate?.(id)}>
                        {id}
                      </button>
                      <span className="trace-arrow">→</span>
                    </li>
                  ))}
                  <li><span className="trace-root-badge">根因</span></li>
                </ul>
              ) : (
                <p className="muted">未追踪到上游依赖</p>
              )}
            </div>

            <div className="anomaly-trace-section">
              <h4>影响范围 (下游指标)</h4>
              {traceResult?.impactMetricIds && traceResult.impactMetricIds.length > 0 ? (
                <ul className="trace-chain">
                  {traceResult.impactMetricIds.map((id) => (
                    <li key={id}>
                      <button type="button" className="link-button" onClick={() => onMetricNavigate?.(id)}>
                        {id}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">无下游影响</p>
              )}
            </div>

            <div className="anomaly-actions">
              <button type="button" className="primary" onClick={() => onSelectDecision?.('new', { linkedAnomalyIds: [selectedAnomaly.id], context: `异常: ${selectedAnomaly.metricName} - ${selectedAnomaly.description}` })}>
                创建决策
              </button>
            </div>
          </div>
        ) : (
          <div className="anomaly-detail-empty">
            <p className="muted">选择一条异常记录以查看详情</p>
          </div>
        )}
      </div>
    </div>
  );
}

AnomalyRCAView.propTypes = {
  onSelectDecision: PropTypes.func,
  onMetricNavigate: PropTypes.func
};

export default AnomalyRCAView;
