import { useCallback, useEffect, useMemo, useState } from 'react';
import NotesWorkspace from './views/NotesWorkspace';
import MetricsWorkspace from './views/MetricsWorkspace';
import './App.css';

function resolveRoutingState() {
  if (typeof window === 'undefined') {
    return { tab: 'notes', metric: null };
  }
  const { hash, pathname } = window.location;
  let tab = 'notes';
  let metric = null;

  if (hash) {
    const fragment = hash.replace(/^#/, '');
    const params = new URLSearchParams(fragment);
    const tabParam = params.get('tab');
    const metricParam = params.get('metric');
    if (tabParam === 'metrics') {
      tab = 'metrics';
    }
    if (metricParam) {
      metric = metricParam;
    }
  }

  if (pathname.startsWith('/metrics')) {
    tab = 'metrics';
    const rest = pathname.replace('/metrics', '').replace(/^\/+/, '');
    if (rest) {
      const [metricSlug] = rest.split('/');
      metric = decodeURIComponent(metricSlug);
    }
  }

  return {
    tab,
    metric
  };
}

function commitRoutingState(tab, metricId, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  params.set('tab', tab === 'metrics' ? 'metrics' : 'notes');
  if (tab === 'metrics' && metricId) {
    params.set('metric', metricId);
  }
  const fragment = `#${params.toString()}`;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', fragment);
}

function App() {
  const initialRouting = useMemo(() => resolveRoutingState(), []);
  const [activeTab, setActiveTab] = useState(initialRouting.tab);
  const [selectedMetricId, setSelectedMetricId] = useState(initialRouting.metric);

  useEffect(() => {
    commitRoutingState(initialRouting.tab, initialRouting.metric, { replace: true });
  }, [initialRouting.tab, initialRouting.metric]);

  useEffect(() => {
    const handleRouteChange = () => {
      const next = resolveRoutingState();
      setActiveTab(next.tab);
      setSelectedMetricId(next.metric);
    };
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const goToNotes = useCallback(() => {
    setActiveTab('notes');
    setSelectedMetricId(null);
    commitRoutingState('notes', null);
  }, []);

  const goToMetrics = useCallback((metricId = selectedMetricId) => {
    setActiveTab('metrics');
    setSelectedMetricId(metricId || null);
    commitRoutingState('metrics', metricId || null);
  }, [selectedMetricId]);

  const handleMetricNavigate = (metricId) => {
    const targetId = metricId || null;
    const current = resolveRoutingState();
    setActiveTab('metrics');
    setSelectedMetricId(targetId);
    const shouldReplace = current.tab === 'metrics' && current.metric === targetId;
    commitRoutingState('metrics', targetId, { replace: shouldReplace });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>经营分析工作台 MVP</h1>
          <p className="app-subtitle">笔记与指标字典的统一协作平台</p>
        </div>
        <nav className="app-nav">
          <button
            type="button"
            className={activeTab === 'notes' ? 'active' : ''}
            onClick={goToNotes}
          >
            笔记工作区
          </button>
          <button
            type="button"
            className={activeTab === 'metrics' ? 'active' : ''}
            onClick={() => goToMetrics()}
          >
            指标字典
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'notes' ? (
          <NotesWorkspace onMetricNavigate={handleMetricNavigate} />
        ) : (
          <MetricsWorkspace
            initialMetricId={selectedMetricId}
            onMetricNavigate={handleMetricNavigate}
          />
        )}
      </main>
    </div>
  );
}

export default App;
