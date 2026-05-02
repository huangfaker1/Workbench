import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../utils/format';
import DecisionDashboard from '../components/DecisionDashboard';
import AnomalyRCAView from '../components/AnomalyRCAView';
import WhatIfSimulation from '../components/WhatIfSimulation';
import ActionTracker from '../components/ActionTracker';

const SUBVIEWS = [
  { key: 'dashboard', label: '决策仪表盘' },
  { key: 'anomaly', label: '异常归因' },
  { key: 'simulation', label: '假设模拟' },
  { key: 'action', label: '行动跟踪' }
];

const STATUS_LABELS = {
  draft: '草稿', 'in-review': '评审中', approved: '已批准',
  implemented: '已实施', rejected: '已驳回'
};

function DecisionWorkspace({ onMetricNavigate }) {
  const [selectedSubview, setSelectedSubview] = useState('dashboard');
  const [selectedDecisionId, setSelectedDecisionId] = useState(null);
  const [decisionDetail, setDecisionDetail] = useState(null);
  const [mode, setMode] = useState('view'); // view | create | edit
  const [createContext, setCreateContext] = useState(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContext, setFormContext] = useState('');
  const [formDecision, setFormDecision] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formOwner, setFormOwner] = useState('');
  const [formExpectedImpact, setFormExpectedImpact] = useState('');

  // Data fetching
  const { data: dashboard, execute: reloadDashboard } = useAsync(() => api.getDashboard(), []);
  const { data: decisions, execute: reloadDecisions } = useAsync(() => api.listDecisions(), []);
  const { data: activeAnomalies } = useAsync(() => api.listAnomalies({ status: 'open,investigating' }), []);

  // Fetch decision detail when selected
  useEffect(() => {
    if (!selectedDecisionId) {
      setDecisionDetail(null);
      return;
    }
    let cancelled = false;
    async function fetch() {
      try {
        const detail = await api.getDecision(selectedDecisionId);
        if (!cancelled) setDecisionDetail(detail);
      } catch (err) {
        console.error(err);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [selectedDecisionId]);

  const handleSelectDecision = (decisionId) => {
    setSelectedDecisionId(decisionId);
    setSelectedSubview('dashboard');
    setMode('view');
  };

  const handleCreateDecision = async () => {
    if (!formTitle.trim()) return;
    try {
      const payload = {
        title: formTitle,
        summary: formSummary,
        context: formContext || (createContext?.context || ''),
        decision: formDecision,
        priority: formPriority,
        owner: formOwner || '当前用户',
        expectedImpact: formExpectedImpact,
        linkedAnomalyIds: createContext?.linkedAnomalyIds || []
      };
      const created = await api.createDecision(payload);
      await reloadDecisions();
      await reloadDashboard();
      setSelectedDecisionId(created.id);
      setMode('view');
      setCreateContext(null);
      resetForm();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateDecision = async () => {
    if (!decisionDetail) return;
    try {
      await api.updateDecision(decisionDetail.id, {
        status: decisionDetail.status,
        priority: decisionDetail.priority,
        decision: decisionDetail.decision,
        expectedImpact: decisionDetail.expectedImpact
      });
      const updated = await api.getDecision(decisionDetail.id);
      setDecisionDetail(updated);
      await reloadDecisions();
      await reloadDashboard();
      setMode('view');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteDecision = async () => {
    if (!decisionDetail) return;
    if (!window.confirm('确定删除此决策？')) return;
    await api.deleteDecision(decisionDetail.id);
    setSelectedDecisionId(null);
    setDecisionDetail(null);
    await reloadDecisions();
    await reloadDashboard();
  };

  const handleCreateFromAnomaly = (_, context) => {
    setMode('create');
    setCreateContext(context || null);
    setSelectedSubview('dashboard');
    if (context?.context) {
      setFormContext(context.context);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormSummary('');
    setFormContext('');
    setFormDecision('');
    setFormPriority('medium');
    setFormOwner('');
    setFormExpectedImpact('');
  };

  const sidebarContextItems = () => {
    if (selectedSubview === 'dashboard' && decisions) {
      return (
        <div className="sidebar-context">
          <div className="sidebar-context-header">最近决策</div>
          <ul className="sidebar-context-list">
            {decisions.slice(0, 5).map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={`sidebar-context-item ${selectedDecisionId === d.id ? 'active' : ''}`}
                  onClick={() => handleSelectDecision(d.id)}
                >
                  <span className={`priority-dot priority-${d.priority}`} />
                  <span className="context-item-title">{d.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return null;
  };

  const renderCenterContent = () => {
    switch (selectedSubview) {
      case 'dashboard':
        return (
          <DecisionDashboard
            dashboard={dashboard}
            decisions={decisions}
            anomalies={activeAnomalies || []}
            onSelectDecision={handleSelectDecision}
            onSelectAnomaly={(id) => {
              setSelectedSubview('anomaly');
            }}
            onNavigateToAnomaly={() => setSelectedSubview('anomaly')}
            onNavigateToSimulation={() => setSelectedSubview('simulation')}
          />
        );
      case 'anomaly':
        return (
          <AnomalyRCAView
            onSelectDecision={handleCreateFromAnomaly}
            onMetricNavigate={onMetricNavigate}
          />
        );
      case 'simulation':
        return <WhatIfSimulation onMetricNavigate={onMetricNavigate} />;
      case 'action':
        return (
          <ActionTracker
            onSelectDecision={handleSelectDecision}
            onMetricNavigate={onMetricNavigate}
          />
        );
      default:
        return null;
    }
  };

  const renderDrawerContent = () => {
    if (mode === 'create') {
      return (
        <div className="card decision-drawer-card">
          <header className="card-header">
            <h3>新建决策</h3>
          </header>
          <div className="decision-form">
            <label>标题 <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="决策标题" /></label>
            <label>摘要 <textarea value={formSummary} onChange={(e) => setFormSummary(e.target.value)} placeholder="决策摘要" rows={2} /></label>
            <label>背景 <textarea value={formContext} onChange={(e) => setFormContext(e.target.value)} placeholder="决策背景" rows={2} /></label>
            <label>决策内容 <textarea value={formDecision} onChange={(e) => setFormDecision(e.target.value)} placeholder="具体决策内容" rows={3} /></label>
            <label>预期影响 <textarea value={formExpectedImpact} onChange={(e) => setFormExpectedImpact(e.target.value)} placeholder="预期影响" rows={2} /></label>
            <div className="form-grid">
              <label>优先级
                <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)}>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
              <label>负责人 <input value={formOwner} onChange={(e) => setFormOwner(e.target.value)} placeholder="负责人" /></label>
            </div>
            <div className="form-actions">
              <button type="button" className="primary" onClick={handleCreateDecision} disabled={!formTitle.trim()}>创建</button>
              <button type="button" onClick={() => { setMode('view'); resetForm(); }}>取消</button>
            </div>
          </div>
        </div>
      );
    }

    if (decisionDetail) {
      return (
        <div className="card decision-drawer-card">
          <header className="card-header">
            <div>
              <h3>{decisionDetail.title}</h3>
              <p className="muted">{decisionDetail.summary}</p>
            </div>
            <div className="card-actions">
              <button type="button" onClick={() => setMode('edit')}>编辑</button>
              <button type="button" className="danger" onClick={handleDeleteDecision}>删除</button>
            </div>
          </header>

          <section>
            <div className="decision-badges">
              <span className={`status-badge status-${decisionDetail.status}`}>{STATUS_LABELS[decisionDetail.status] || decisionDetail.status}</span>
              <span className={`priority-badge priority-${decisionDetail.priority}`}>{decisionDetail.priority}</span>
              <span>负责人: {decisionDetail.owner}</span>
            </div>
          </section>

          {decisionDetail.context && (
            <section>
              <h4>背景</h4>
              <p>{decisionDetail.context}</p>
            </section>
          )}

          {decisionDetail.decision && (
            <section>
              <h4>决策内容</h4>
              <p className="decision-content">{decisionDetail.decision}</p>
            </section>
          )}

          {decisionDetail.expectedImpact && (
            <section>
              <h4>预期影响</h4>
              <p>{decisionDetail.expectedImpact}</p>
            </section>
          )}

          <section>
            <h4>关联指标</h4>
            {decisionDetail.linkedMetricIds?.length > 0 ? (
              <ul className="decision-metric-list">
                {decisionDetail.linkedMetricIds.map((id) => (
                  <li key={id}>
                    <button type="button" className="link-button" onClick={() => onMetricNavigate?.(id)}>{id}</button>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">暂无关联指标</p>}
          </section>

          <section>
            <h4>行动项 ({decisionDetail.actionItems?.length || 0})</h4>
            {decisionDetail.actionItems?.length > 0 ? (
              <ul className="decision-action-list">
                {decisionDetail.actionItems.map((a) => (
                  <li key={a.id}>
                    <span className={`status-badge-small status-${a.status}`} />
                    <span>{a.description}</span>
                    <span className="muted">{a.owner}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">暂无行动项</p>}
          </section>

          <section>
            <p className="muted meta-info">
              创建: {formatDate(decisionDetail.createdAt)} · 更新: {formatDate(decisionDetail.updatedAt)}
            </p>
          </section>
        </div>
      );
    }

    return (
      <div className="card decision-drawer-card drawer-empty">
        <h3>决策详情</h3>
        <p className="muted">选择一个决策或新建决策</p>
      </div>
    );
  };

  return (
    <div className="workspace decisions-workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>智能决策</h2>
          <button type="button" className="primary" onClick={() => { setMode('create'); resetForm(); }}>
            新建决策
          </button>
        </div>
        <nav className="subview-nav">
          {SUBVIEWS.map((sv) => (
            <button
              key={sv.key}
              type="button"
              className={`subview-nav-item ${selectedSubview === sv.key ? 'active' : ''}`}
              onClick={() => setSelectedSubview(sv.key)}
            >
              {sv.label}
            </button>
          ))}
        </nav>
        {sidebarContextItems()}
      </aside>

      <section className="graph-stage decision-center">
        <div className="graph-wrapper">
          <div className="card decision-center-card">
            {renderCenterContent()}
          </div>
        </div>
      </section>

      <aside className={`detail-drawer${decisionDetail || mode === 'create' ? '' : ' collapsed'}`}>
        {renderDrawerContent()}
      </aside>
    </div>
  );
}

DecisionWorkspace.propTypes = {
  onMetricNavigate: PropTypes.func
};

export default DecisionWorkspace;
