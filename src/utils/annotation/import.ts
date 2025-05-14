import { Object3D } from 'three';
import { useAnnotationStore } from '../../store/annotationStore';
import { AnnotationExport } from '../../types/annotation';

/**
 * Imports annotations from a JSON file
 */
export function importAnnotations(data: AnnotationExport, objects: Object3D[]): void {
  const { importAnnotations } = useAnnotationStore.getState();
  
  // Validate the import data
  if (!data.version || !data.classes || !data.annotations) {
    throw new Error('Invalid annotation data format');
  }
  
  // Filter annotations to only include objects that exist in the scene
  const existingObjectIds = objects.map(obj => obj.uuid);
  const validAnnotations = Object.entries(data.annotations)
    .filter(([objectId]) => existingObjectIds.includes(objectId))
    .reduce((acc, [objectId, annotation]) => {
      acc[objectId] = {
        classId: annotation.classId,
        timestamp: Date.now(),
        attributes: annotation.attributes || {}
      };
      return acc;
    }, {} as Record<string, any>);
  
  // Import the data
  importAnnotations({
    classes: data.classes,
    annotations: validAnnotations
  });
  
  console.log(`Imported ${Object.keys(validAnnotations).length} annotations with ${data.classes.length} classes`);
}