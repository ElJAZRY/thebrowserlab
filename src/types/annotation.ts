export interface AnnotationClass {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface ObjectAnnotation {
  classId: string;
  timestamp: number;
  attributes: Record<string, any>;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface AnnotationExport {
  version: string;
  classes: AnnotationClass[];
  annotations: Record<string, ExportedAnnotation>;
  metadata: {
    timestamp: number;
    objectCount: number;
    annotatedCount: number;
  };
}

export interface ExportedAnnotation {
  classId: string;
  className: string;
  objectName: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  boundingBox?: BoundingBox;
  attributes: Record<string, any>;
}