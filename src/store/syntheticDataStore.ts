import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SyntheticDataConfig {
  randomization: {
    enabled: boolean;
    position: {
      enabled: boolean;
      range: { x: number; y: number; z: number };
    };
    rotation: {
      enabled: boolean;
      range: { x: number; y: number; z: number };
    };
    scale: {
      enabled: boolean;
      uniform: boolean;
      range: { min: number; max: number };
    };
    lighting: {
      enabled: boolean;
      intensityRange: { min: number; max: number };
      colorVariation: number;
    };
  };
  camera: {
    positions: Array<{ x: number; y: number; z: number }>;
    fov: number;
    near: number;
    far: number;
    resolution: { width: number; height: number };
  };
  generation: {
    samples: number;
    outputFormat: 'COCO' | 'PASCAL_VOC' | 'YOLO';
    includeDepthMaps: boolean;
    includeSegmentationMaps: boolean;
    includeBoundingBoxes: boolean;
    includeKeypoints: boolean;
  };
}

interface SyntheticDataState {
  config: SyntheticDataConfig;
  updateConfig: (config: Partial<SyntheticDataConfig>) => void;
  updateRandomization: (randomization: Partial<SyntheticDataConfig['randomization']>) => void;
  updateCamera: (camera: Partial<SyntheticDataConfig['camera']>) => void;
  updateGeneration: (generation: Partial<SyntheticDataConfig['generation']>) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG: SyntheticDataConfig = {
  randomization: {
    enabled: true,
    position: {
      enabled: true,
      range: { x: 2, y: 0.5, z: 2 }
    },
    rotation: {
      enabled: true,
      range: { x: 45, y: 180, z: 45 }
    },
    scale: {
      enabled: true,
      uniform: true,
      range: { min: 0.8, max: 1.2 }
    },
    lighting: {
      enabled: true,
      intensityRange: { min: 0.8, max: 1.2 },
      colorVariation: 0.1
    }
  },
  camera: {
    positions: [
      { x: 5, y: 5, z: 5 },
      { x: -5, y: 5, z: 5 },
      { x: 5, y: 5, z: -5 },
      { x: -5, y: 5, z: -5 }
    ],
    fov: 50,
    near: 0.1,
    far: 1000,
    resolution: { width: 1024, height: 1024 }
  },
  generation: {
    samples: 100,
    outputFormat: 'COCO',
    includeDepthMaps: true,
    includeSegmentationMaps: true,
    includeBoundingBoxes: true,
    includeKeypoints: false
  }
};

export const useSyntheticDataStore = create<SyntheticDataState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      
      updateConfig: (config) => set((state) => ({
        config: { ...state.config, ...config }
      })),
      
      updateRandomization: (randomization) => set((state) => ({
        config: {
          ...state.config,
          randomization: { ...state.config.randomization, ...randomization }
        }
      })),
      
      updateCamera: (camera) => set((state) => ({
        config: {
          ...state.config,
          camera: { ...state.config.camera, ...camera }
        }
      })),
      
      updateGeneration: (generation) => set((state) => ({
        config: {
          ...state.config,
          generation: { ...state.config.generation, ...generation }
        }
      })),
      
      resetConfig: () => set({ config: DEFAULT_CONFIG })
    }),
    {
      name: 'synthetic-data-store',
      partialize: (state) => ({ config: state.config })
    }
  )
);