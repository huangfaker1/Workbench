import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../utils/format';
import NoteForm from '../components/NoteForm';
import NoteDetailEditor from '../components/editor/NoteDetailEditor';

function buildNoteTree(notes) {
  const root = {
    id: 'folder-root',
    name: '全部',
    type: 'folder',
    path: [],
    children: []
  };
  const folderMap = new Map();
  folderMap.set('', root);

  notes.forEach((note) => {
    const path = note.folderPath || [];
    let parentKey = '';
    path.forEach((segment, index) => {
      const currentPath = path.slice(0, index + 1);
      const key = currentPath.join(' / ');
      if (!folderMap.has(key)) {
        const folderNode = {
          id: `folder-${key || 'root'}`,
          name: segment,
          type: 'folder',
          path: currentPath,
          children: []
        };
        folderMap.get(parentKey).children.push(folderNode);
        folderMap.set(key, folderNode);
      }
      parentKey = key;
    });

    const targetFolder = folderMap.get(parentKey);
    targetFolder.children.push({
      id: note.id,
      name: note.title,
      type: 'note',
      note,
      path: note.folderPath || []
    });
  });

  return root;
}

function flattenNotes(node, acc = []) {
  if (!node || !node.children) {
    return acc;
  }

  node.children.forEach((child) => {
    if (child.type === 'note') {
      acc.push({
        id: child.id,
        depth: child.path?.length || 0,
        note: child.note
      });
    } else if (child.type === 'folder') {
      flattenNotes(child, acc);
    }
  });

  return acc;
}


function NotesWorkspace({ onMetricNavigate }) {
  const { data: notesData, loading, error, execute: reloadNotes, setData } = useAsync(() => api.listNotes(), []);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [noteDetail, setNoteDetail] = useState(null);
  const [relatedMetrics, setRelatedMetrics] = useState([]);
  const [mode, setMode] = useState('view'); // view | create | edit
  const [draftInitial, setDraftInitial] = useState({});

  const notes = notesData || [];

  const noteTree = useMemo(() => buildNoteTree(notes), [notes]);
  const orderedNotes = useMemo(() => flattenNotes(noteTree), [noteTree]);

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [inspectorTab, setInspectorTab] = useState('property');

  const filteredNotes = useMemo(() => {
    const keyword = sidebarSearch.trim().toLowerCase();
    if (!keyword) return orderedNotes;
    return orderedNotes.filter(({ note }) => note.title.toLowerCase().includes(keyword));
  }, [orderedNotes, sidebarSearch]);


  useEffect(() => {
    if (!selectedNoteId && orderedNotes.length > 0 && mode === 'view') {
      setSelectedNoteId(orderedNotes[0].note.id);
    }
  }, [orderedNotes, selectedNoteId, mode]);

  useEffect(() => {
    if (orderedNotes.length > 0 && mode === 'view') {
      const exists = orderedNotes.some((item) => item.note.id === selectedNoteId);
      if (!exists) {
        setSelectedNoteId(orderedNotes[0].note.id);
      }
    }
  }, [orderedNotes, selectedNoteId, mode]);

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
      setInspectorTab('property');
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

  const handleDelete = async (target) => {
    const noteId = typeof target === 'string' ? target : target?.id;
    if (!noteId) return;
    const targetNote = typeof target === 'object' && target ? target : notes.find((item) => item.id === noteId) || noteDetail;
    const confirmed = window.confirm(`确定要删除笔记“${targetNote?.title ?? ''}”吗？`);
    if (!confirmed) return;
    try {
      await api.deleteNote(noteId);
      const updatedList = await reloadNotes();
      if (updatedList) {
        setData(updatedList);
      }
      setSelectedNoteId(null);
      setNoteDetail(null);
      setRelatedMetrics([]);
      setMode('view');
      setInspectorTab('property');
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

  const handleNoteSelect = (note) => {
    setSelectedNoteId(note.id);
    setMode('view');
  };

  const handleCreateUnderFolder = (path, defaultTitle = '') => {
    const folderClone = path.slice();
    setDraftInitial({
      title: defaultTitle,
      folderPath: folderClone
    });
    setMode('create');
    setSelectedNoteId(null);
    setNoteDetail(null);
    setRelatedMetrics([]);
  };

  const handleInlineSave = async (payload) => {
    if (!payload?.id) return;
    const { id, ...rest } = payload;
    try {
      const updated = await api.updateNote(id, { ...rest, updatedBy: rest.owner });
      const updatedList = await reloadNotes();
      if (updatedList) {
        setData(updatedList);
      }
      setNoteDetail(updated);
      const metricsResponse = await api.getNoteRelatedMetrics(updated.id);
      setRelatedMetrics(metricsResponse);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleDuplicate = (source) => {
    const origin = source || noteDetail;
    if (!origin) return;
    const cloneInitial = {
      title: `${origin.title || '未命名笔记'}（复制）`,
      summary: origin.summary,
      body: origin.body,
      folderPath: origin.folderPath,
      owner: origin.owner,
      tags: origin.tags,
      highlights: origin.highlights
    };
    setDraftInitial(cloneInitial);
    setMode('create');
    setSelectedNoteId(null);
  };

  return (
    <div className="workspace notes-workspace">
      <aside className="note-pane-sidebar">
        <div className="note-sidebar-header">
          <h2>我的笔记</h2>
          <button
            type="button"
            className="note-sidebar-create"
            onClick={() => {
              const selected = orderedNotes.find((item) => item.note.id === selectedNoteId);
              const targetPath = selected ? selected.note.folderPath || [] : [];
              handleCreateUnderFolder(targetPath);
            }}
            aria-label="新建笔记"
          >
            +
          </button>
        </div>
        <div className="note-sidebar-search">
          <span aria-hidden="true">🔍</span>
          <input
            value={sidebarSearch}
            onChange={(event) => setSidebarSearch(event.target.value)}
            placeholder="搜索笔记..."
          />
        </div>
        <div className="note-sidebar-body">
          <nav className="note-tree">
            {filteredNotes.length > 0 ? (
              <ul>
                {filteredNotes.map(({ id, note, depth }) => {
                  const isActiveNote = selectedNoteId === note.id;
                  const paddingLeft = depth * 16 + 16;
                  return (
                    <li key={id}>
                      <div
                        role="button"
                        tabIndex={0}
                        className={`note-tree-row note${isActiveNote ? ' active' : ''}`}
                        style={{ paddingLeft: `${paddingLeft}px` }}
                        onClick={() => handleNoteSelect(note)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleNoteSelect(note);
                          }
                        }}
                        title={note.title}
                      >
                        <span className="tree-icon note" aria-hidden="true" />
                        <span className="tree-label">{note.title}</span>
                        <span
                          role="button"
                          tabIndex={-1}
                          className="tree-action add"
                          aria-label={`在${note.title}下新建子笔记`}
                          onClick={(event) => {
                            event.stopPropagation();
                            const basePath = note.folderPath || [];
                            const nestedPath = [...basePath, note.title];
                            handleCreateUnderFolder(nestedPath);
                          }}
                        >
                          +
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">暂无匹配笔记</p>
            )}
          </nav>
        </div>
        <div className="note-sidebar-footer">
          <div className="note-count">共 {notes.length} 条笔记</div>
        </div>
      </aside>

      <div className="note-main-layout">
        <section className="note-editor-column">
          {loading ? <p>加载中...</p> : null}
          {error ? <p className="error">{error.message}</p> : null}
          {mode === 'view' && !loading && orderedNotes.length === 0 ? (
            <p className="muted">暂无笔记</p>
          ) : null}

          {mode === 'create' ? (
            <div className="note-editor-surface note-editor-form">
              <header className="note-editor-form-header">
                <h2>新建笔记</h2>
              </header>
              <NoteForm
                initialValue={draftInitial}
                submitLabel="创建"
                onSubmit={handleCreate}
                onCancel={() => {
                  setMode('view');
                  if (orderedNotes.length > 0) {
                    setSelectedNoteId(orderedNotes[0].note.id);
                  }
                }}
              />
            </div>
          ) : null}

          {mode === 'edit' && noteDetail ? (
            <div className="note-editor-surface note-editor-form">
              <header className="note-editor-form-header">
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
            <div className="note-editor-surface note-inline-surface" role="article">
              <NoteDetailEditor
                note={noteDetail}
                relatedMetrics={relatedMetrics}
                onMetricNavigate={onMetricNavigate}
                onSave={handleInlineSave}
                onDuplicate={handleDuplicate}
                onDelete={(note) => handleDelete(note)}
              />
            </div>
          ) : null}

          {mode === 'view' && !noteDetail ? <p className="muted">请选择一条笔记</p> : null}
        </section>

        <aside className="note-inspector" aria-label="属性面板">
          <div className="inspector-tabs">
            <button
              type="button"
              className={inspectorTab === 'property' ? 'active' : ''}
              onClick={() => setInspectorTab('property')}
            >
              属性
            </button>
            <button
              type="button"
              className={inspectorTab === 'reference' ? 'active' : ''}
              onClick={() => setInspectorTab('reference')}
            >
              引用
            </button>
          </div>
          <div className="inspector-content">
            {inspectorTab === 'property' ? (
              noteDetail ? (
                <div className="inspector-section">
                  <div className="inspector-field">
                    <span className="label">状态</span>
                    <span className="value badge">草稿</span>
                  </div>
                  <div className="inspector-field">
                    <span className="label">Owner</span>
                    <span className="value">{noteDetail.owner || '未指定'}</span>
                  </div>
                  <div className="inspector-field">
                    <span className="label">标签</span>
                    <div className="value tag-list">
                      {noteDetail.tags?.domain ? <span className="pill">{noteDetail.tags.domain}</span> : null}
                      {noteDetail.tags?.perspective ? <span className="pill">{noteDetail.tags.perspective}</span> : null}
                      {noteDetail.tags?.time ? <span className="pill">{noteDetail.tags.time}</span> : null}
                    </div>
                  </div>
                  <div className="inspector-field">
                    <span className="label">创建时间</span>
                    <span className="value">{formatDate(noteDetail.createdAt)}</span>
                  </div>
                  <div className="inspector-field">
                    <span className="label">更新时间</span>
                    <span className="value">{formatDate(noteDetail.updatedAt)}</span>
                  </div>
                </div>
              ) : (
                <p className="muted">选择笔记以查看属性</p>
              )
            ) : null}

            {inspectorTab === 'reference' ? (
              noteDetail ? (
                <div className="inspector-section">
                  <h4>引用指标</h4>
                  {relatedMetrics.length === 0 ? (
                    <p className="muted">暂无引用</p>
                  ) : (
                    <ul className="inspector-reference-list">
                      {relatedMetrics.map((metric) => (
                        <li key={metric.id}>
                          <button type="button" onClick={() => onMetricNavigate?.(metric.id)}>
                            <span className="bullet" aria-hidden="true">▸</span>
                            <span>{metric.name}</span>
                          </button>
                          <span className="value muted">{formatDate(metric.updatedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="muted">选择笔记以查看引用</p>
              )
            ) : null}
          </div>
        </aside>
      </div>
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
