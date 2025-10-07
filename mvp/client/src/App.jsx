import { useState } from 'react';
import NotesWorkspace from './views/NotesWorkspace';
import MetricsWorkspace from './views/MetricsWorkspace';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('notes');
  const [selectedMetricId, setSelectedMetricId] = useState(null);

  const handleMetricNavigate = (metricId) => {
    if (!metricId) return;
    setSelectedMetricId(metricId);
    setActiveTab('metrics');
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
            onClick={() => setActiveTab('notes')}
          >
            笔记工作区
          </button>
          <button
            type="button"
            className={activeTab === 'metrics' ? 'active' : ''}
            onClick={() => setActiveTab('metrics')}
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
