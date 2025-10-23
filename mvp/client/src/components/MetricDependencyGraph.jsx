import PropTypes from 'prop-types';

function DependencySubtree({ node, onSelect, depth }) {
  if (!node) return null;

  const children = Array.isArray(node.children) ? node.children : [];
  const hasMultipleChildren = children.length > 1;

  const nodeSegments = children.map((child, index) => ({
    child,
    operatorBefore: child.operationBefore || (index === 0 ? '' : '×')
  }));

  const totalColumns = hasMultipleChildren ? Math.max(nodeSegments.length * 2 - 1, 0) : nodeSegments.length;
  const columnSegments = Array.from({ length: totalColumns }, (_, idx) => (
    hasMultipleChildren
      ? idx % 2 === 0 ? 'minmax(160px, 1fr)' : 'minmax(36px, 72px)'
      : 'minmax(220px, 320px)'
  ));
  const gridTemplateColumns = columnSegments.length > 0 ? columnSegments.join(' ') : 'minmax(160px, 1fr)';

  const connectorCells = nodeSegments.length
    ? hasMultipleChildren
      ? Array.from({ length: totalColumns }, (_, idx) => {
          if (idx % 2 !== 0) {
            return <div key={`connector-spacer-${depth}-${idx}`} />;
          }
          const nodeIdx = Math.floor(idx / 2);
          const segment = nodeSegments[nodeIdx];
          return (
            <div
              key={`connector-slot-${depth}-${segment.child.id || idx}`}
              className="connector-slot"
            />
          );
        })
      : [
          <div key={`connector-slot-${depth}-single`} className="connector-slot single" />
        ]
    : null;

  const childRowCells = nodeSegments.length
    ? hasMultipleChildren
      ? Array.from({ length: totalColumns }, (_, idx) => {
          if (idx % 2 !== 0) {
            const gapIndex = Math.floor((idx + 1) / 2);
            const gapSegment = nodeSegments[gapIndex];
            return (
              <div key={`operator-gap-${depth}-${idx}`} className="operator-gap">
                <span className="operator-inline">{gapSegment?.operatorBefore || ''}</span>
              </div>
            );
          }
          const nodeIdx = Math.floor(idx / 2);
          const segment = nodeSegments[nodeIdx];
          return (
            <div key={`child-${depth}-${segment.child.id || idx}`} className="child-wrapper">
              <DependencySubtree node={segment.child} onSelect={onSelect} depth={depth + 1} />
            </div>
          );
        })
      : nodeSegments.map((segment, idx) => (
          <div key={`child-single-${depth}-${segment.child.id || idx}`} className="child-wrapper single">
            <DependencySubtree node={segment.child} onSelect={onSelect} depth={depth + 1} />
          </div>
        ))
    : null;

  const levelClass = `level-${Math.min(depth, 3)}`;

  const renderRootCard = () => (
    <div className="root-card">
      <button type="button" className="root-title" onClick={() => onSelect?.(node.id)}>
        {node.name}
      </button>
    </div>
  );

  const renderChildCard = () => {
    const title = node.displayNameOverride || node.name;
    const statusClass = node.status ? `child-node status-${node.status}` : 'child-node';
    return (
      <div className={`subtree-card ${levelClass}`}>
        <div className={`node-pill ${statusClass}`}>
          <button
            type="button"
            className="child-title"
            onClick={() => onSelect?.(node.id)}
            disabled={node.status === 'missing' || node.status === 'loop'}
          >
            {title}
          </button>
        </div>
        {node.note ? <p className="subtree-note">{node.note}</p> : <p className="subtree-note muted">暂无描述</p>}
      </div>
    );
  };

  return (
    <div className={`dependency-subtree depth-${depth} ${levelClass}`}>
      <div className="node-block">{depth === 0 ? renderRootCard() : renderChildCard()}</div>
      {hasMultipleChildren ? (
        <>
          <div className="root-connector">
            <span className="root-connector-line" />
          </div>
          <div className="connector-row-grid" style={{ gridTemplateColumns }}>
            {connectorCells}
          </div>
          <div className="child-row horizontal" style={{ gridTemplateColumns }}>
            {childRowCells}
          </div>
        </>
      ) : nodeSegments.length ? (
        <div className="single-child-stack">
          <div className="connector-row-grid single">
            {connectorCells}
          </div>
          <div className="child-row horizontal single">
            {childRowCells}
          </div>
        </div>
      ) : depth === 0 ? (
        <p className="muted">当前指标未配置依赖</p>
      ) : null}
    </div>
  );
}

DependencySubtree.propTypes = {
  node: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    displayNameOverride: PropTypes.string,
    status: PropTypes.string,
    version: PropTypes.string,
    formula: PropTypes.string,
    note: PropTypes.string,
    operationBefore: PropTypes.string,
    children: PropTypes.array
  }),
  onSelect: PropTypes.func,
  depth: PropTypes.number
};

DependencySubtree.defaultProps = {
  node: null,
  onSelect: undefined,
  depth: 0
};

function MetricDependencyGraph({ graph, loading, onSelect }) {
  if (loading) {
    return <p>血缘结构加载中…</p>;
  }

  if (!graph) {
    return <p className="muted">暂无血缘结构数据</p>;
  }

  return (
    <div className="dependency-graph horizontal">
      <DependencySubtree node={graph} onSelect={onSelect} depth={0} />
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
