import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { api } from '../../api/client';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

turndownService.addRule('metricToken', {
  filter: (node) => node.nodeName === 'A' && node.getAttribute('data-metric-token'),
  replacement: (_content, node) => `[[${node.getAttribute('data-metric-token') || node.textContent}]]`
});

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderMetricTokens = (html) =>
  html.replace(/\[\[([^\]]+)\]\]/g, (_match, name) =>
    `<a class=\"metric-token-link\" data-metric-token=\"${escapeHtml(name)}\" href=\"#\">${escapeHtml(name)}</a>`
  );

const lowlight = createLowlight(common);

const EnhancedCodeBlock = CodeBlockLowlight.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Shift-Enter': () => this.editor.commands.exitCode(),
      'Mod-Enter': () => this.editor.commands.exitCode(),
      Escape: () => this.editor.commands.exitCode()
    };
  }
});

const TEMPLATES = [
  {
    id: 'analysis-framework',
    label: '分析框架',
    description: '背景 / 洞察 / 行动',
    content: '## 背景\n- 场景概述：\n- 数据现状：\n\n## 关键洞察\n- 洞察 1：\n- 洞察 2：\n\n## 行动建议\n- 行动 1：\n- 行动 2：\n'
  },
  {
    id: 'metric-deep-dive',
    label: '指标深潜',
    description: '指标定义 + 变化原因 + 计划',
    content: '## 指标概览\n- 指标：[[ ]]\n- 当前值：\n- 趋势：\n\n## 关键驱动因素\n1. \n2. \n\n## 计划动作\n- \n'
  },
  {
    id: 'risk-alert',
    label: '风险预警',
    description: '风险点 + 影响 + 应对',
    content: '## 风险点\n- \n\n## 影响评估\n- \n\n## 应对策略\n- \n'
  }
];

const COMMANDS = (editor, openMetricDialog, insertTemplate) => {
  const items = [
    {
      id: 'heading1',
      name: '转换为标题 1',
      shortcut: '⌘ + Alt + 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
    {
      id: 'heading2',
      name: '转换为标题 2',
      shortcut: '⌘ + Alt + 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    {
      id: 'bullet',
      name: '无序列表',
      shortcut: '⌘ + Shift + 8',
      action: () => editor.chain().focus().toggleBulletList().run()
    },
    {
      id: 'todo',
      name: '待办清单',
      action: () => editor.chain().focus().toggleTaskList().run()
    },
    {
      id: 'quote',
      name: '引用块',
      action: () => editor.chain().focus().toggleBlockquote().run()
    },
    {
      id: 'code',
      name: '代码块',
      action: () => editor.chain().focus().toggleCodeBlock().run()
    },
    {
      id: 'metric',
      name: '插入指标引用',
      action: openMetricDialog
    },
    ...TEMPLATES.map((template) => ({
      id: `template-${template.id}`,
      name: `插入模板：${template.label}`,
      action: () => insertTemplate(template)
    }))
  ];

  if (editor.isActive('codeBlock')) {
    const metricIndex = items.findIndex((item) => item.id === 'metric');
    const insertIndex = metricIndex === -1 ? items.length : metricIndex;
    items.splice(insertIndex, 0, {
      id: 'exit-code',
      name: '退出代码块 (Shift+Enter)',
      action: () => editor.chain().focus().exitCode().run()
    });
  }

  return items;
};

const markdownToHtml = (markdown) => {
  if (!markdown) return '';
  const raw = marked.parse(markdown);
  return renderMetricTokens(raw);
};

const htmlToMarkdown = (html) => {
  if (!html) return '';
  return turndownService.turndown(html);
};

const collectOutline = (doc) => {
  const outline = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      outline.push({
        level: node.attrs.level,
        text: node.textContent,
        pos
      });
    }
  });
  return outline;
};

function ToolbarButton({ isActive, disabled, icon, label, onClick }) {
  return (
    <button
      type="button"
      className={`composer-toolbar-button${isActive ? ' active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon || label}
    </button>
  );
}

ToolbarButton.propTypes = {
  isActive: PropTypes.bool,
  disabled: PropTypes.bool,
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired
};

ToolbarButton.defaultProps = {
  isActive: false,
  disabled: false,
  icon: null
};

function MetricDialog({ open, metrics, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  if (!open) return null;

  const keyword = query.trim().toLowerCase();
  const filtered = metrics
    .filter((item) => !keyword || item.name.toLowerCase().includes(keyword) || (item.aliases || []).some((alias) => alias.toLowerCase().includes(keyword)))
    .slice(0, 30);

  return (
    <div className="metric-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="metric-dialog">
        <header>
          <h3>插入指标引用</h3>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="metric-dialog-search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索指标名称或别名"
            autoFocus
          />
        </div>
        <ul>
          {filtered.map((metric) => (
            <li key={metric.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(metric);
                  onClose();
                }}
              >
                <span className="metric-title">{metric.name}</span>
                {metric.aliases?.length ? (
                  <span className="metric-aliases">别名：{metric.aliases.join('、')}</span>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="empty">暂无匹配指标</li> : null}
        </ul>
      </div>
    </div>
  );
}

MetricDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      aliases: PropTypes.arrayOf(PropTypes.string)
    })
  ),
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

MetricDialog.defaultProps = {
  metrics: []
};

function CommandPalette({ open, commands, onClose }) {
  const [query, setQuery] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = listRef.current?.querySelector('li button');
        if (first) {
          first.click();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const keyword = query.trim().toLowerCase();
  const filtered = commands.filter((command) => command.name.toLowerCase().includes(keyword));

  return (
    <div className="command-palette" role="dialog" aria-modal="true">
      <div className="command-panel">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索命令或模板"
          autoFocus
        />
        <ul ref={listRef}>
          {filtered.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                onClick={() => {
                  command.action();
                  onClose();
                }}
              >
                <span>{command.name}</span>
                {command.shortcut ? <span className="shortcut">{command.shortcut}</span> : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="empty">暂无命令</li> : null}
        </ul>
      </div>
    </div>
  );
}

CommandPalette.propTypes = {
  open: PropTypes.bool.isRequired,
  commands: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      shortcut: PropTypes.string,
      action: PropTypes.func.isRequired
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired
};

function TemplateChips({ editor, onInsert }) {
  if (!editor) return null;
  return (
    <div className="template-chip-row">
      {TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onInsert(template)}
        >
          <span>{template.label}</span>
          <small>{template.description}</small>
        </button>
      ))}
    </div>
  );
}

TemplateChips.propTypes = {
  editor: PropTypes.object,
  onInsert: PropTypes.func.isRequired
};

TemplateChips.defaultProps = {
  editor: null
};

function OutlinePanel({ outline, onNavigate }) {
  if (!outline || outline.length === 0) {
    return (
      <div className="composer-outline">
        <p className="muted">无标题结构</p>
      </div>
    );
  }
  return (
    <div className="composer-outline" aria-label="大纲">
      <span className="outline-title">大纲</span>
      <ul>
        {outline.map((item, index) => (
          <li key={`${item.text}-${index}`} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
            <button type="button" onClick={() => onNavigate(item.pos)}>
              {item.text || '未命名段落'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

OutlinePanel.propTypes = {
  outline: PropTypes.arrayOf(
    PropTypes.shape({
      level: PropTypes.number.isRequired,
      text: PropTypes.string,
      pos: PropTypes.number.isRequired
    })
  ),
  onNavigate: PropTypes.func.isRequired
};

OutlinePanel.defaultProps = {
  outline: []
};

function NoteComposer({ value, onChange, relatedMetrics, onMetricNavigate }) {
  const lastMarkdown = useRef(value || '');
  const [outline, setOutline] = useState([]);
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [isMetricDialogOpen, setMetricDialogOpen] = useState(false);
  const [metrics, setMetrics] = useState([]);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await api.listMetrics();
      setMetrics(response || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!isMetricDialogOpen || metrics.length > 0) return;
    fetchMetrics();
  }, [isMetricDialogOpen, metrics.length, fetchMetrics]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: false,
        codeBlock: false
      }),
      Placeholder.configure({
        placeholder: '输入正文，使用 / 快速插入模块，[[ 引用指标'
      }),
      EnhancedCodeBlock.configure({
        lowlight,
        defaultLanguage: 'plaintext',
        HTMLAttributes: {
          class: 'code-block'
        }
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      Highlight,
      HorizontalRule
    ],
    content: markdownToHtml(value || ''),
    autofocus: false,
    onUpdate({ editor: instance }) {
      const html = instance.getHTML();
      const markdown = htmlToMarkdown(html);
      lastMarkdown.current = markdown;
      onChange(markdown);
      const outlineNodes = collectOutline(instance.state.doc);
      setOutline(outlineNodes);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor'
      }
    }
  });

  useEffect(() => {
    if (!editor || !onMetricNavigate) return undefined;
    const dom = editor.view.dom;
    const handler = (event) => {
      const target = event.target.closest('a.metric-token-link');
      if (!target) return;
      const metricName = target.getAttribute('data-metric-token');
      if (!metricName) return;
      event.preventDefault();
      const metric = (relatedMetrics || []).find((item) => item?.name === metricName) || (metrics || []).find((item) => item?.name === metricName);
      onMetricNavigate(metric?.id || metricName);
    };
    dom.addEventListener('click', handler);
    return () => dom.removeEventListener('click', handler);
  }, [editor, onMetricNavigate, relatedMetrics, metrics]);

  useEffect(() => {
    if (!editor) return;
    const outlineNodes = collectOutline(editor.state.doc);
    setOutline(outlineNodes);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastMarkdown.current) return;
    const html = markdownToHtml(value || '');
    editor.commands.setContent(html, false);
    lastMarkdown.current = value || '';
    const outlineNodes = collectOutline(editor.state.doc);
    setOutline(outlineNodes);
  }, [value, editor]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const insertTemplate = (template) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`\n${template.content}`).run();
  };

  const commands = useMemo(() => {
    if (!editor) return [];
    return COMMANDS(editor, () => setMetricDialogOpen(true), insertTemplate);
  }, [editor, insertTemplate]);

  const insertMetricReference = (metric) => {
    if (!editor) return;
    const html = renderMetricTokens(`[[${metric.name}]]`);
    editor.chain().focus().insertContent(html).run();
  };

  const navigateToPos = (pos) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
  };

  if (!editor) {
    return <div className="composer-loading">加载编辑器...</div>;
  }

  return (
    <div className="composer-shell">
      <div className="composer-main">
        <div className="composer-toolbar">
          <ToolbarButton
            label="粗体"
            icon={<strong>B</strong>}
            isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="斜体"
            icon={<em>I</em>}
            isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="下划线"
            icon={<span className="toolbar-underline">U</span>}
            isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            label="标题 1"
            icon="H1"
            isActive={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            label="标题 2"
            icon="H2"
            isActive={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="列表"
            icon="•"
            isActive={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="编号"
            icon="1."
            isActive={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="待办"
            icon="☑"
            isActive={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          />
          <ToolbarButton
            label="引用"
            icon="❝"
            isActive={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            label="代码"
            icon="</>"
            isActive={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          {editor.isActive('codeBlock') ? (
            <ToolbarButton
              label="退出代码块 (Shift+Enter)"
              icon="⎋"
              onClick={() => editor.chain().focus().exitCode().run()}
            />
          ) : null}
          <ToolbarButton
            label="分割线"
            icon="―"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <div className="toolbar-divider" />
          <ToolbarButton
            label="命令菜单 (⌘+K)"
            icon="⌘K"
            onClick={() => setPaletteOpen(true)}
          />
          <ToolbarButton
            label="指标引用"
            icon="[[ ]]"
            onClick={() => {
              if (metrics.length === 0) {
                fetchMetrics();
              }
              setMetricDialogOpen(true);
            }}
          />
        </div>

        <TemplateChips editor={editor} onInsert={insertTemplate} />

        <div className="composer-editor-surface">
          <EditorContent editor={editor} />
        </div>
      </div>

      <OutlinePanel outline={outline} onNavigate={navigateToPos} />

      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      <MetricDialog
        open={isMetricDialogOpen}
        metrics={metrics}
        onSelect={insertMetricReference}
        onClose={() => setMetricDialogOpen(false)}
      />
    </div>
  );
}

NoteComposer.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  relatedMetrics: PropTypes.array,
  onMetricNavigate: PropTypes.func
};

NoteComposer.defaultProps = {
  value: '',
  onChange: () => {},
  relatedMetrics: [],
  onMetricNavigate: () => {}
};

export default NoteComposer;
