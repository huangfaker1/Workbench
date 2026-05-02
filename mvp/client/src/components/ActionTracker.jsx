import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { formatDate } from '../utils/format';

const STATUS_ORDER = { open: 0, 'in-progress': 1, done: 2, blocked: 3 };
const STATUS_LABELS = { open: '待办', 'in-progress': '进行中', done: '已完成', blocked: '受阻' };

function ActionTracker({ onSelectDecision, onMetricNavigate }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formDesc, setFormDesc] = useState('');
  const [formOwner, setFormOwner] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formStatus, setFormStatus] = useState('open');

  const loadActions = useCallback(async () => {
    try {
      const data = await api.listAllActions({ owner: ownerFilter || undefined });
      setActions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ownerFilter]);

  useEffect(() => { loadActions(); }, [loadActions]);

  const handleStatusChange = async (id, newStatus) => {
    await api.updateAction(id, { status: newStatus });
    await loadActions();
  };

  const handleCreateAction = async () => {
    if (!formDesc.trim()) return;
    // Create action under a placeholder decision or first available
    const decisions = await api.listDecisions();
    if (decisions.length === 0) {
      alert('请先创建决策');
      return;
    }
    await api.createAction(decisions[0].id, {
      description: formDesc,
      owner: formOwner || '未指定',
      dueDate: formDueDate || null,
      status: formStatus
    });
    await loadActions();
    setShowForm(false);
    setFormDesc('');
    setFormOwner('');
    setFormDueDate('');
  };

  const sortedActions = [...actions].sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
  const columns = ['open', 'in-progress', 'done', 'blocked'];

  return (
    <div className="action-tracker-view">
      <div className="action-tracker-header">
        <h3>行动跟踪</h3>
        <div className="action-tracker-tools">
          <input value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} placeholder="按负责人筛选" className="filter-input" />
          <button type="button" className="primary" onClick={() => setShowForm(true)}>新建行动</button>
        </div>
      </div>

      {showForm && (
        <div className="action-form-overlay">
          <div className="action-form-card">
            <h4>新建行动项</h4>
            <label>
              描述 <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="行动描述" rows={2} />
            </label>
            <label>
              负责人 <input value={formOwner} onChange={(e) => setFormOwner(e.target.value)} placeholder="负责人" />
            </label>
            <label>
              截止日期 <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </label>
            <div className="form-actions">
              <button type="button" className="primary" onClick={handleCreateAction} disabled={!formDesc.trim()}>创建</button>
              <button type="button" onClick={() => setShowForm(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="muted">加载中...</p> : (
        <div className="action-kanban">
          {columns.map((col) => (
            <div key={col} className="action-column">
              <div className="action-column-header">
                <span className={`status-badge status-${col}`}>{STATUS_LABELS[col]}</span>
                <span className="action-count">{sortedActions.filter((a) => a.status === col).length}</span>
              </div>
              <div className="action-column-body">
                {sortedActions.filter((a) => a.status === col).map((action) => (
                  <div key={action.id} className="action-card">
                    <p className="action-card-desc">{action.description}</p>
                    <div className="action-card-meta">
                      <span>负责人: {action.owner}</span>
                      {action.dueDate && <span>截止: {action.dueDate}</span>}
                    </div>
                    <div className="action-card-actions">
                      {col !== 'done' && <button type="button" className="small-btn" onClick={() => handleStatusChange(action.id, 'done')}>完成</button>}
                      {col === 'open' && <button type="button" className="small-btn" onClick={() => handleStatusChange(action.id, 'in-progress')}>开始</button>}
                      {col === 'in-progress' && <button type="button" className="small-btn" onClick={() => handleStatusChange(action.id, 'blocked')}>受阻</button>}
                      {col === 'blocked' && <button type="button" className="small-btn" onClick={() => handleStatusChange(action.id, 'in-progress')}>恢复</button>}
                      {col === 'done' && <button type="button" className="small-btn" onClick={() => handleStatusChange(action.id, 'open')}>重开</button>}
                    </div>
                  </div>
                ))}
                {sortedActions.filter((a) => a.status === col).length === 0 && (
                  <p className="muted column-empty">暂无</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

ActionTracker.propTypes = {
  onSelectDecision: PropTypes.func,
  onMetricNavigate: PropTypes.func
};

export default ActionTracker;
