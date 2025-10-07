import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

function buildHighlightPayload(lines, owner, existing = []) {
  const items = [];
  const now = Date.now();
  lines.forEach((line, index) => {
    const text = line.trim();
    if (!text) return;
    const current = existing[index];
    if (current) {
      items.push({ ...current, text });
    } else {
      items.push({
        id: `hl-${now}-${index}`,
        text,
        status: 'todo',
        owner: owner || '未指定',
        dueDate: null
      });
    }
  });
  return items;
}

function NoteForm({ initialValue, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initialValue.title || '');
  const [summary, setSummary] = useState(initialValue.summary || '');
  const [body, setBody] = useState(initialValue.body || '');
  const [folderPath, setFolderPath] = useState((initialValue.folderPath || []).join(' / '));
  const [owner, setOwner] = useState(initialValue.owner || '');
  const [domain, setDomain] = useState(initialValue.tags?.domain || '');
  const [perspective, setPerspective] = useState(initialValue.tags?.perspective || '');
  const [timeTag, setTimeTag] = useState(initialValue.tags?.time || '');
  const [highlights, setHighlights] = useState(
    (initialValue.highlights || []).map((item) => item.text).join('\n')
  );

  const folderDisplay = useMemo(() => folderPath, [folderPath]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanOwner = owner || '未指定';
    const pathArray = folderDisplay
      ? folderDisplay.split('/').map((part) => part.trim()).filter(Boolean)
      : [];
    const highlightLines = highlights.split('\n');
    const payload = {
      title,
      summary,
      body,
      owner: cleanOwner,
      folderPath: pathArray,
      tags: {
        domain,
        perspective,
        time: timeTag
      },
      highlights: buildHighlightPayload(highlightLines, cleanOwner, initialValue.highlights)
    };

    if (!title || !body) {
      return;
    }

    onSubmit(payload);
  };

  return (
    <form className="note-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span>标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          <span>Owner</span>
          <input value={owner} onChange={(event) => setOwner(event.target.value)} />
        </label>
        <label>
          <span>目录路径</span>
          <input
            value={folderDisplay}
            onChange={(event) => setFolderPath(event.target.value)}
            placeholder="例：经营策略 / 边缘网络"
          />
        </label>
        <label>
          <span>领域标签</span>
          <input value={domain} onChange={(event) => setDomain(event.target.value)} />
        </label>
        <label>
          <span>视角标签</span>
          <input value={perspective} onChange={(event) => setPerspective(event.target.value)} />
        </label>
        <label>
          <span>时间标签</span>
          <input value={timeTag} onChange={(event) => setTimeTag(event.target.value)} />
        </label>
      </div>

      <label>
        <span>摘要</span>
        <textarea
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
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

      <label>
        <span>正文</span>
        <textarea
          rows={10}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="支持 [[指标名称]] 引用"
          required
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={!title || !body}>
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
