import React from 'react';
import Viewport from './components/Viewport';
import Toolbar from './components/Toolbar/index';
import PropertiesPanel from './components/PropertiesPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import SceneHierarchy from './components/SceneHierarchy';
import Timeline from './components/Timeline';
import { useEffect } from 'react';
import { useEditorStore } from './store/editorStore';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { CodePanel } from './components/CodePanel';
import { AnnotationPanel } from './components/AnnotationPanel';
import { SyntheticDataPanel } from './components/SyntheticDataPanel';

function App() {
  useKeyboardControls();
  const hasSavedScene = useEditorStore((state) => state.hasSavedScene);
  const loadScene = useEditorStore((state) => state.loadScene);
  const hasInitialized = useEditorStore((state) => state.hasInitialized);
  const [showSyntheticDataPanel, setShowSyntheticDataPanel] = React.useState(false);

  // Auto-load saved scene on startup
  useEffect(() => {
    if (hasSavedScene() && !hasInitialized) {
      // Add a small delay to ensure stores are fully initialized
      const timer = setTimeout(() => {
        loadScene();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasSavedScene, loadScene, hasInitialized]);

  return (
    <ErrorBoundary>
    <div className="h-screen w-screen flex bg-[#1e1e1e] overflow-hidden relative">
      <div className="hidden md:block">
        <SceneHierarchy />
      </div>
      <div className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        <div className="hidden md:block">
          <Toolbar />
        </div>
        <Viewport />
        <div className="hidden md:block">
          <Timeline />
        </div>
      </div>
      <div className="hidden md:block">
        <PropertiesPanel />
      </div>
      <AnnotationPanel />
      {showSyntheticDataPanel && (
        <SyntheticDataPanel />
      )}
      
      {/* Toggle button for Synthetic Data Panel */}
      <button
        onClick={() => setShowSyntheticDataPanel(!showSyntheticDataPanel)}
        className="absolute bottom-20 right-3 z-50 flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-md border border-blue-500/20"
      >
        <Cpu className="w-4 h-4" />
        <span className="text-xs font-medium">
          {showSyntheticDataPanel ? 'Hide Synthetic Data' : 'Synthetic Data'}
        </span>
      </button>
    </div>
    </ErrorBoundary>
  );
}

export default App;