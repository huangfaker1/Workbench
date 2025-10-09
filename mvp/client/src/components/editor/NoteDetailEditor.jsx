import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import NoteComposer from './NoteComposer';
import { buildHighlightPayload } from './utils';
import { RelatedMetricList } from './NoteInsightSections';
import { formatDate } from '../../utils/format';

const AUTO_SAVE_DELAY = 1500;

function NoteDetailEditor({
  note,
  relatedMetrics,
  onMetricNavigate,
  onSave,
  onDuplicate,
  onDelete
}) {
  const [title, setTitle] = useState(note.title || '');
  const [owner, setOwner] = useState(note.owner || '');
  const [summary, setSummary] = useState(note.summary || '');
  const [highlightsText, setHighlightsText] = useState((note.highlights || []).map((item) => item.text).join('\n'));
  const [body, setBody] = useState(note.body || '');
  const saveTimer = useRef(null);
  const [status, setStatus] = useState('saved'); // editing | saving | saved | error
  const lastSavedSnapshot = useRef({ title: note.title, owner: note.owner, summary: note.summary, highlightsText: (note.highlights || []).map((item) => item.text).join('\n'), body: note.body });

  const dirty = useMemo(() => {
    return (
      title !== lastSavedSnapshot.current.title ||
      owner !== lastSavedSnapshot.current.owner ||
      summary !== lastSavedSnapshot.current.summary ||
      highlightsText !== lastSavedSnapshot.current.highlightsText ||
      body !== lastSavedSnapshot.current.body
    );
  }, [title, owner, summary, highlightsText, body]);

  useEffect(() => {
    setTitle(note.title || '');
    setOwner(note.owner || '');
    setSummary(note.summary || '');
    setHighlightsText((note.highlights || []).map((item) => item.text).join('\n'));
    setBody(note.body || '');
    lastSavedSnapshot.current = {
      title: note.title || '',
      owner: note.owner || '',
      summary: note.summary || '',
      highlightsText: (note.highlights || []).map((item) => item.text).join('\n'),
      body: note.body || ''
    };
    setStatus('saved');
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, [note.id]);

  useEffect(() => {
    if (!dirty) return undefined;
    setStatus('editing');
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await onSave({
          title,
          owner,
          summary,
          body,
          highlights: buildHighlightPayload(highlightsText.split('\n'), owner, note.highlights || []),
          folderPath: note.folderPath || [],
          tags: note.tags || {},
          id: note.id
        });
        lastSavedSnapshot.current = {
          title,
          owner,
          summary,
          highlightsText,
          body
        };
        setStatus('saved');
      } catch (error) {
        console.error(error);
        setStatus('error');
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [dirty, title, owner, summary, highlightsText, body, onSave, note.highlights, note.folderPath, note.tags, note.id]);

  const primaryMetric = useMemo(() => (relatedMetrics && relatedMetrics.length > 0 ? relatedMetrics[0] : null), [relatedMetrics]);

  const statusText = {
    editing: '有未保存的修改…',
    saving: '自动保存中…',
    saved: '已自动保存',
    error: '保存失败，请检查网络'
  }[status];

  return (
    <div className="note-inline-editor">
      <div className="note-editor-topbar">
        <div className="note-breadcrumb">{(note.folderPath || []).join(' / ') || '未分类'}</div>
        <div className="note-header-utilities">
          <span className={`save-status ${status}`}>{statusText}</span>
          <button type="button" className="icon-button" onClick={() => onDuplicate(note)} title="复制">
            ⧉
          </button>
          <button type="button" className="icon-button" onClick={() => onDelete(note)} title="删除">
            🗑
          </button>
        </div>
      </div>

      <div className="note-inline-fields">
        <div className="note-inline-row">
          <label htmlFor="note-title">标题</label>
          <input
            id="note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="输入标题"
          />
        </div>
        <div className="note-inline-row">
          <label htmlFor="note-owner">Owner</label>
          <input
            id="note-owner"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="负责人"
          />
        </div>
      </div>

      <div className="note-inline-summary">
        <label htmlFor="note-summary">摘要</label>
        <textarea
          id="note-summary"
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="概述重点，支持自动摘要"
        />
      </div>

      <div className="note-inline-highlights">
        <label htmlFor="note-highlights">要点（换行分隔）</label>
        <textarea
          id="note-highlights"
          rows={4}
          value={highlightsText}
          onChange={(event) => setHighlightsText(event.target.value)}
          placeholder="示例：结合[[单位带宽售卖成本]]设定底价"
        />
      </div>

      <div className="note-inline-composer">
        <NoteComposer
          value={body}
          onChange={(next) => setBody(next || '')}
          relatedMetrics={relatedMetrics}
          onMetricNavigate={onMetricNavigate}
        />
      </div>

      {primaryMetric ? (
        <div className="metric-reference-card">
          <div className="metric-card-header">
            <span className="metric-card-label">指标引用</span>
            <button
              type="button"
              className="link-button"
              onClick={() => onMetricNavigate?.(primaryMetric.id)}
            >
              {primaryMetric.name}
            </button>
          </div>
          <div className="metric-card-body">
            <div>
              <span className="metric-value">{primaryMetric.currentValue || '—'}</span>
              {primaryMetric.refreshFrequency ? (
                <span className="metric-hint">刷新：{primaryMetric.refreshFrequency}</span>
              ) : null}
            </div>
            <div className="metric-meta-line">更新：{primaryMetric.updatedAt ? formatDate(primaryMetric.updatedAt) : '—'}</div>
            <button
              type="button"
              className="metric-open-button"
              onClick={() => onMetricNavigate?.(primaryMetric.id)}
            >
              查看完整指标定义
            </button>
          </div>
        </div>
      ) : null}

      <section className="note-section">
        <h3>关联指标</h3>
        <RelatedMetricList
          metrics={relatedMetrics}
          onMetricNavigate={onMetricNavigate}
          noteUpdatedAt={note.updatedAt}
        />
      </section>

      {note.revisions?.length ? (
        <section className="note-section">
          <h3>版本历史</h3>
          <ul className="history-list">
            {note.revisions.map((revision) => (
              <li key={revision.id}>
                <span>版本 v{revision.version}</span>
                <span>更新时间：{formatDate(revision.createdAt)}</span>
                <span>更新人：{revision.updatedBy}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

NoteDetailEditor.propTypes = {
  note: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    owner: PropTypes.string,
    summary: PropTypes.string,
    body: PropTypes.string,
    folderPath: PropTypes.arrayOf(PropTypes.string),
    tags: PropTypes.object,
    highlights: PropTypes.array,
    revisions: PropTypes.array
  }).isRequired,
  relatedMetrics: PropTypes.array,
  onMetricNavigate: PropTypes.func,
  onSave: PropTypes.func.isRequired,
  onDuplicate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};

NoteDetailEditor.defaultProps = {
  relatedMetrics: [],
  onMetricNavigate: () => {}
};

export default NoteDetailEditor;
