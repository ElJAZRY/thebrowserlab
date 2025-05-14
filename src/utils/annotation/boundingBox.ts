import * as THREE from 'three';
import { BoundingBox } from '../../types/annotation';

/**
 * Calculates the bounding box for an object
 */
export function calculateBoundingBox(object: THREE.Object3D): BoundingBox {
  const bbox = new THREE.Box3().setFromObject(object);
  
  return {
    min: bbox.min.toArray() as [number, number, number],
    max: bbox.max.toArray() as [number, number, number]
  };
}

/**
 * Calculates the volume of a bounding box
 */
export function calculateVolume(boundingBox: BoundingBox): number {
  const width = boundingBox.max[0] - boundingBox.min[0];
  const height = boundingBox.max[1] - boundingBox.min[1];
  const depth = boundingBox.max[2] - boundingBox.min[2];
  
  return width * height * depth;
}

/**
 * Calculates the center point of a bounding box
 */
export function calculateCenter(boundingBox: BoundingBox): [number, number, number] {
  return [
    (boundingBox.min[0] + boundingBox.max[0]) / 2,
    (boundingBox.min[1] + boundingBox.max[1]) / 2,
    (boundingBox.min[2] + boundingBox.max[2]) / 2
  ];
}

/**
 * Checks if a point is inside a bounding box
 */
export function isPointInBoundingBox(point: [number, number, number], boundingBox: BoundingBox): boolean {
  return (
    point[0] >= boundingBox.min[0] && point[0] <= boundingBox.max[0] &&
    point[1] >= boundingBox.min[1] && point[1] <= boundingBox.max[1] &&
    point[2] >= boundingBox.min[2] && point[2] <= boundingBox.max[2]
  );
}

/**
 * Calculates the intersection of two bounding boxes
 * Returns null if there is no intersection
 */
export function calculateIntersection(box1: BoundingBox, box2: BoundingBox): BoundingBox | null {
  const min = [
    Math.max(box1.min[0], box2.min[0]),
    Math.max(box1.min[1], box2.min[1]),
    Math.max(box1.min[2], box2.min[2])
  ];
  
  const max = [
    Math.min(box1.max[0], box2.max[0]),
    Math.min(box1.max[1], box2.max[1]),
    Math.min(box1.max[2], box2.max[2])
  ];
  
  // Check if there is an intersection
  if (min[0] > max[0] || min[1] > max[1] || min[2] > max[2]) {
    return null;
  }
  
  return {
    min: min as [number, number, number],
    max: max as [number, number, number]
  };
}

/**
 * Calculates the Intersection over Union (IoU) of two bounding boxes
 */
export function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const intersection = calculateIntersection(box1, box2);
  
  if (!intersection) {
    return 0;
  }
  
  const intersectionVolume = calculateVolume(intersection);
  const volume1 = calculateVolume(box1);
  const volume2 = calculateVolume(box2);
  
  return intersectionVolume / (volume1 + volume2 - intersectionVolume);
}