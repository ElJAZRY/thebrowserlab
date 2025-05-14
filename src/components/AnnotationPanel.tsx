import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { cn } from '../utils/cn';
import { 
  Tag, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronRight, 
  Download, Upload, Check, Copy, FileJson
} from 'lucide-react';
import { useAnnotationStore } from '../store/annotationStore';
import { AnnotationClass } from '../types/annotation';
import { exportAnnotations } from '../utils/annotation/export';
import { importAnnotations } from '../utils/annotation/import';

export function AnnotationPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'classes' | 'objects'>('classes');
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassColor, setNewClassColor] = useState('#3b82f6');
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [fileInputRef] = useState<React.RefObject<HTMLInputElement>>(React.createRef());
  
  const selectedObject = useEditorStore((state) => state.selectedObject);
  const objects = useEditorStore((state) => state.objects);
  const getObjectName = useEditorStore((state) => state.getObjectName);
  
  const { 
    annotationClasses, 
    objectAnnotations, 
    addAnnotationClass, 
    updateAnnotationClass,
    removeAnnotationClass,
    setObjectAnnotation,
    removeObjectAnnotation
  } = useAnnotationStore();

  // Handle file import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          importAnnotations(jsonData, objects);
        } catch (error) {
          console.error('Error importing annotations:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  // Handle file export
  const handleExport = () => {
    const annotationData = exportAnnotations(objects);
    const dataStr = JSON.stringify(annotationData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'annotations.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Handle adding a new class
  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    
    addAnnotationClass({
      id: crypto.randomUUID(),
      name: newClassName.trim(),
      color: newClassColor
    });
    
    setNewClassName('');
    setNewClassColor('#3b82f6');
    setIsAddingClass(false);
  };

  // Handle updating a class
  const handleUpdateClass = (id: string) => {
    if (!newClassName.trim()) return;
    
    updateAnnotationClass(id, {
      name: newClassName.trim(),
      color: newClassColor
    });
    
    setEditingClass(null);
    setNewClassName('');
    setNewClassColor('#3b82f6');
  };

  // Handle editing a class
  const handleEditClass = (classItem: AnnotationClass) => {
    setEditingClass(classItem.id);
    setNewClassName(classItem.name);
    setNewClassColor(classItem.color);
  };

  // Handle assigning a class to an object
  const handleAssignClass = (classId: string) => {
    if (!selectedObject) return;
    
    setObjectAnnotation(selectedObject.uuid, classId);
  };

  // Get the current annotation for the selected object
  const getCurrentAnnotation = () => {
    if (!selectedObject) return null;
    return objectAnnotations[selectedObject.uuid];
  };

  // Get the class for the current annotation
  const getCurrentClass = () => {
    const annotation = getCurrentAnnotation();
    if (!annotation) return null;
    return annotationClasses.find(c => c.id === annotation.classId);
  };

  return (
    <div className={cn(
      "absolute right-3 top-20 bg-[#252526]/90 backdrop-blur-sm rounded-lg",
      "border border-gray-700/50 text-xs transition-all duration-200 z-40",
      isExpanded ? "w-[280px]" : "w-[40px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 hover:bg-gray-700/50 rounded text-gray-400"
        >
          <Tag className="w-4 h-4" />
        </button>
        {isExpanded && (
          <>
            <h3 className="text-sm font-medium text-gray-300">Annotations</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Import Annotations"
                className="p-1.5 hover:bg-gray-700/50 rounded text-gray-400"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleExport}
                title="Export Annotations"
                className="p-1.5 hover:bg-gray-700/50 rounded text-gray-400"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3">
          {/* Tabs */}
          <div className="flex border-b border-gray-700/50 mb-3">
            <button
              onClick={() => setActiveTab('classes')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === 'classes'
                  ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              Classes
            </button>
            <button
              onClick={() => setActiveTab('objects')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === 'objects'
                  ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              Labeled Objects
            </button>
          </div>

          {/* Classes Tab */}
          {activeTab === 'classes' && (
            <div className="space-y-3">
              {/* Class List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {annotationClasses.map((classItem) => (
                  <div 
                    key={classItem.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded",
                      "bg-gray-800/50 border border-gray-700/50",
                      "hover:border-gray-600/50 transition-colors"
                    )}
                  >
                    {editingClass === classItem.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="color"
                          value={newClassColor}
                          onChange={(e) => setNewClassColor(e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          className="flex-1 bg-gray-700/50 border border-gray-600/50 rounded px-2 py-1 text-xs text-gray-200"
                          autoFocus
                        />
                        <div className="flex items-center">
                          <button
                            onClick={() => handleUpdateClass(classItem.id)}
                            className="p-1 hover:bg-gray-700/50 rounded text-green-400"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingClass(null)}
                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3.5 h-3.5 rounded-full" 
                            style={{ backgroundColor: classItem.color }}
                          />
                          <span className="text-gray-300">{classItem.name}</span>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => handleAssignClass(classItem.id)}
                            className={cn(
                              "p-1 rounded",
                              selectedObject 
                                ? "hover:bg-blue-500/20 text-blue-400" 
                                : "text-gray-600 cursor-not-allowed"
                            )}
                            disabled={!selectedObject}
                            title={selectedObject ? "Assign to selected object" : "Select an object first"}
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditClass(classItem)}
                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeAnnotationClass(classItem.id)}
                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {annotationClasses.length === 0 && !isAddingClass && (
                  <div className="text-center py-4 text-gray-500">
                    No annotation classes defined
                  </div>
                )}
              </div>

              {/* Add Class Form */}
              {isAddingClass ? (
                <div className="flex items-center gap-2 p-2 bg-gray-800/50 border border-gray-700/50 rounded">
                  <input
                    type="color"
                    value={newClassColor}
                    onChange={(e) => setNewClassColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Class name"
                    className="flex-1 bg-gray-700/50 border border-gray-600/50 rounded px-2 py-1 text-xs text-gray-200"
                    autoFocus
                  />
                  <div className="flex items-center">
                    <button
                      onClick={handleAddClass}
                      className="p-1 hover:bg-gray-700/50 rounded text-green-400"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsAddingClass(false)}
                      className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingClass(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md text-xs text-blue-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class</span>
                </button>
              )}
            </div>
          )}

          {/* Objects Tab */}
          {activeTab === 'objects' && (
            <div className="space-y-3">
              {/* Current Selection */}
              <div className="p-2 bg-gray-800/50 border border-gray-700/50 rounded">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Selected Object</h4>
                {selectedObject ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">{getObjectName(selectedObject)}</span>
                    {getCurrentClass() ? (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: getCurrentClass()?.color }}
                        />
                        <span className="text-gray-300">{getCurrentClass()?.name}</span>
                        <button
                          onClick={() => removeObjectAnnotation(selectedObject.uuid)}
                          className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                          title="Remove annotation"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">No annotation</span>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No object selected</div>
                )}
              </div>

              {/* Annotated Objects List */}
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Annotated Objects</h4>
                
                {Object.keys(objectAnnotations).length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No annotated objects
                  </div>
                ) : (
                  Object.entries(objectAnnotations).map(([objectId, annotation]) => {
                    const object = objects.find(obj => obj.uuid === objectId);
                    if (!object) return null;
                    
                    const classItem = annotationClasses.find(c => c.id === annotation.classId);
                    if (!classItem) return null;
                    
                    return (
                      <div 
                        key={objectId}
                        className={cn(
                          "flex items-center justify-between p-2 rounded",
                          "bg-gray-800/50 border border-gray-700/50",
                          "hover:border-gray-600/50 transition-colors"
                        )}
                      >
                        <span className="text-gray-300">{getObjectName(object)}</span>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: classItem.color }}
                          />
                          <span className="text-gray-300">{classItem.name}</span>
                          <button
                            onClick={() => removeObjectAnnotation(objectId)}
                            className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                            title="Remove annotation"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Export Options */}
              <div className="pt-2 border-t border-gray-700/50">
                <button
                  onClick={handleExport}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md text-xs text-blue-300 transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Export Annotations</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}