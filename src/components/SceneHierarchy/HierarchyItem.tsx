import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Trash2, ChevronRight, ChevronDown, Lock, Unlock, Box, Square, Lightbulb, Cylinder, Circle, Type, Tag } from 'lucide-react';
import * as THREE from 'three';
import { useEditorStore } from '../../store/editorStore';
import { useTransformLock } from '../../hooks/useTransformLock';
import { cn } from '../../utils/cn';
import { useAnnotationStore } from '../../store/annotationStore';

interface HierarchyItemProps {
  object: Object3D;
  index: number;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  depth?: number;
}

export function HierarchyItem({ 
  object, 
  index, 
  onRename, 
  onDuplicate, 
  onDelete,
  depth = 0 
}: HierarchyItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const selectedObject = useEditorStore((state) => state.selectedObject);
  const selectedObjects = useEditorStore((state) => state.selectedObjects);
  const lastSelectedObject = useEditorStore((state) => state.lastSelectedObject);
  const setSelectedObject = useEditorStore((state) => state.setSelectedObject);
  const addSelectedObject = useEditorStore((state) => state.addSelectedObject);
  const removeSelectedObject = useEditorStore((state) => state.removeSelectedObject);
  const selectObjectsInRange = useEditorStore((state) => state.selectObjectsInRange);
  const duplicateObject = useEditorStore((state) => state.duplicateObject);
  const renameObject = useEditorStore((state) => state.renameObject);
  const getObjectName = useEditorStore((state) => state.getObjectName);
  const setObjectParent = useEditorStore((state) => state.setObjectParent);
  const getObjectChildren = useEditorStore((state) => state.getObjectChildren);
  const { toggleLock } = useTransformLock();
  const objectAnnotations = useAnnotationStore((state) => state.objectAnnotations);
  const annotationClasses = useAnnotationStore((state) => state.annotationClasses);

  const children = Array.from(getObjectChildren(object));
  
  // Get annotation for this object
  const annotation = objectAnnotations[object.uuid];
  const annotationClass = annotation 
    ? annotationClasses.find(c => c.id === annotation.classId) 
    : null;

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', object.uuid);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const store = useEditorStore.getState();
    const draggedMaterial = store.draggedMaterial;
    const draggedShader = store.draggedShader;
    if ((draggedMaterial || draggedShader) && object instanceof THREE.Mesh) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (useEditorStore.getState().draggedMaterial) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!object) return;
    
    setIsDragOver(false);
    const store = useEditorStore.getState();
    
    const draggedMaterial = store.draggedMaterial;
    const draggedShader = store.draggedShader;

    if (draggedMaterial && object instanceof THREE.Mesh) {
      // Remove object from previous material's users
      store.materialAssets.forEach(asset => {
        store.removeMaterialUser(asset.id, object);
      });

      object.material = draggedMaterial.material.clone();
      // Add object to new material's users
      store.addMaterialUser(draggedMaterial.id, object);
      store.updateTransform();
      return;
    }

    if (draggedShader && object instanceof THREE.Mesh) {
      // Remove object from previous shader's users
      store.shaderAssets.forEach(asset => {
        store.removeShaderUser(asset.id, object);
      });

      // Apply new shader material
      object.material = draggedShader.material.clone();
      // Add object to new shader's users
      store.addShaderUser(draggedShader.id, object);
      store.updateTransform();
      return; // Early return to prevent object parenting
    }
    
    const draggedUuid = e.dataTransfer.getData('text/plain');
    const draggedObject = window.__THREE_OBJECTS?.find(obj => obj.uuid === draggedUuid);
    
    if (draggedObject && draggedObject !== object) {
      setObjectParent(draggedObject, object);
      setIsExpanded(true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (object && !selectedObjects.has(object)) {
      setSelectedObject(object);
    }
    setShowContextMenu(true);
  };

  const handleStartRename = () => {
    setNameInput(getObjectName(object));
    setIsRenaming(true);
    setShowContextMenu(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      renameObject(object, nameInput.trim());
    }
    setIsRenaming(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!object) return;

    // Delete this object, not its parent
    const store = useEditorStore.getState();
    store.removeObject(object);
    setShowContextMenu(false);
  };

  const handleVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!object) return;
    
    const newVisibility = !isVisible;
    setIsVisible(newVisibility);
    object.visible = newVisibility;
    
    // Handle camera helper visibility
    if (object.userData.isCamera && object.userData.helper) {
      object.userData.helper.visible = newVisibility;
    }
  };

  const handleLockToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!object) return;

    const newLocked = !isLocked;
    setIsLocked(newLocked);
    toggleLock(object, newLocked);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      if (lastSelectedObject) {
        if (object) {
          // Range selection
          selectObjectsInRange(lastSelectedObject, object);
        }
      } else {
        if (object) {
          // Start new selection
          addSelectedObject(object);
        }
      }
    } else {
      if (object) {
        // Single select
        setSelectedObject(object);
      }
    }
  };

  return (
    <div className="relative select-none">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${depth * 1.5}rem` }}
        className={cn(
          "w-full flex items-center justify-between pl-2 pr-1 py-2 rounded-md text-sm transition-colors",
          selectedObjects.has(object) ? "bg-blue-500/20 text-blue-200" : "hover:bg-gray-800 text-gray-400",
          isDragOver && "bg-gray-700/50 border border-blue-500/50",
          "cursor-pointer"
        )}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          {children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="w-4 h-4 flex items-center justify-center hover:bg-gray-700/50 rounded text-gray-500"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* Add icon based on object type */}
          <span className="w-5 h-5 flex items-center justify-center text-gray-500">
            {object.userData.isLight ? (
              <Lightbulb className="w-4 h-4" />
            ) : object.userData.objectType === 'Cube' ? (
              <Box className="w-4 h-4" />
            ) : object.userData.objectType === 'Plane' ? (
              <Square className="w-4 h-4" />
            ) : object.userData.objectType === 'Cylinder' ? (
              <Cylinder className="w-4 h-4" />
            ) : object.userData.objectType === 'Sphere' ? (
              <Circle className="w-4 h-4" />
            ) : object.userData.textOptions ? (
              <Type className="w-4 h-4" />
            ) : (
              <Box className="w-4 h-4" />
            )}
          </span>
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={handleRenameSubmit}
                autoFocus
                className="bg-gray-800 px-2 py-0.5 rounded border border-gray-600 text-gray-200 text-xs w-full"
              />
            </form>
          ) : (
            <span className="text-[13px] font-medium text-gray-300 truncate flex items-center gap-1.5">
              {object.userData.isLight 
                ? object.userData.objectType.replace(' Light', '')
                : object.userData.isCamera
                  ? 'Camera'
                  : getObjectName(object)}
              
              {/* Show annotation indicator */}
              {annotationClass && (
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: annotationClass.color }}
                  title={`Annotated as: ${annotationClass.name}`}
                />
              )}
            </span>
          )}
        </span>
        <div className="flex items-center gap-0.5 ml-auto -mr-1">
          <button
            onClick={handleLockToggle}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-700/50 rounded cursor-pointer text-gray-500"
          >
            {isLocked ? (
              <Lock className="w-4 h-4 text-orange-400" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleVisibilityToggle}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-700/50 rounded cursor-pointer text-gray-500"
          >
            {isVisible ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(e);
            }}
            className="w-7 h-7 flex items-center justify-center hover:bg-gray-700/50 rounded cursor-pointer text-gray-500 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {isExpanded && children.length > 0 && (
        <div className="ml-4">
          {children.map((child, childIndex) => (
            <HierarchyItem
              key={child.uuid}
              object={child}
              index={childIndex}
              depth={depth + 1}
              onDelete={() => onDelete?.()} 
            />
          ))}
        </div>
      )}

      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            ref={contextMenuRef}
            className="absolute right-0 mt-1 bg-[#252526] rounded-md shadow-lg border border-gray-700 py-1 z-40 min-w-[120px]"
          >
            {/* Physics Toggle */}
            {!object.userData.isLight && (
              <div
                onClick={() => {
                  const objects = selectedObjects.has(object) ? 
                    Array.from(selectedObjects) : 
                    [object];
                  
                  // Toggle physics for all selected objects
                  const enablePhysics = !object.userData.physicsEnabled;
                  objects.forEach(obj => {
                    obj.userData.physicsEnabled = enablePhysics;
                    obj.userData.physicsType = enablePhysics ? 'dynamic' : undefined;
                  });
                  useEditorStore.getState().updateTransform();
                  setShowContextMenu(false);
                }}
                className="w-full px-3 py-1 text-left text-sm text-gray-300 hover:bg-gray-700/50 cursor-pointer"
              >
                {object.userData.physicsEnabled ? 'Disable Physics' : 'Enable Physics'}
              </div>
            )}
            <div className="h-px bg-gray-700/50 my-1" />
            <div
              onClick={handleStartRename}
              className="w-full px-3 py-1 text-left text-sm text-gray-300 hover:bg-gray-700/50 cursor-pointer"
            >
              Rename
            </div>
            <div
              onClick={() => {
                duplicateObject(object);
                setShowContextMenu(false);
              }}
              className="w-full px-3 py-1 text-left text-sm text-gray-300 hover:bg-gray-700/50 cursor-pointer"
            >
              Duplicate
            </div>
            <div
              onClick={() => {
                // Use the same delete handler as the trash icon
                handleDelete(new MouseEvent('click'));
                setShowContextMenu(false);
              }}
              className="w-full px-3 py-1 text-left text-sm text-red-400 hover:bg-gray-700/50 cursor-pointer"
            >
              {selectedObjects.size > 1 && selectedObjects.has(object) 
                ? `Delete Selected (${selectedObjects.size})`
                : 'Delete'
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}