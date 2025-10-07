import PropTypes from 'prop-types';

function MetricDependencyGraph({ graph, loading, onSelect }) {
  if (loading) {
    return <p>血缘结构加载中…</p>;
  }

  if (!graph) {
    return <p className="muted">暂无血缘结构数据</p>;
  }

  const children = Array.isArray(graph.children) ? graph.children : [];

  const nodeSegments = children.map((child, index) => ({
    child,
    operatorBefore: index === 0 ? '＝' : child.operationBefore || '×'
  }));

  const totalColumns = Math.max(nodeSegments.length * 2 - 1, 0);
  const columnSegments = Array.from({ length: totalColumns }, (_, idx) => (
    idx % 2 === 0 ? 'minmax(140px, 1fr)' : 'minmax(32px, 70px)'
  ));
  const gridTemplateColumns = columnSegments.length > 0 ? columnSegments.join(' ') : '1fr';

  const connectorCells = Array.from({ length: totalColumns }, (_, idx) => {
    if (idx % 2 !== 0) {
      return <div key={`connector-spacer-${idx}`} />;
    }
    const nodeIdx = Math.floor(idx / 2);
    return <div key={`connector-slot-${nodeSegments[nodeIdx]?.child?.id || idx}`} className="connector-slot" />;
  });

  const childCells = [];
  nodeSegments.forEach((segment, index) => {
    if (index > 0) {
      childCells.push(
        <div key={`operator-${segment.child.id}`} className="operator-between">
          {segment.operatorBefore}
        </div>
      );
    }
    const statusClass = segment.child.status ? `child-node status-${segment.child.status}` : 'child-node';
    const childTitle = segment.child.displayNameOverride || segment.child.name;
    childCells.push(
      <div key={`child-${segment.child.id}`} className="child-wrapper">
        <div className={statusClass}>
          <button
            type="button"
            className="child-title"
            onClick={() => onSelect?.(segment.child.id)}
            disabled={segment.child.status === 'missing' || segment.child.status === 'loop'}
          >
            {childTitle}
          </button>
          <p className="child-meta">版本：{segment.child.version}</p>
          {segment.child.note ? <p className="child-note">{segment.child.note}</p> : null}
        </div>
      </div>
    );
  });

  return (
    <div className="dependency-graph horizontal">
      <div className="root-card">
        <button type="button" className="root-title" onClick={() => onSelect?.(graph.id)}>
          {graph.name}
        </button>
        <p className="root-meta">当前版本：{graph.version}</p>
        {graph.note ? <p className="root-note">{graph.note}</p> : null}
        {graph.formula ? <p className="root-formula">公式：{graph.formula}</p> : null}
      </div>

      {nodeSegments.length ? (
        <>
          <div className="root-connector">
            <span className="root-connector-line" />
          </div>
          <div className="connector-row-grid" style={{ gridTemplateColumns }}>
            {connectorCells}
          </div>
          <div className="child-row horizontal" style={{ gridTemplateColumns }}>
            {childCells}
          </div>
        </>
      ) : (
        <p className="muted">当前指标未配置依赖</p>
      )}
    </div>
  );
}

MetricDependencyGraph.propTypes = {
  graph: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    version: PropTypes.string,
    formula: PropTypes.string,
    note: PropTypes.string,
    children: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        displayNameOverride: PropTypes.string,
        status: PropTypes.string,
        version: PropTypes.string,
        note: PropTypes.string,
        children: PropTypes.array
      })
    )
  }),
  loading: PropTypes.bool,
  onSelect: PropTypes.func
};

MetricDependencyGraph.defaultProps = {
  graph: null,
  loading: false,
  onSelect: undefined
};

export default MetricDependencyGraph;
