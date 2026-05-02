import PropTypes from 'prop-types';
import { formatDate } from '../utils/format';

function SummaryCard({ title, value, subtitle, status }) {
  const statusClass = status ? ` summary-card-${status}` : '';
  return (
    <div className={`summary-card${statusClass}`}>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-title">{title}</div>
      {subtitle && <div className="summary-card-subtitle">{subtitle}</div>}
    </div>
  );
}

SummaryCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  subtitle: PropTypes.string,
  status: PropTypes.string
};

function DecisionDashboard({ dashboard, decisions, anomalies, onSelectDecision, onSelectAnomaly, onNavigateToAnomaly, onNavigateToSimulation }) {
  if (!dashboard) {
    return <div className="dashboard-content"><p className="muted">加载中...</p></div>;
  }

  return (
    <div className="dashboard-content">
      <div className="dashboard-summary-grid">
        <SummaryCard
          title="决策总数"
          value={dashboard.decisions?.total || 0}
          subtitle={`进行中 ${dashboard.decisions?.open || 0} 项`}
          status={dashboard.decisions?.open > 0 ? 'warning' : 'healthy'}
        />
        <SummaryCard
          title="活跃异常"
          value={dashboard.anomalies?.active || 0}
          subtitle={`共 ${dashboard.anomalies?.total || 0} 条`}
          status={dashboard.anomalies?.active > 0 ? 'critical' : 'healthy'}
        />
        <SummaryCard
          title="待办行动"
          value={dashboard.actions?.open || 0}
          subtitle={`共 ${dashboard.actions?.total || 0} 项`}
          status={dashboard.actions?.open > 0 ? 'warning' : 'healthy'}
        />
        <SummaryCard
          title="模拟场景"
          value={dashboard.scenarios?.total || 0}
          status="info"
        />
      </div>

      <div className="dashboard-panels">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>近期决策</h3>
            <button type="button" className="link-button" onClick={() => onNavigateToAnomaly?.()}>查看全部</button>
          </div>
          <div className="dashboard-panel-body">
            {decisions && decisions.length > 0 ? (
              <ul className="dashboard-list">
                {decisions.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <button type="button" className="dashboard-list-item" onClick={() => onSelectDecision?.(d.id)}>
                      <span className={`priority-badge priority-${d.priority}`}>{d.priority}</span>
                      <span className="dashboard-list-title">{d.title}</span>
                      <span className={`status-badge status-${d.status}`}>{d.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">暂无决策</p>
            )}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>活跃异常</h3>
            <button type="button" className="link-button" onClick={() => onNavigateToAnomaly?.()}>查看全部</button>
          </div>
          <div className="dashboard-panel-body">
            {anomalies && anomalies.length > 0 ? (
              <ul className="dashboard-list">
                {anomalies.filter((a) => a.status === 'open' || a.status === 'investigating').slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <button type="button" className="dashboard-list-item" onClick={() => onSelectAnomaly?.(a.id)}>
                      <span className={`severity-badge severity-${a.severity}`}>{a.severity}</span>
                      <span className="dashboard-list-title">{a.metricName}</span>
                      <span className="muted">{a.deviation != null ? `${a.deviation > 0 ? '+' : ''}${a.deviation}%` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">暂无活跃异常</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

DecisionDashboard.propTypes = {
  dashboard: PropTypes.object,
  decisions: PropTypes.array,
  anomalies: PropTypes.array,
  onSelectDecision: PropTypes.func,
  onSelectAnomaly: PropTypes.func,
  onNavigateToAnomaly: PropTypes.func,
  onNavigateToSimulation: PropTypes.func
};

export default DecisionDashboard;
