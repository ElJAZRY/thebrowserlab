import { Tag } from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { useAnnotationStore } from '../../../store/annotationStore';
import { toggleVisualizationsVisibility } from '../../../utils/annotation/visualization';
import { cn } from '../../../utils/cn';

export function AnnotationButton() {
  const [showAnnotations, setShowAnnotations] = useState(true);
  const selectedObject = useEditorStore((state) => state.selectedObject);
  const { annotationClasses, objectAnnotations, setObjectAnnotation } = useAnnotationStore();
  
  const handleToggleVisibility = () => {
    const newState = !showAnnotations;
    setShowAnnotations(newState);
    toggleVisualizationsVisibility(newState);
  };
  
  const getCurrentAnnotation = () => {
    if (!selectedObject) return null;
    return objectAnnotations[selectedObject.uuid];
  };
  
  const getCurrentClass = () => {
    const annotation = getCurrentAnnotation();
    if (!annotation) return null;
    return annotationClasses.find(c => c.id === annotation.classId);
  };
  
  const currentClass = getCurrentClass();
  
  return (
    <button
      onClick={handleToggleVisibility}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-colors",
        showAnnotations 
          ? "bg-blue-500/20 text-blue-300" 
          : "text-gray-300 hover:bg-gray-700/50"
      )}
      title={showAnnotations ? "Hide Annotations" : "Show Annotations"}
    >
      <Tag className="w-4 h-4" />
      <span>Annotations</span>
      {currentClass && (
        <div 
          className="w-2 h-2 rounded-full ml-1" 
          style={{ backgroundColor: currentClass.color }}
        />
      )}
    </button>
  );
}