import PropTypes from 'prop-types';

const metricPattern = /\[\[([^\]]+)\]\]/g;

function buildSegments(text) {
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = metricPattern.exec(text)) !== null) {
    const [full, metricName] = match;
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'metric', value: metricName.trim(), raw: full });
    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

function renderSegments(segments, onMetricClick) {
  return segments.map((segment, index) => {
    if (segment.type === 'metric') {
      return (
        <button
          key={`metric-${segment.value}-${index}`}
          type="button"
          className="metric-link"
          onClick={() => onMetricClick?.(segment.value)}
        >
          {segment.value}
        </button>
      );
    }
    return <span key={`text-${index}`}>{segment.value}</span>;
  });
}

export function RichText({ text, onMetricClick }) {
  if (!text) {
    return <p className="muted">暂无内容</p>;
  }

  const lines = text.split(/\n+/);

  return (
    <div className="rich-text">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={`break-${index}`} className="line-break" />;
        }

        if (trimmed.startsWith('### ')) {
          const content = line.replace(/^###\s*/, '');
          return (
            <h4 key={`h4-${index}`}>{renderSegments(buildSegments(content), onMetricClick)}</h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          const content = line.replace(/^##\s*/, '');
          return (
            <h3 key={`h3-${index}`}>{renderSegments(buildSegments(content), onMetricClick)}</h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          const content = line.replace(/^#\s*/, '');
          return (
            <h2 key={`h2-${index}`}>{renderSegments(buildSegments(content), onMetricClick)}</h2>
          );
        }
        if (trimmed.startsWith('- ')) {
          const content = line.replace(/^-\s*/, '');
          return (
            <div key={`bullet-${index}`} className="bullet-line">
              <span className="bullet">•</span>
              <span>{renderSegments(buildSegments(content), onMetricClick)}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const content = line.replace(/^\d+\.\s*/, '');
          const order = trimmed.match(/^\d+/)?.[0] || '';
          return (
            <div key={`number-${index}`} className="bullet-line">
              <span className="bullet">{order}.</span>
              <span>{renderSegments(buildSegments(content), onMetricClick)}</span>
            </div>
          );
        }

        return (
          <p key={`p-${index}`}>{renderSegments(buildSegments(line), onMetricClick)}</p>
        );
      })}
    </div>
  );
}

RichText.propTypes = {
  text: PropTypes.string,
  onMetricClick: PropTypes.func
};

RichText.defaultProps = {
  text: '',
  onMetricClick: undefined
};

export default RichText;
