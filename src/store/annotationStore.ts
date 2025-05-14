import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AnnotationClass, ObjectAnnotation } from '../types/annotation';

interface AnnotationState {
  annotationClasses: AnnotationClass[];
  objectAnnotations: Record<string, ObjectAnnotation>;
  
  // Class management
  addAnnotationClass: (classData: AnnotationClass) => void;
  updateAnnotationClass: (id: string, updates: Partial<Omit<AnnotationClass, 'id'>>) => void;
  removeAnnotationClass: (id: string) => void;
  
  // Object annotation management
  setObjectAnnotation: (objectId: string, classId: string) => void;
  removeObjectAnnotation: (objectId: string) => void;
  
  // Bulk operations
  importAnnotations: (data: {
    classes: AnnotationClass[];
    annotations: Record<string, ObjectAnnotation>;
  }) => void;
  clearAllAnnotations: () => void;
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set) => ({
      annotationClasses: [],
      objectAnnotations: {},
      
      addAnnotationClass: (classData) => set((state) => ({
        annotationClasses: [...state.annotationClasses, classData]
      })),
      
      updateAnnotationClass: (id, updates) => set((state) => ({
        annotationClasses: state.annotationClasses.map(cls => 
          cls.id === id ? { ...cls, ...updates } : cls
        )
      })),
      
      removeAnnotationClass: (id) => set((state) => {
        // Remove class
        const newClasses = state.annotationClasses.filter(cls => cls.id !== id);
        
        // Remove annotations that use this class
        const newAnnotations = { ...state.objectAnnotations };
        Object.entries(newAnnotations).forEach(([objectId, annotation]) => {
          if (annotation.classId === id) {
            delete newAnnotations[objectId];
          }
        });
        
        return {
          annotationClasses: newClasses,
          objectAnnotations: newAnnotations
        };
      }),
      
      setObjectAnnotation: (objectId, classId) => set((state) => ({
        objectAnnotations: {
          ...state.objectAnnotations,
          [objectId]: {
            classId,
            timestamp: Date.now(),
            attributes: {}
          }
        }
      })),
      
      removeObjectAnnotation: (objectId) => set((state) => {
        const newAnnotations = { ...state.objectAnnotations };
        delete newAnnotations[objectId];
        return { objectAnnotations: newAnnotations };
      }),
      
      importAnnotations: (data) => set(() => ({
        annotationClasses: data.classes,
        objectAnnotations: data.annotations
      })),
      
      clearAllAnnotations: () => set(() => ({
        objectAnnotations: {}
      }))
    }),
    {
      name: 'annotation-store',
      partialize: (state) => ({
        annotationClasses: state.annotationClasses,
        objectAnnotations: state.objectAnnotations
      })
    }
  )
);