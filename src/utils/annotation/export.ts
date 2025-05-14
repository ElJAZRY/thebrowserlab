import { Object3D, Box3, Vector3 } from 'three';
import { useAnnotationStore } from '../../store/annotationStore';
import { AnnotationExport, ExportedAnnotation } from '../../types/annotation';
import { useEditorStore } from '../../store/editorStore';

/**
 * Exports all annotations in the scene to a standardized JSON format
 */
export function exportAnnotations(objects: Object3D[]): AnnotationExport {
  const { annotationClasses, objectAnnotations } = useAnnotationStore.getState();
  const getObjectName = useEditorStore.getState().getObjectName;
  
  const exportedAnnotations: Record<string, ExportedAnnotation> = {};
  
  // Process each annotated object
  Object.entries(objectAnnotations).forEach(([objectId, annotation]) => {
    const object = objects.find(obj => obj.uuid === objectId);
    if (!object) return; // Skip if object no longer exists
    
    const classItem = annotationClasses.find(c => c.id === annotation.classId);
    if (!classItem) return; // Skip if class no longer exists
    
    // Calculate bounding box
    const boundingBox = new Box3().setFromObject(object);
    const min = boundingBox.min.toArray();
    const max = boundingBox.max.toArray();
    
    exportedAnnotations[objectId] = {
      classId: annotation.classId,
      className: classItem.name,
      objectName: getObjectName(object),
      position: object.position.toArray() as [number, number, number],
      rotation: object.rotation.toArray().slice(0, 3) as [number, number, number],
      scale: object.scale.toArray() as [number, number, number],
      boundingBox: {
        min: min as [number, number, number],
        max: max as [number, number, number]
      },
      attributes: annotation.attributes || {}
    };
  });
  
  // Create metadata
  const metadata = {
    timestamp: Date.now(),
    objectCount: objects.length,
    annotatedCount: Object.keys(exportedAnnotations).length
  };
  
  return {
    version: '1.0',
    classes: annotationClasses,
    annotations: exportedAnnotations,
    metadata
  };
}

/**
 * Exports annotations for a specific class
 */
export function exportAnnotationsByClass(objects: Object3D[], classId: string): AnnotationExport {
  const { annotationClasses, objectAnnotations } = useAnnotationStore.getState();
  const getObjectName = useEditorStore.getState().getObjectName;
  
  const exportedAnnotations: Record<string, ExportedAnnotation> = {};
  const classItem = annotationClasses.find(c => c.id === classId);
  
  if (!classItem) {
    throw new Error(`Class with ID ${classId} not found`);
  }
  
  // Process each annotated object of the specified class
  Object.entries(objectAnnotations)
    .filter(([_, annotation]) => annotation.classId === classId)
    .forEach(([objectId, annotation]) => {
      const object = objects.find(obj => obj.uuid === objectId);
      if (!object) return; // Skip if object no longer exists
      
      // Calculate bounding box
      const boundingBox = new Box3().setFromObject(object);
      const min = boundingBox.min.toArray();
      const max = boundingBox.max.toArray();
      
      exportedAnnotations[objectId] = {
        classId: annotation.classId,
        className: classItem.name,
        objectName: getObjectName(object),
        position: object.position.toArray() as [number, number, number],
        rotation: object.rotation.toArray().slice(0, 3) as [number, number, number],
        scale: object.scale.toArray() as [number, number, number],
        boundingBox: {
          min: min as [number, number, number],
          max: max as [number, number, number]
        },
        attributes: annotation.attributes || {}
      };
    });
  
  // Create metadata
  const metadata = {
    timestamp: Date.now(),
    objectCount: objects.length,
    annotatedCount: Object.keys(exportedAnnotations).length,
    className: classItem.name
  };
  
  return {
    version: '1.0',
    classes: [classItem],
    annotations: exportedAnnotations,
    metadata
  };
}