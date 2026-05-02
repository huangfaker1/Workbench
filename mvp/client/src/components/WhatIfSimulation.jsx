import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { formatDate } from '../utils/format';

function WhatIfSimulation({ onMetricNavigate }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [scenarioResult, setScenarioResult] = useState(null);

  // Form state for new/edit scenario
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAdjustments, setFormAdjustments] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [creating, setCreating] = useState(false);

  const loadScenarios = useCallback(async () => {
    try {
      const data = await api.listScenarios();
      setScenarios(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadScenarios(); }, [loadScenarios]);

  const handleSearch = useCallback(async (text) => {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await api.searchMetrics(text);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const addAdjustment = (metric) => {
    if (formAdjustments.some((a) => a.metricId === metric.id)) return;
    setFormAdjustments([...formAdjustments, { metricId: metric.id, metricName: metric.name, originalValue: null, adjustedValue: null }]);
    setSearchText('');
    setSearchResults([]);
  };

  const removeAdjustment = (metricId) => {
    setFormAdjustments(formAdjustments.filter((a) => a.metricId !== metricId));
  };

  const updateAdjustmentValue = (metricId, value) => {
    setFormAdjustments(formAdjustments.map((a) => a.metricId === metricId ? { ...a, adjustedValue: value ? parseFloat(value) : null } : a));
  };

  const handleCreateScenario = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const scenario = await api.createScenario({
        name: formName,
        description: formDesc,
        adjustments: formAdjustments,
        createdBy: '当前用户'
      });
      await loadScenarios();
      setSelectedScenario(scenario);
      await handleRunSimulation(scenario.id);
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRunSimulation = async (scenarioId) => {
    try {
      const result = await api.runSimulation(scenarioId);
      setScenarioResult(result);
      await loadScenarios();
      setSelectedScenario(result);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectScenario = async (scenarioId) => {
    try {
      const scenario = await api.getScenario(scenarioId);
      setSelectedScenario(scenario);
      setScenarioResult(scenario);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormAdjustments([]);
  };

  const handleDeleteScenario = async (id) => {
    await api.deleteScenario(id);
    await loadScenarios();
    if (selectedScenario?.id === id) {
      setSelectedScenario(null);
      setScenarioResult(null);
    }
  };

  return (
    <div className="simulation-view">
      <div className="simulation-sidebar">
        <div className="simulation-sidebar-header">
          <h3>模拟场景</h3>
          <button type="button" className="primary" onClick={() => { resetForm(); setShowForm(true); }}>新建场景</button>
        </div>
        <div className="simulation-sidebar-body">
          {loading ? <p className="muted">加载中...</p> : scenarios.length === 0 ? (
            <p className="muted">暂无场景</p>
          ) : (
            <ul className="scenario-list">
              {scenarios.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`scenario-list-item ${selectedScenario?.id === s.id ? 'active' : ''}`}
                    onClick={() => handleSelectScenario(s.id)}
                  >
                    <span className="scenario-name">{s.name}</span>
                    <span className="scenario-meta">{s.status} · {formatDate(s.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="simulation-main">
        {showForm ? (
          <div className="simulation-form-card">
            <h3>新建模拟场景</h3>
            <div className="simulation-form">
              <label>
                场景名称
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="输入场景名称" />
              </label>
              <label>
                描述
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="场景描述" rows={2} />
              </label>
              <div className="simulation-adjustments">
                <h4>指标调整</h4>
                <div className="simulation-metric-search">
                  <input value={searchText} onChange={(e) => handleSearch(e.target.value)} placeholder="搜索指标..." />
                  {searchResults.length > 0 && (
                    <ul className="simulation-search-results">
                      {searchResults.map((m) => (
                        <li key={m.id}><button type="button" onClick={() => addAdjustment(m)}>{m.name}</button></li>
                      ))}
                    </ul>
                  )}
                </div>
                {formAdjustments.map((adj) => (
                  <div key={adj.metricId} className="simulation-adjustment-row">
                    <span className="adj-metric-name">
                      <button type="button" className="link-button" onClick={() => onMetricNavigate?.(adj.metricId)}>
                        {adj.metricName}
                      </button>
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="调整值"
                      value={adj.adjustedValue ?? ''}
                      onChange={(e) => updateAdjustmentValue(adj.metricId, e.target.value)}
                    />
                    <button type="button" className="danger" onClick={() => removeAdjustment(adj.metricId)}>移除</button>
                  </div>
                ))}
                {formAdjustments.length === 0 && <p className="muted">请搜索并添加需要调整的指标</p>}
              </div>
              <div className="form-actions">
                <button type="button" className="primary" onClick={handleCreateScenario} disabled={!formName.trim() || formAdjustments.length === 0 || creating}>
                  {creating ? '创建中...' : '创建并模拟'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}>取消</button>
              </div>
            </div>
          </div>
        ) : scenarioResult ? (
          <div className="simulation-result-card">
            <div className="simulation-result-header">
              <div>
                <h3>{scenarioResult.name}</h3>
                <p className="muted">{scenarioResult.description}</p>
              </div>
              <div className="simulation-result-actions">
                <button type="button" className="primary" onClick={() => handleRunSimulation(scenarioResult.id)}>重新模拟</button>
                <button type="button" className="danger" onClick={() => handleDeleteScenario(scenarioResult.id)}>删除</button>
              </div>
            </div>
            <p className="simulation-meta">
              状态: {scenarioResult.status} · 创建: {formatDate(scenarioResult.createdAt)}
              {scenarioResult.executedAt ? ` · 执行: ${formatDate(scenarioResult.executedAt)}` : ''}
            </p>

            <div className="simulation-results">
              <h4>模拟结果</h4>
              {scenarioResult.results && scenarioResult.results.length > 0 ? (
                <table className="simulation-results-table">
                  <thead>
                    <tr>
                      <th>指标</th>
                      <th>基准值</th>
                      <th>模拟值</th>
                      <th>变化量</th>
                      <th>变化率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioResult.results.map((r) => (
                      <tr key={r.metricId} className={r.changePercent > 0 ? 'row-positive' : r.changePercent < 0 ? 'row-negative' : ''}>
                        <td>
                          <button type="button" className="link-button" onClick={() => onMetricNavigate?.(r.metricId)}>
                            {r.metricName}
                          </button>
                        </td>
                        <td>{r.baseValue != null ? r.baseValue : '-'}</td>
                        <td>{r.simulatedValue != null ? r.simulatedValue : '-'}</td>
                        <td>{r.change != null ? (r.change > 0 ? '+' : '') + r.change.toFixed(4) : '-'}</td>
                        <td className={r.changePercent > 0 ? 'positive' : r.changePercent < 0 ? 'negative' : ''}>
                          {r.changePercent != null ? (r.changePercent > 0 ? '+' : '') + r.changePercent.toFixed(2) + '%' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">暂无结果，请运行模拟</p>
              )}
            </div>

            <div className="simulation-adjustments-summary">
              <h4>调整参数</h4>
              <ul>
                {scenarioResult.adjustments?.map((adj) => (
                  <li key={adj.metricId}>
                    <span>{adj.metricName}: </span>
                    <span className="adj-highlight">{adj.adjustedValue ?? '未设置'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="simulation-empty">
            <p className="muted">选择一个场景或新建场景开始模拟</p>
          </div>
        )}
      </div>
    </div>
  );
}

WhatIfSimulation.propTypes = {
  onMetricNavigate: PropTypes.func
};

export default WhatIfSimulation;
