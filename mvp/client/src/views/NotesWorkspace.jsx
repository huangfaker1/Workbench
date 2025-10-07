import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { formatDate, formatFolderPath } from '../utils/format';
import RichText from '../components/RichText';
import NoteForm from '../components/NoteForm';

function NoteHighlights({ highlights, onMetricNavigate }) {
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

NoteHighlights.propTypes = {
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

NoteHighlights.defaultProps = {
  highlights: [],
  onMetricNavigate: undefined
};

function RelatedMetricList({ metrics, onMetricNavigate, noteUpdatedAt }) {
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
              <button type="button" className="link-button" onClick={() => onMetricNavigate(metric.id)}>
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

function NotesWorkspace({ onMetricNavigate }) {
  const { data: notesData, loading, error, execute: reloadNotes, setData } = useAsync(() => api.listNotes(), []);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [noteDetail, setNoteDetail] = useState(null);
  const [relatedMetrics, setRelatedMetrics] = useState([]);
  const [activeFolder, setActiveFolder] = useState('全部');
  const [mode, setMode] = useState('view'); // view | create | edit
  const [draftInitial, setDraftInitial] = useState({});

  const notes = notesData || [];

  const folderOptions = useMemo(() => {
    const set = new Set();
    notes.forEach((note) => {
      const pathLabel = formatFolderPath(note.folderPath);
      if (pathLabel) {
        set.add(pathLabel);
      }
    });
    return ['全部', ...Array.from(set)];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (activeFolder === '全部') {
      return notes;
    }
    return notes.filter((note) => formatFolderPath(note.folderPath) === activeFolder);
  }, [notes, activeFolder]);

  useEffect(() => {
    if (!selectedNoteId && filteredNotes.length > 0 && mode === 'view') {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId, mode]);

  useEffect(() => {
    if (!selectedNoteId) {
      setNoteDetail(null);
      setRelatedMetrics([]);
      return;
    }
    let cancelled = false;
    async function fetchDetail() {
      try {
        const [detail, metricsResponse] = await Promise.all([
          api.getNote(selectedNoteId),
          api.getNoteRelatedMetrics(selectedNoteId)
        ]);
        if (cancelled) return;
        setNoteDetail(detail);
        setRelatedMetrics(metricsResponse);
      } catch (err) {
        console.error(err);
      }
    }
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedNoteId]);

  const handleCreate = async (payload) => {
    try {
      const created = await api.createNote(payload);
      const updatedList = await reloadNotes();
      setMode('view');
      if (updatedList) {
        setData(updatedList);
      }
      setSelectedNoteId(created.id);
      const metricsResponse = await api.getNoteRelatedMetrics(created.id);
      setRelatedMetrics(metricsResponse);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (payload) => {
    if (!noteDetail) return;
    try {
      const updated = await api.updateNote(noteDetail.id, { ...payload, updatedBy: payload.owner });
      const updatedList = await reloadNotes();
      if (updatedList) {
        setData(updatedList);
      }
      setNoteDetail(updated);
      const metricsResponse = await api.getNoteRelatedMetrics(updated.id);
      setRelatedMetrics(metricsResponse);
      setMode('view');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMetricClick = (metricName) => {
    if (!onMetricNavigate) return;
    const matched = relatedMetrics.find((item) => item.name === metricName);
    if (matched) {
      onMetricNavigate(matched.id);
    } else {
      alert(`未找到指标：${metricName}`);
    }
  };

  return (
    <div className="workspace notes-workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>目录</h2>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setDraftInitial({
                folderPath: activeFolder === '全部' ? [] : activeFolder.split(' / ')
              });
              setMode('create');
              setSelectedNoteId(null);
            }}
          >
            新建笔记
          </button>
        </div>
        <ul className="folder-list">
          {folderOptions.map((folder) => (
            <li key={folder}>
              <button
                type="button"
                className={folder === activeFolder ? 'active' : ''}
                onClick={() => {
                  setActiveFolder(folder);
                  setMode('view');
                }}
              >
                {folder}
              </button>
            </li>
          ))}
        </ul>
        <div className="note-count">共 {filteredNotes.length} 条笔记</div>
      </aside>

      <section className="content">
        <div className="note-list">
          {loading ? <p>加载中...</p> : null}
          {error ? <p className="error">{error.message}</p> : null}
          {!loading && filteredNotes.length === 0 ? <p className="muted">当前目录暂无笔记</p> : null}
          <ul>
            {filteredNotes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={selectedNoteId === note.id ? 'active' : ''}
                  onClick={() => {
                    setMode('view');
                    setSelectedNoteId(note.id);
                  }}
                >
                  <h3>{note.title}</h3>
                  <p className="note-summary">{note.summary}</p>
                  <div className="note-meta">
                    <span>{formatFolderPath(note.folderPath) || '未分类'}</span>
                    <span>更新时间：{formatDate(note.updatedAt)}</span>
                  </div>
                  <div className="note-tags">
                    {note.tags?.domain ? <span className="tag">{note.tags.domain}</span> : null}
                    {note.tags?.perspective ? <span className="tag">{note.tags.perspective}</span> : null}
                    {note.tags?.time ? <span className="tag">{note.tags.time}</span> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="note-detail">
          {mode === 'create' ? (
            <div className="card">
              <header className="card-header">
                <h2>新建笔记</h2>
              </header>
              <NoteForm
                initialValue={draftInitial}
                submitLabel="创建"
                onSubmit={handleCreate}
                onCancel={() => {
                  setMode('view');
                  if (filteredNotes.length > 0) {
                    setSelectedNoteId(filteredNotes[0].id);
                  }
                }}
              />
            </div>
          ) : null}

          {mode === 'edit' && noteDetail ? (
            <div className="card">
              <header className="card-header">
                <h2>编辑笔记</h2>
              </header>
              <NoteForm
                initialValue={noteDetail}
                submitLabel="保存变更"
                onSubmit={handleUpdate}
                onCancel={() => setMode('view')}
              />
            </div>
          ) : null}

          {mode === 'view' && noteDetail ? (
            <div className="card">
              <header className="card-header">
                <div>
                  <h2>{noteDetail.title}</h2>
                  <p className="muted">
                    {formatFolderPath(noteDetail.folderPath) || '未分类'} · Owner：{noteDetail.owner} · 更新于 {formatDate(noteDetail.updatedAt)}
                  </p>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={() => setMode('edit')}>
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!noteDetail) return;
                      const cloneInitial = {
                        title: `${noteDetail.title}（复制）`,
                        summary: noteDetail.summary,
                        body: noteDetail.body,
                        folderPath: noteDetail.folderPath,
                        owner: noteDetail.owner,
                        tags: noteDetail.tags,
                        highlights: noteDetail.highlights
                      };
                      setDraftInitial(cloneInitial);
                      setMode('create');
                      setSelectedNoteId(null);
                    }}
                  >
                    复制新建
                  </button>
                </div>
              </header>

              <section>
                <h3>摘要</h3>
                <p>{noteDetail.summary || '暂无摘要'}</p>
              </section>

              <section>
                <h3>要点</h3>
                <NoteHighlights highlights={noteDetail.highlights} onMetricNavigate={handleMetricClick} />
              </section>

              <section>
                <h3>正文</h3>
                <RichText text={noteDetail.body} onMetricClick={handleMetricClick} />
              </section>

              <section>
                <h3>关联指标</h3>
                <RelatedMetricList
                  metrics={relatedMetrics}
                  onMetricNavigate={onMetricNavigate}
                  noteUpdatedAt={noteDetail.updatedAt}
                />
              </section>

              <section>
                <h3>版本历史</h3>
                <ul className="history-list">
                  {noteDetail.revisions?.map((revision) => (
                    <li key={revision.id}>
                      <span>版本 v{revision.version}</span>
                      <span>更新时间：{formatDate(revision.createdAt)}</span>
                      <span>更新人：{revision.updatedBy}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {mode === 'view' && !noteDetail ? <p className="muted">请选择一条笔记</p> : null}
        </div>
      </section>
    </div>
  );
}

NotesWorkspace.propTypes = {
  onMetricNavigate: PropTypes.func
};

NotesWorkspace.defaultProps = {
  onMetricNavigate: undefined
};

export default NotesWorkspace;
