const { v4: uuid } = require('uuid');

const notes = [];
const noteRevisions = new Map();
const metrics = [];
const metricVersions = new Map(); // metricId -> [versions]
const metricChangeLogs = new Map(); // metricId -> [log entries]
const metricLinkedNotes = new Map(); // metricId -> Set(noteId)

const metricNameToId = new Map();

const METRIC_TOKEN_PATTERN = /\[\[([^\]]+)\]\]/g;

function registerMetric(metric) {
  metrics.push(metric);
  metricNameToId.set(metric.name, metric.id);
  metricVersions.set(metric.id, []);
  metricChangeLogs.set(metric.id, []);
  metricLinkedNotes.set(metric.id, new Set());
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMetricNamesFromTokens(expression) {
  const names = new Set();
  if (!expression) return names;
  let match;
  METRIC_TOKEN_PATTERN.lastIndex = 0;
  while ((match = METRIC_TOKEN_PATTERN.exec(expression)) !== null) {
    const name = match[1]?.trim();
    if (name) {
      names.add(name);
    }
  }
  return names;
}

function computeDependenciesFromFormula(formula, { excludeMetricId } = {}) {
  if (!formula) return [];
  const expression = String(formula);
  if (!expression.trim()) return [];

  const matchedIds = new Set();
  const explicitNames = extractMetricNamesFromTokens(expression);

  explicitNames.forEach((name) => {
    const metricId = metricNameToId.get(name);
    if (metricId) {
      matchedIds.add(metricId);
    }
  });

  const fallbackExpression = explicitNames.size > 0 ? expression.replace(METRIC_TOKEN_PATTERN, ' ') : expression;

  const metricNames = Array.from(metricNameToId.keys()).sort((a, b) => b.length - a.length);

  metricNames.forEach((name) => {
    const metricId = metricNameToId.get(name);
    if (!metricId || matchedIds.has(metricId)) {
      return;
    }
    const pattern = new RegExp(escapeForRegex(name), 'g');
    if (pattern.test(fallbackExpression)) {
      matchedIds.add(metricId);
    }
  });

  if (excludeMetricId) {
    matchedIds.delete(excludeMetricId);
  }

  return Array.from(matchedIds);
}

function addMetricVersion(metricId, versionPayload) {
  const versionList = metricVersions.get(metricId);
  const dependenciesRaw = Array.isArray(versionPayload.dependencies) && versionPayload.dependencies.length
    ? versionPayload.dependencies
    : computeDependenciesFromFormula(versionPayload.formula, { excludeMetricId: metricId });
  const dependencies = Array.from(new Set(dependenciesRaw.filter((depId) => depId && depId !== metricId)));
  const versionRecord = {
    ...versionPayload,
    dependencies
  };
  versionList.push(versionRecord);
  const metric = metrics.find((m) => m.id === metricId);
  metric.currentVersionId = versionRecord.id;
  metric.updatedAt = versionRecord.createdAt;
}

function seedData() {
  if (metrics.length > 0) return;

  const seedMetrics = [
    {
      id: 'unit-bandwidth-cost',
      name: '单位带宽售卖成本',
      domainTags: ['网络经营'],
      categoryPath: ['经营策略', '边缘网络', '定价模型'],
      segments: ['大客户', 'CDN'],
      aliases: ['Unit Bandwidth Cost'],
      owner: '张敏',
      status: 'active',
      refreshFrequency: 'monthly',
      applicability: '用于边缘节点售卖策略、定价底线测算',
      lifecycleStage: '运营策略',
      perspective: '成本效率',
      dataOwner: '经营策略组',
      templateId: 'cost-efficiency',
      createdAt: '2024-04-15T08:00:00.000Z',
      updatedAt: '2024-05-28T09:00:00.000Z'
    },
    {
      id: 'node-reuse-rate',
      name: '节点复用率',
      domainTags: ['网络运营'],
      categoryPath: ['运营监控', '资源效率', '边缘网络'],
      segments: ['全行业'],
      aliases: ['Node Reuse Ratio'],
      owner: '李强',
      status: 'active',
      refreshFrequency: 'weekly',
      applicability: '衡量节点资源利用率，定位低效节点',
      lifecycleStage: '运营监控',
      perspective: '效率',
      dataOwner: '网络运营中心',
      templateId: 'resource-efficiency',
      createdAt: '2024-04-12T02:30:00.000Z',
      updatedAt: '2024-04-12T02:30:00.000Z'
    },
    {
      id: 'usage-unit-price',
      name: '使用单价',
      domainTags: ['采购成本'],
      categoryPath: ['成本控制', '采购指标', '带宽'],
      segments: ['供应链', '大客户'],
      aliases: ['Unit Usage Price'],
      owner: '王珂',
      status: 'active',
      refreshFrequency: 'monthly',
      applicability: '评估节点带宽采购成本，支持定价模型',
      lifecycleStage: '成本管理',
      perspective: '成本',
      dataOwner: '采购团队',
      templateId: 'cost-efficiency',
      createdAt: '2024-03-30T04:00:00.000Z',
      updatedAt: '2024-03-30T04:00:00.000Z'
    },
    {
      id: 'switch-coefficient',
      name: '交换机系数',
      domainTags: ['网络运营'],
      categoryPath: ['运营监控', '网络拓扑', '边缘网络'],
      segments: ['全行业'],
      aliases: ['Switch Coefficient'],
      owner: '李强',
      status: 'draft',
      refreshFrequency: 'monthly',
      applicability: '估算网络拓扑对节点成本的影响',
      lifecycleStage: '模型参数',
      perspective: '网络',
      dataOwner: '网络运营中心',
      templateId: 'resource-efficiency',
      createdAt: '2024-03-20T04:00:00.000Z',
      updatedAt: '2024-03-20T04:00:00.000Z'
    },
    {
      id: 'business-oversell-rate',
      name: '业务超卖率',
      domainTags: ['收入保障'],
      categoryPath: ['风险防控', '售卖策略', '边缘网络'],
      segments: ['大客户', '云服务'],
      aliases: ['Oversell Rate'],
      owner: '陈慧',
      status: 'active',
      refreshFrequency: 'daily',
      applicability: '监控带宽售卖风险，触发风控策略',
      lifecycleStage: '风险监控',
      perspective: '风险',
      dataOwner: '风险控制组',
      templateId: 'risk-monitoring',
      createdAt: '2024-03-05T08:00:00.000Z',
      updatedAt: '2024-06-05T05:00:00.000Z'
    },
    {
      id: 'edge-total-bandwidth-95',
      name: '边缘总业务日志带宽95值',
      domainTags: ['网络运营'],
      categoryPath: ['运营监控', '流量基础', '边缘网络'],
      segments: ['全行业'],
      aliases: ['Edge Total Bandwidth P95'],
      owner: '李强',
      status: 'active',
      refreshFrequency: 'daily',
      applicability: '作为多数边缘网络指标的基础数据',
      lifecycleStage: '基础数据',
      perspective: '流量',
      dataOwner: '网络运营中心',
      templateId: 'foundational-flow',
      createdAt: '2024-02-15T03:00:00.000Z',
      updatedAt: '2024-02-15T03:00:00.000Z'
    }
  ];

  seedMetrics.forEach(registerMetric);

  const now = new Date().toISOString();

  const versions = [
    {
      id: 'unit-bandwidth-cost-v1-1',
      metricId: 'unit-bandwidth-cost',
      version: '1.1',
      definition: '边缘带宽售卖的单位成本，用于定价下限与毛利测算。',
      formula: '使用单价 * (1 - 节点复用率) * 交换机系数 / 业务超卖率',
      source: '采购系统 + 日志平台',
      refreshFrequency: 'monthly',
      constraints: ['需使用95分位去噪后的客户日志数据'],
      lineageNotes: '依赖核心成本与流量指标。',
      createdBy: '张敏',
      createdAt: '2024-05-28T09:00:00.000Z'
    },
    {
      id: 'node-reuse-rate-v1-0',
      metricId: 'node-reuse-rate',
      version: '1.0',
      definition: '衡量节点带宽资源利用效率。',
      formula: '1 - sum(节点月95平均流量特殊处理) / 节点总带宽95值',
      source: '节点流量监控 → 清洗服务',
      refreshFrequency: 'weekly',
      constraints: ['剔除异常尖峰后再计算'],
      dependencies: ['edge-total-bandwidth-95'],
      lineageNotes: '依赖节点总带宽和清洗后的流量。',
      createdBy: '李强',
      createdAt: '2024-04-12T02:30:00.000Z'
    },
    {
      id: 'usage-unit-price-v1-0',
      metricId: 'usage-unit-price',
      version: '1.0',
      definition: '节点带宽的采购单位成本。',
      formula: '采购成本 / sum(节点月95平均流量特殊处理)',
      source: '采购系统',
      refreshFrequency: 'monthly',
      constraints: ['采购成本需按节点口径匹配'],
      dependencies: [],
      lineageNotes: '基础成本指标。',
      createdBy: '王珂',
      createdAt: '2024-03-30T04:00:00.000Z'
    },
    {
      id: 'switch-coefficient-v0-9',
      metricId: 'switch-coefficient',
      version: '0.9',
      definition: '节点交换机拓扑对带宽的调整系数。',
      formula: '节点总带宽95值 / 边缘总业务日志带宽95值',
      source: '网络拓扑系统',
      refreshFrequency: 'monthly',
      constraints: ['需要保持节点与边缘口径一致'],
      dependencies: ['edge-total-bandwidth-95'],
      lineageNotes: '需与边缘总量指标对齐。',
      createdBy: '李强',
      createdAt: '2024-03-20T04:00:00.000Z'
    },
    {
      id: 'business-oversell-rate-v1-2',
      metricId: 'business-oversell-rate',
      version: '1.2',
      definition: '实际售卖带宽与总可用带宽的比例，衡量风险敞口。',
      formula: 'sum(边缘业务客户日志带宽95值) / 边缘总业务日志带宽95值',
      source: '日志平台 → 数据仓库',
      refreshFrequency: 'daily',
      constraints: ['日志需按业务线对齐，隔日完成补数'],
      dependencies: ['edge-total-bandwidth-95'],
      lineageNotes: '监控超卖风险，依赖边缘总带宽数据。',
      createdBy: '陈慧',
      createdAt: '2024-06-05T05:00:00.000Z'
    },
    {
      id: 'edge-total-bandwidth-95-v0-9',
      metricId: 'edge-total-bandwidth-95',
      version: '0.9',
      definition: '边缘总体带宽的95分位值。',
      formula: '聚合所有边缘节点日志带宽的95分位值',
      source: '日志平台',
      refreshFrequency: 'daily',
      constraints: ['日志按边缘节点聚合，排除异常尖峰'],
      dependencies: [],
      lineageNotes: '基础流量指标。',
      createdBy: '李强',
      createdAt: '2024-02-15T03:00:00.000Z'
    }
  ];

  versions.forEach((version) => addMetricVersion(version.metricId, version));

  metricChangeLogs.get('unit-bandwidth-cost').push({
    id: uuid(),
    metricId: 'unit-bandwidth-cost',
    versionFrom: '1.0',
    versionTo: '1.1',
    description: '2024-05-28 调整公式说明，加入血缘依赖。',
    createdBy: '张敏',
    createdAt: '2024-05-28T09:05:00.000Z'
  });

  metricChangeLogs.get('business-oversell-rate').push({
    id: uuid(),
    metricId: 'business-oversell-rate',
    versionFrom: '1.1',
    versionTo: '1.2',
    description: '2024-06-05 加入阈值字段与提醒策略。',
    createdBy: '陈慧',
    createdAt: '2024-06-05T05:10:00.000Z'
  });

  const seedNotes = [
    {
      id: 'note-1',
      title: '边缘节点售卖策略 2024Q2',
      summary: '整理边缘带宽售卖模型，聚焦降本与定价弹性。',
      highlights: [
        {
          id: uuid(),
          text: '结合[[单位带宽售卖成本]]设定底价',
          status: 'in-progress',
          owner: '张敏',
          dueDate: '2024-06-30'
        },
        {
          id: uuid(),
          text: '通过提升[[节点复用率]]降低成本',
          status: 'todo',
          owner: '李强',
          dueDate: '2024-07-07'
        },
        {
          id: uuid(),
          text: '针对高[[业务超卖率]]客户给出折扣策略',
          status: 'todo',
          owner: '陈慧',
          dueDate: '2024-07-15'
        }
      ],
      body: '## 背景\n- Q2 边缘带宽成本压力上升。\n- 核心监测指标：[[单位带宽售卖成本]]、[[节点复用率]]、[[业务超卖率]]。\n\n## 策略动作\n1. 调整价格底线，确保毛利率>18%。\n2. 复用率低于65%时触发成本优化专项。\n3. 对超卖率>1.3的客户加入风控审批。',
      folderPath: ['经营策略', '边缘网络'],
      tags: {
        domain: '网络经营',
        perspective: '成本效率',
        time: '2024Q2'
      },
      owner: '张敏',
      linkedMetricIds: [],
      version: 1,
      createdAt: '2024-05-28T10:00:00.000Z',
      updatedAt: '2024-05-28T10:00:00.000Z'
    },
    {
      id: 'note-2',
      title: '节点复用率异常专项',
      summary: '记录 5 月第 2 周复用率跌破 60% 的调查结论。',
      highlights: [
        {
          id: uuid(),
          text: '排查采购批次（参考[[使用单价]]趋势）',
          status: 'done',
          owner: '王珂',
          dueDate: '2024-05-12'
        },
        {
          id: uuid(),
          text: '核对日志清洗造成的流量损失',
          status: 'in-progress',
          owner: '李强',
          dueDate: '2024-05-15'
        }
      ],
      body: '## 事件摘要\n- 监测到节点复用率跌破 60%。\n- 重点关联指标：[[节点复用率]]、[[使用单价]]。',
      folderPath: ['案例库', '运营事件', '边缘'],
      tags: {
        domain: '网络运营',
        perspective: '异常分析',
        time: '2024-05'
      },
      owner: '李强',
      linkedMetricIds: [],
      version: 1,
      createdAt: '2024-05-15T03:00:00.000Z',
      updatedAt: '2024-05-15T03:00:00.000Z'
    },
    {
      id: 'note-3',
      title: '超卖率预警机制设计',
      summary: '初步设计超卖率阈值与自动提醒。',
      highlights: [
        {
          id: uuid(),
          text: '基于[[业务超卖率]]构建分位阈值',
          status: 'todo',
          owner: '陈慧',
          dueDate: '2024-06-20'
        },
        {
          id: uuid(),
          text: '结合[[边缘总业务日志带宽95值]]做季节调节',
          status: 'todo',
          owner: '李强',
          dueDate: '2024-06-25'
        }
      ],
      body: '## 流程草案\n1. 监控[[业务超卖率]]，分位点 > P90 时触发提醒。\n2. 引入[[边缘总业务日志带宽95值]]进行季节系数调节。\n3. 变更记录同步到指标字典。',
      folderPath: ['洞察', '风险看板'],
      tags: {
        domain: '收入保障',
        perspective: '风险',
        time: '2024-06'
      },
      owner: '陈慧',
      linkedMetricIds: [],
      version: 1,
      createdAt: '2024-06-05T05:30:00.000Z',
      updatedAt: '2024-06-05T05:30:00.000Z'
    }
  ];

  seedNotes.forEach((note) => {
    notes.push(note);
    noteRevisions.set(note.id, [
      {
        id: uuid(),
        noteId: note.id,
        version: note.version,
        payload: { ...note },
        createdAt: note.updatedAt,
        updatedBy: note.owner
      }
    ]);
  });

  // sync metric links based on note content
  notes.forEach((note) => {
    const metricIds = extractMetricIdsFromNote(note);
    note.linkedMetricIds = metricIds;
    syncNoteMetricLinks(note.id, metricIds);
  });

  // add linked notes for metrics without references
  metricVersions.forEach((versionsList, metricId) => {
    if (!metricLinkedNotes.has(metricId)) {
      metricLinkedNotes.set(metricId, new Set());
    }
  });

  metrics.forEach((metric) => {
    if (!metricChangeLogs.has(metric.id)) {
      metricChangeLogs.set(metric.id, []);
    }
    if (!metricLinkedNotes.has(metric.id)) {
      metricLinkedNotes.set(metric.id, new Set());
    }
  });

  return now;
}

function extractMetricIdsFromNote(note) {
  const textFragments = [note.title, note.summary, note.body];
  note.highlights.forEach((highlight) => textFragments.push(highlight.text));
  const pattern = /\[\[([^\]]+)\]\]/g;
  const ids = new Set();

  textFragments.forEach((fragment) => {
    if (!fragment) return;
    let match;
    while ((match = pattern.exec(fragment)) !== null) {
      const metricName = match[1].trim();
      const metricId = metricNameToId.get(metricName);
      if (metricId) {
        ids.add(metricId);
      }
    }
  });

  return Array.from(ids);
}

function syncNoteMetricLinks(noteId, metricIds) {
  // remove existing links
  metricLinkedNotes.forEach((noteSet) => {
    if (noteSet.has(noteId)) {
      noteSet.delete(noteId);
    }
  });

  metricIds.forEach((metricId) => {
    if (!metricLinkedNotes.has(metricId)) {
      metricLinkedNotes.set(metricId, new Set());
    }
    metricLinkedNotes.get(metricId).add(noteId);
  });
}

function listNotes() {
  return notes.map((note) => ({ ...note }));
}

function getNoteById(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return null;
  const revisions = noteRevisions.get(id) || [];
  return {
    ...note,
    revisions: revisions.map((rev) => ({ ...rev, payload: { ...rev.payload } }))
  };
}

function getNoteHistory(id) {
  const revisions = noteRevisions.get(id) || [];
  return revisions.map((rev) => ({ ...rev, payload: { ...rev.payload } }));
}

function getMetricsForNote(noteId) {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return [];
  return note.linkedMetricIds
    .map((metricId) => {
      const metric = metrics.find((m) => m.id === metricId);
      if (!metric) return null;
      const currentVersion = (metricVersions.get(metricId) || []).find(
        (version) => version.id === metric.currentVersionId
      );
      return {
        id: metric.id,
        name: metric.name,
        owner: metric.owner,
        refreshFrequency: metric.refreshFrequency,
        status: metric.status,
        currentVersion: currentVersion ? currentVersion.version : null,
        updatedAt: metric.updatedAt
      };
    })
    .filter(Boolean);
}

function createNote(payload) {
  const id = payload.id || uuid();
  const creationTime = new Date().toISOString();
  const note = {
    id,
    title: payload.title,
    summary: payload.summary || '',
    highlights: Array.isArray(payload.highlights) ? payload.highlights : [],
    body: payload.body || '',
    folderPath: Array.isArray(payload.folderPath) ? payload.folderPath : [],
    tags: payload.tags || {},
    owner: payload.owner || '未指定',
    linkedMetricIds: [],
    version: 1,
    createdAt: creationTime,
    updatedAt: creationTime
  };

  const metricIds = extractMetricIdsFromNote(note);
  note.linkedMetricIds = metricIds;
  notes.push(note);
  noteRevisions.set(id, [
    {
      id: uuid(),
      noteId: id,
      version: 1,
      payload: { ...note },
      createdAt: creationTime,
      updatedBy: payload.updatedBy || note.owner
    }
  ]);
  syncNoteMetricLinks(id, metricIds);
  return { ...note };
}

function updateNote(id, payload) {
  const note = notes.find((n) => n.id === id);
  if (!note) return null;
  const previousVersion = note.version;
  note.title = payload.title ?? note.title;
  note.summary = payload.summary ?? note.summary;
  note.highlights = Array.isArray(payload.highlights) ? payload.highlights : note.highlights;
  note.body = payload.body ?? note.body;
  note.folderPath = Array.isArray(payload.folderPath) ? payload.folderPath : note.folderPath;
  note.tags = payload.tags ?? note.tags;
  note.owner = payload.owner ?? note.owner;
  note.version = previousVersion + 1;
  note.updatedAt = new Date().toISOString();

  const metricIds = extractMetricIdsFromNote(note);
  note.linkedMetricIds = metricIds;
  syncNoteMetricLinks(id, metricIds);

  const revisionEntry = {
    id: uuid(),
    noteId: id,
    version: note.version,
    payload: { ...note },
    createdAt: note.updatedAt,
    updatedBy: payload.updatedBy || note.owner
  };

  if (!noteRevisions.has(id)) {
    noteRevisions.set(id, []);
  }
  noteRevisions.get(id).push(revisionEntry);

  return { ...note };
}

function deleteNote(id) {
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) return false;

  const noteId = notes[index].id;
  notes.splice(index, 1);
  noteRevisions.delete(noteId);

  metricLinkedNotes.forEach((noteSet) => {
    if (noteSet.has(noteId)) {
      noteSet.delete(noteId);
    }
  });

  return true;
}

function listMetrics({ query } = {}) {
  const keyword = query ? query.trim().toLowerCase() : '';
  return metrics
    .filter((metric) => {
      if (!keyword) return true;
      const haystack = [
        metric.name,
        metric.owner,
        metric.status,
        metric.refreshFrequency,
        metric.perspective,
        metric.lifecycleStage,
        metric.dataOwner,
        metric.applicability,
        metric.templateId,
        ...(metric.domainTags || []),
        ...(metric.categoryPath || []),
        ...(metric.segments || []),
        ...(metric.aliases || [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    })
    .map((metric) => ({ ...metric }));
}

function getMetricById(id) {
  const metric = metrics.find((m) => m.id === id);
  if (!metric) return null;
  const versions = metricVersions.get(id) || [];
  const changeLogs = metricChangeLogs.get(id) || [];
  const linkedNotesSet = metricLinkedNotes.get(id) || new Set();
  return {
    ...metric,
    versions: versions.map((version) => ({ ...version })),
    changeLogs: changeLogs.map((log) => ({ ...log })),
    linkedNotes: listNotes()
      .filter((note) => linkedNotesSet.has(note.id))
      .map((note) => ({ id: note.id, title: note.title, summary: note.summary, updatedAt: note.updatedAt }))
  };
}

function createMetric(payload) {
  const id = payload.id || uuid();
  const creationTime = new Date().toISOString();
  const metric = {
    id,
    name: payload.name,
    domainTags: payload.domainTags || [],
    owner: payload.owner || '未指定',
    status: payload.status || 'draft',
    refreshFrequency: payload.refreshFrequency || 'unknown',
    categoryPath: Array.isArray(payload.categoryPath) ? payload.categoryPath.filter(Boolean) : [],
    segments: Array.isArray(payload.segments) ? payload.segments.filter(Boolean) : [],
    aliases: Array.isArray(payload.aliases) ? payload.aliases.filter(Boolean) : [],
    applicability: payload.applicability || '',
    lifecycleStage: payload.lifecycleStage || '',
    perspective: payload.perspective || '',
    dataOwner: payload.dataOwner || '',
    templateId: payload.templateId || '',
    createdAt: creationTime,
    updatedAt: creationTime,
    currentVersionId: null
  };

  registerMetric(metric);
  metricNameToId.set(metric.name, metric.id);

  if (payload.version) {
    publishMetricVersion(id, {
      version: payload.version,
      definition: payload.definition,
      formula: payload.formula,
      source: payload.source,
      refreshFrequency: payload.refreshFrequency,
      constraints: payload.constraints || [],
      dependencies: payload.dependencies || [],
      lineageNotes: payload.lineageNotes || '',
      createdBy: payload.createdBy || metric.owner,
      owner: metric.owner,
      status: metric.status,
      domainTags: metric.domainTags,
      categoryPath: metric.categoryPath,
      segments: metric.segments,
      aliases: metric.aliases,
      applicability: metric.applicability,
      lifecycleStage: metric.lifecycleStage,
      perspective: metric.perspective,
      dataOwner: metric.dataOwner,
      templateId: metric.templateId
    });
  }

  return getMetricById(id);
}

function updateMetric(id, payload) {
  const metric = metrics.find((m) => m.id === id);
  if (!metric) return null;
  metric.name = payload.name ?? metric.name;
  metric.domainTags = payload.domainTags ?? metric.domainTags;
  metric.owner = payload.owner ?? metric.owner;
  metric.status = payload.status ?? metric.status;
  metric.refreshFrequency = payload.refreshFrequency ?? metric.refreshFrequency;
  metric.categoryPath = Array.isArray(payload.categoryPath)
    ? payload.categoryPath.filter(Boolean)
    : metric.categoryPath;
  if (Array.isArray(payload.segments)) {
    metric.segments = payload.segments.filter(Boolean);
  }
  if (Array.isArray(payload.aliases)) {
    metric.aliases = payload.aliases.filter(Boolean);
  }
  metric.applicability = payload.applicability ?? metric.applicability;
  metric.lifecycleStage = payload.lifecycleStage ?? metric.lifecycleStage;
  metric.perspective = payload.perspective ?? metric.perspective;
  metric.dataOwner = payload.dataOwner ?? metric.dataOwner;
  metric.templateId = payload.templateId ?? metric.templateId;
  metric.updatedAt = new Date().toISOString();

  if (payload.name) {
    metricNameToId.set(metric.name, metric.id);
  }

  return getMetricById(id);
}

function publishMetricVersion(metricId, versionPayload) {
  const metric = metrics.find((m) => m.id === metricId);
  if (!metric) return null;

  const normalizedOwner = typeof versionPayload.owner === 'string' ? versionPayload.owner.trim() : '';
  if (normalizedOwner) {
    metric.owner = normalizedOwner;
  }
  if (typeof versionPayload.status === 'string' && versionPayload.status.trim()) {
    metric.status = versionPayload.status.trim();
  }
  if (typeof versionPayload.refreshFrequency === 'string' && versionPayload.refreshFrequency.trim()) {
    metric.refreshFrequency = versionPayload.refreshFrequency.trim();
  }
  if (Array.isArray(versionPayload.domainTags)) {
    metric.domainTags = versionPayload.domainTags;
  }
  if (Array.isArray(versionPayload.categoryPath)) {
    metric.categoryPath = versionPayload.categoryPath.filter(Boolean);
  }
  if (Array.isArray(versionPayload.segments)) {
    metric.segments = versionPayload.segments.filter(Boolean);
  }
  if (Array.isArray(versionPayload.aliases)) {
    metric.aliases = versionPayload.aliases.filter(Boolean);
  }
  if (typeof versionPayload.applicability === 'string') {
    metric.applicability = versionPayload.applicability;
  }
  if (typeof versionPayload.lifecycleStage === 'string') {
    metric.lifecycleStage = versionPayload.lifecycleStage;
  }
  if (typeof versionPayload.perspective === 'string') {
    metric.perspective = versionPayload.perspective;
  }
  if (typeof versionPayload.dataOwner === 'string') {
    metric.dataOwner = versionPayload.dataOwner;
  }
  if (typeof versionPayload.templateId === 'string') {
    metric.templateId = versionPayload.templateId;
  }

  const dependenciesFromFormula = computeDependenciesFromFormula(versionPayload.formula, { excludeMetricId: metricId });
  const dependenciesFromPayload = Array.isArray(versionPayload.dependencies)
    ? versionPayload.dependencies.filter(Boolean)
    : [];
  const dependencies = Array.from(
    new Set([...dependenciesFromPayload, ...dependenciesFromFormula].filter((depId) => depId && depId !== metricId))
  );

  const createdByFromPayload = typeof versionPayload.createdBy === 'string' ? versionPayload.createdBy.trim() : '';
  const resolvedCreatedBy = createdByFromPayload || metric.owner || '未指定';

  const newVersion = {
    id: `${metricId}-v${versionPayload.version.replace(/\./g, '-')}-${uuid().slice(0, 5)}`,
    metricId,
    version: versionPayload.version,
    definition: versionPayload.definition,
    formula: versionPayload.formula,
    source: versionPayload.source,
    refreshFrequency: versionPayload.refreshFrequency || metric.refreshFrequency,
    constraints: versionPayload.constraints || [],
    dependencies,
    lineageNotes: versionPayload.lineageNotes || '',
    createdBy: resolvedCreatedBy,
    createdAt: new Date().toISOString(),
    templateId: metric.templateId
  };

  addMetricVersion(metricId, newVersion);

  const logs = metricChangeLogs.get(metricId) || [];
  const previousVersion = logs.length > 0 ? logs[logs.length - 1].versionTo : null;
  logs.push({
    id: uuid(),
    metricId,
    versionFrom: previousVersion,
    versionTo: newVersion.version,
    description: versionPayload.changeDescription || '版本发布',
    createdBy: resolvedCreatedBy,
    createdAt: newVersion.createdAt
  });
  metricChangeLogs.set(metricId, logs);

  return getMetricById(metricId);
}

function getMetricVersions(metricId) {
  return (metricVersions.get(metricId) || []).map((version) => ({ ...version }));
}

function getMetricLinkedNotes(metricId) {
  const linked = metricLinkedNotes.get(metricId) || new Set();
  return listNotes()
    .filter((note) => linked.has(note.id))
    .map((note) => ({ id: note.id, title: note.title, summary: note.summary, updatedAt: note.updatedAt }));
}

function searchMetrics(keyword) {
  if (!keyword) {
    return metrics.map((metric) => ({ id: metric.id, name: metric.name }));
  }
  const lower = keyword.toLowerCase();
  return metrics
    .filter((metric) => metric.name.toLowerCase().includes(lower))
    .map((metric) => ({ id: metric.id, name: metric.name }));
}

seedData();

module.exports = {
  listNotes,
  getNoteById,
  getNoteHistory,
  getMetricsForNote,
  createNote,
  updateNote,
  deleteNote,
  listMetrics,
  getMetricById,
  createMetric,
  updateMetric,
  publishMetricVersion,
  getMetricVersions,
  getMetricLinkedNotes,
  searchMetrics
};
