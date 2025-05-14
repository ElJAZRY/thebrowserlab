import * as THREE from 'three';
import { useAnnotationStore } from '../../store/annotationStore';
import { AnnotationClass } from '../../types/annotation';

// Map to store visualization objects
const visualizationObjects = new Map<string, THREE.Object3D>();

/**
 * Creates or updates visualization for an annotated object
 */
export function visualizeAnnotation(object: THREE.Object3D, classItem: AnnotationClass): void {
  // Remove any existing visualization
  removeVisualization(object);
  
  // Create a bounding box for the object
  const bbox = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  
  // Create a wireframe box to represent the bounding box
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ 
    color: classItem.color,
    linewidth: 2,
    transparent: true,
    opacity: 0.8
  });
  
  const wireframe = new THREE.LineSegments(edges, material);
  
  // Position the wireframe at the center of the bounding box
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  wireframe.position.copy(center);
  
  // Make the wireframe a child of the scene, not the object
  // This prevents the wireframe from being affected by the object's transform
  const scene = object.parent;
  if (scene) {
    scene.add(wireframe);
    
    // Store the wireframe for later removal
    visualizationObjects.set(object.uuid, wireframe);
    
    // Add a small label with the class name
    addClassLabel(object, classItem, center, scene);
  }
}

/**
 * Adds a text label showing the class name
 */
function addClassLabel(
  object: THREE.Object3D, 
  classItem: AnnotationClass, 
  position: THREE.Vector3,
  scene: THREE.Object3D
): void {
  // Create a canvas for the text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  
  // Set canvas size
  canvas.width = 256;
  canvas.height = 64;
  
  // Draw background
  context.fillStyle = classItem.color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw text
  context.font = 'bold 24px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(classItem.name, canvas.width / 2, canvas.height / 2);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  
  // Create sprite material
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true
  });
  
  // Create sprite
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  
  // Position above the object
  const bbox = new THREE.Box3().setFromObject(object);
  sprite.position.y = bbox.max.y + 0.5;
  
  // Scale the sprite
  sprite.scale.set(1, 0.25, 1);
  
  // Add to scene
  scene.add(sprite);
  
  // Store the sprite with the wireframe
  const existing = visualizationObjects.get(object.uuid);
  if (existing) {
    const group = new THREE.Group();
    group.add(existing);
    group.add(sprite);
    visualizationObjects.set(object.uuid, group);
    
    // Remove the individual wireframe from the scene
    scene.remove(existing);
    scene.add(group);
  } else {
    visualizationObjects.set(object.uuid, sprite);
  }
}

/**
 * Removes visualization for an object
 */
export function removeVisualization(object: THREE.Object3D): void {
  const visualization = visualizationObjects.get(object.uuid);
  if (visualization) {
    // Remove from scene
    if (visualization.parent) {
      visualization.parent.remove(visualization);
    }
    
    // Dispose of geometries and materials
    if (visualization instanceof THREE.LineSegments) {
      visualization.geometry.dispose();
      (visualization.material as THREE.Material).dispose();
    } else if (visualization instanceof THREE.Group) {
      visualization.traverse(child => {
        if (child instanceof THREE.LineSegments || child instanceof THREE.Sprite) {
          child.geometry?.dispose();
          (child.material as THREE.Material)?.dispose();
        }
      });
    }
    
    // Remove from map
    visualizationObjects.delete(object.uuid);
  }
}

/**
 * Updates visualizations for all annotated objects
 */
export function updateAllVisualizations(objects: THREE.Object3D[]): void {
  const { annotationClasses, objectAnnotations } = useAnnotationStore.getState();
  
  // Remove visualizations for objects that are no longer annotated
  visualizationObjects.forEach((_, objectId) => {
    if (!objectAnnotations[objectId]) {
      const object = objects.find(obj => obj.uuid === objectId);
      if (object) {
        removeVisualization(object);
      }
    }
  });
  
  // Update or create visualizations for annotated objects
  Object.entries(objectAnnotations).forEach(([objectId, annotation]) => {
    const object = objects.find(obj => obj.uuid === objectId);
    if (!object) return;
    
    const classItem = annotationClasses.find(c => c.id === annotation.classId);
    if (!classItem) return;
    
    visualizeAnnotation(object, classItem);
  });
}

/**
 * Toggles visibility of all visualizations
 */
export function toggleVisualizationsVisibility(visible: boolean): void {
  visualizationObjects.forEach(visualization => {
    visualization.visible = visible;
  });
}