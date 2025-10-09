import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import NoteComposer from './editor/NoteComposer';
import { buildHighlightPayload } from './editor/utils';

function NoteForm({ initialValue, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initialValue.title || '');
  const [summary, setSummary] = useState(initialValue.summary || '');
  const [body, setBody] = useState(initialValue.body || '');
  const [owner, setOwner] = useState(initialValue.owner || '');
  const [highlights, setHighlights] = useState(
    (initialValue.highlights || []).map((item) => item.text).join('\n')
  );
  const [showAdvanced, setShowAdvanced] = useState(Boolean(summary || highlights));

  const folderPath = initialValue.folderPath || [];

  useEffect(() => {
    setTitle(initialValue.title || '');
    setSummary(initialValue.summary || '');
    setBody(initialValue.body || '');
    setOwner(initialValue.owner || '');
    setHighlights((initialValue.highlights || []).map((item) => item.text).join('\n'));
    setShowAdvanced(Boolean(initialValue.summary || (initialValue.highlights || []).length));
  }, [initialValue]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanOwner = owner || '未指定';
    const pathArray = folderPath.slice();
    const highlightLines = highlights.split('\n');
    const trimmedBody = body.trim();
    const firstContentLine = trimmedBody
      .split('\n')
      .find((line) => line.trim())
      ?.trim();
    const autoSummary = summary.trim() || (firstContentLine ? firstContentLine.slice(0, 120) : '');
    const payload = {
      title,
      summary: autoSummary,
      body,
      owner: cleanOwner,
      folderPath: pathArray,
      tags: initialValue.tags || {},
      highlights: buildHighlightPayload(highlightLines, cleanOwner, initialValue.highlights)
    };

    if (!title || !trimmedBody) {
      return;
    }

    onSubmit(payload);
  };

  return (
    <form className="note-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="full-width">
          <span>标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          <span>Owner</span>
          <input value={owner} onChange={(event) => setOwner(event.target.value)} />
        </label>
      </div>

      <div className="composer-wrapper">
        <div className="composer-heading">正文</div>
        <NoteComposer value={body} onChange={(next) => setBody(next || '')} relatedMetrics={[]} />
      </div>

      <div className={`advanced-panel${showAdvanced ? ' open' : ''}`}>
        <button
          type="button"
          className="link-button"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced ? '隐藏摘要与要点' : '展开摘要与要点（可选）'}
        </button>

        {showAdvanced ? (
          <div className="advanced-fields">
            <label>
              <span>摘要</span>
              <textarea
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="可选，留空将自动提取正文首段"
              />
            </label>

            <label>
              <span>要点（换行分隔）</span>
              <textarea
                rows={4}
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
                placeholder="示例：结合[[单位带宽售卖成本]]设定底价"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={!title.trim() || !body.trim()}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

NoteForm.propTypes = {
  initialValue: PropTypes.shape({
    title: PropTypes.string,
    summary: PropTypes.string,
    body: PropTypes.string,
    folderPath: PropTypes.arrayOf(PropTypes.string),
    owner: PropTypes.string,
    tags: PropTypes.shape({
      domain: PropTypes.string,
      perspective: PropTypes.string,
      time: PropTypes.string
    }),
    highlights: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        text: PropTypes.string,
        status: PropTypes.string,
        owner: PropTypes.string,
        dueDate: PropTypes.string
      })
    )
  }),
  submitLabel: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

NoteForm.defaultProps = {
  initialValue: {},
  submitLabel: '保存'
};

export default NoteForm;
