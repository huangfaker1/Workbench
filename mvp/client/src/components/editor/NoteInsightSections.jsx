import PropTypes from 'prop-types';
import RichText from '../RichText';

export function NoteHighlightsSection({ highlights, onMetricNavigate, metricIndex }) {
  if (!highlights || highlights.length === 0) {
    return <p className="muted">暂无要点</p>;
  }
  return (
    <ul className="highlight-list">
      {highlights.map((highlight) => (
        <li key={highlight.id}>
          <RichText text={highlight.text} onMetricClick={onMetricNavigate} />
          <div className="highlight-meta">
            <span className="tag">状态：{highlight.status || '未设定'}</span>
            {highlight.owner ? <span className="tag">负责人：{highlight.owner}</span> : null}
            {highlight.dueDate ? <span className="tag">截止：{highlight.dueDate}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

NoteHighlightsSection.propTypes = {
  highlights: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      text: PropTypes.string,
      status: PropTypes.string,
      owner: PropTypes.string,
      dueDate: PropTypes.string
    })
  ),
  onMetricNavigate: PropTypes.func
};

NoteHighlightsSection.defaultProps = {
  highlights: [],
  onMetricNavigate: undefined
};

export function RelatedMetricList({ metrics, onMetricNavigate, noteUpdatedAt }) {
  if (!metrics || metrics.length === 0) {
    return <p className="muted">暂无关联指标</p>;
  }

  return (
    <ul className="metric-summary-list">
      {metrics.map((metric) => {
        const isOutdated = noteUpdatedAt && metric.updatedAt && new Date(metric.updatedAt) > new Date(noteUpdatedAt);
        return (
          <li key={metric.id} className={isOutdated ? 'outdated' : ''}>
            <div>
              <button type="button" className="link-button" onClick={() => onMetricNavigate?.(metric.id)}>
                {metric.name}
              </button>
              <span className="tag">版本：{metric.currentVersion || '未发布'}</span>
              <span className="tag">刷新：{metric.refreshFrequency || '未知'}</span>
            </div>
            {isOutdated ? <span className="warning">指标有更新，建议同步口径</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

RelatedMetricList.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      currentVersion: PropTypes.string,
      refreshFrequency: PropTypes.string,
      updatedAt: PropTypes.string
    })
  ),
  onMetricNavigate: PropTypes.func,
  noteUpdatedAt: PropTypes.string
};

RelatedMetricList.defaultProps = {
  metrics: [],
  onMetricNavigate: undefined,
  noteUpdatedAt: ''
};
