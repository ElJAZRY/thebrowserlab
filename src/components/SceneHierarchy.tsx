import { Code2, Bug, HelpCircle, RotateCcw, Tag } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useTimelineStore } from '../store/timelineStore';
import { HierarchyItem } from './SceneHierarchy/HierarchyItem';
import { filterTopLevelObjects } from '../utils/hierarchy';
import { cn } from '../utils/cn';
import { useState } from 'react';
import { InfoModal } from './InfoModal';
import { SceneDebugDialog } from './SceneDebugDialog';
import { CodePanel } from './CodePanel'; 
import { useAnnotationStore } from '../store/annotationStore';

export default function SceneHierarchy() {
  const objects = useEditorStore((state) => state.objects);
  const objectParents = useEditorStore((state) => state.objectParents);
  const removeObject = useEditorStore((state) => state.removeObject);
  const currentTime = useTimelineStore((state) => state.currentTime);
  const isPlaying = useTimelineStore((state) => state.isPlaying);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const objectAnnotations = useAnnotationStore((state) => state.objectAnnotations);

  // Filter objects without sorting
  const topLevelObjects = filterTopLevelObjects(objects, objectParents);

  // Check if any objects have physics enabled
  const hasPhysicsObjects = objects.some(obj => obj && obj.userData && obj.userData.physicsEnabled);
  
  // Count annotated objects
  const annotatedCount = Object.keys(objectAnnotations).length;

  return (
    <div className="w-64 bg-[#252526] border-r border-[#1e1e1e] text-gray-200 z-20 flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-700/50">
        <h2 className="text-sm font-medium text-gray-300">Scene Hierarchy</h2>
        {annotatedCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded text-xs text-blue-300">
            <Tag className="w-3 h-3" />
            <span>{annotatedCount}</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {topLevelObjects.map((object, index) => (
          object && (
          <HierarchyItem
            key={index}
            object={object}
            index={index}
            onDelete={() => removeObject(object)}
          />
          )
        ))}
        {topLevelObjects.length === 0 && (
          <p className="text-sm text-gray-500 px-3 py-2">
            No objects in scene
          </p>
        )}
      </div>
      
      {hasPhysicsObjects && !isPlaying && currentTime > 0 && (
        <div className="px-3 pb-2">
          <div className="bg-blue-500/10 text-blue-200 px-3 py-2 rounded-md text-xs flex items-center gap-2 border border-blue-500/20">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Press restart to reset physics simulation</span>
          </div>
        </div>
      )}
      
      <div className="mt-auto p-3 border-t border-gray-700/50">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowCodePanel(true)}
            className={cn(
              "flex items-center justify-center p-2.5 rounded-md transition-colors",
              "bg-blue-500/20 hover:bg-blue-500/30",
              "text-blue-300 hover:text-blue-200",
              "border border-blue-500/20"
            )}
            title="Code Editor"
          >
            <Code2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDebugDialog(true)}
            className={cn(
              "flex items-center justify-center p-2.5 rounded-md transition-colors",
              "bg-blue-500/20 hover:bg-blue-500/30",
              "text-blue-300 hover:text-blue-200",
              "border border-blue-500/20"
            )}
            title="Scene Debug"
          >
            <Bug className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowInfoModal(true)}
            className={cn(
              "flex items-center justify-center p-2.5 rounded-md transition-colors",
              "bg-blue-500/20 hover:bg-blue-500/30",
              "text-blue-300 hover:text-blue-200",
              "border border-blue-500/20"
            )}
            title="Editor Controls"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
      <SceneDebugDialog isOpen={showDebugDialog} onClose={() => setShowDebugDialog(false)} />
      {showCodePanel && <CodePanel onClose={() => setShowCodePanel(false)} />}
    </div>
  );
}