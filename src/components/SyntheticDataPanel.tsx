import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn';
import { useEditorStore } from '../store/editorStore';
import { useAnnotationStore } from '../store/annotationStore';
import { 
  Camera, Database, Layers, Shuffle, Box, Sun, Image, 
  Grid, Download, Play, Pause, Settings, ChevronDown, ChevronRight,
  Tag, Sliders, Aperture, Repeat, Cpu, Plus, X
} from 'lucide-react';
import * as THREE from 'three';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-gray-700/50 last:border-b-0 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full py-1.5 px-1 hover:bg-gray-700/30 rounded"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-gray-500">{icon}</span>
        <span className="text-xs font-medium text-gray-300">{title}</span>
      </button>
      {isOpen && <div className="mt-3 space-y-4 px-1">{children}</div>}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

function Slider({ label, value, onChange, min, max, step = 0.1 }: SliderProps) {
  return (
    <div className="slider-container">
      <label className="slider-label">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider-input"
      />
      <span className="slider-value">{value.toFixed(2)}</span>
    </div>
  );
}

interface RandomizationSettings {
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
}

interface CameraSettings {
  positions: Array<{ x: number; y: number; z: number }>;
  fov: number;
  near: number;
  far: number;
  resolution: { width: number; height: number };
}

interface GenerationSettings {
  samples: number;
  outputFormat: 'COCO' | 'PASCAL_VOC' | 'YOLO';
  includeDepthMaps: boolean;
  includeSegmentationMaps: boolean;
  includeBoundingBoxes: boolean;
  includeKeypoints: boolean;
}

export function SyntheticDataPanel() {
  const objects = useEditorStore((state) => state.objects);
  const annotationClasses = useAnnotationStore((state) => state.annotationClasses);
  const objectAnnotations = useAnnotationStore((state) => state.objectAnnotations);
  const updateTransform = useEditorStore((state) => state.updateTransform);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [randomizationSettings, setRandomizationSettings] = useState<RandomizationSettings>({
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
  });
  
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
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
  });
  
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    samples: 100,
    outputFormat: 'COCO',
    includeDepthMaps: true,
    includeSegmentationMaps: true,
    includeBoundingBoxes: true,
    includeKeypoints: false
  });

  // Store original object transforms for restoration
  const [originalTransforms, setOriginalTransforms] = useState<Map<string, {
    position: THREE.Vector3,
    rotation: THREE.Euler,
    scale: THREE.Vector3
  }>>(new Map());

  // Store original light properties
  const [originalLights, setOriginalLights] = useState<Map<string, {
    intensity: number,
    color: THREE.Color
  }>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const annotatedObjectsCount = Object.keys(objectAnnotations).length;
  const totalObjectsCount = objects.length;

  // Save original transforms when component mounts
  useEffect(() => {
    const transforms = new Map();
    const lights = new Map();
    
    objects.forEach(obj => {
      if (!obj) return;
      
      // Save transform for all objects
      transforms.set(obj.uuid, {
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone()
      });
      
      // Save light properties
      if (obj.userData.isLight && obj instanceof THREE.Light) {
        lights.set(obj.uuid, {
          intensity: obj.intensity,
          color: obj.color.clone()
        });
      }
    });
    
    setOriginalTransforms(transforms);
    setOriginalLights(lights);
    
    // Restore original transforms when component unmounts
    return () => {
      restoreOriginalScene();
    };
  }, [objects]);
  
  // Restore original scene transforms
  const restoreOriginalScene = () => {
    objects.forEach(obj => {
      if (!obj) return;
      
      // Restore transform
      const originalTransform = originalTransforms.get(obj.uuid);
      if (originalTransform) {
        obj.position.copy(originalTransform.position);
        obj.rotation.copy(originalTransform.rotation);
        obj.scale.copy(originalTransform.scale);
      }
      
      // Restore light properties
      if (obj.userData.isLight && obj instanceof THREE.Light) {
        const originalLight = originalLights.get(obj.uuid);
        if (originalLight) {
          obj.intensity = originalLight.intensity;
          obj.color.copy(originalLight.color);
        }
      }
    });
    
    // Update the scene
    updateTransform();
  };
  
  const handleRandomizeScene = () => {
    if (!randomizationSettings.enabled) return;
    
    // Apply randomization to each object
    objects.forEach(obj => {
      if (!obj) return;
      
      // Skip cameras
      if (obj.userData.isCamera) return;
      
      // Randomize position for non-light objects
      if (!obj.userData.isLight && randomizationSettings.position.enabled) {
        const { x, y, z } = randomizationSettings.position.range;
        const originalTransform = originalTransforms.get(obj.uuid);
        
        if (originalTransform) {
          // Start from original position and apply randomization
          obj.position.copy(originalTransform.position);
          obj.position.x += (Math.random() - 0.5) * x * 2;
          obj.position.y += Math.max(0, (Math.random() - 0.5) * y * 2);
          obj.position.z += (Math.random() - 0.5) * z * 2;
        }
      }
      
      // Randomize rotation for non-light objects (except directional lights)
      if ((!obj.userData.isLight || obj instanceof THREE.DirectionalLight) && 
          randomizationSettings.rotation.enabled) {
        const { x, y, z } = randomizationSettings.rotation.range;
        const originalTransform = originalTransforms.get(obj.uuid);
        
        if (originalTransform) {
          // Start from original rotation and apply randomization
          obj.rotation.copy(originalTransform.rotation);
          obj.rotation.x += (Math.random() - 0.5) * (x * Math.PI / 180) * 2;
          obj.rotation.y += (Math.random() - 0.5) * (y * Math.PI / 180) * 2;
          obj.rotation.z += (Math.random() - 0.5) * (z * Math.PI / 180) * 2;
        }
      }
      
      // Randomize scale for non-light objects
      if (!obj.userData.isLight && randomizationSettings.scale.enabled) {
        const { min, max } = randomizationSettings.scale.range;
        const originalTransform = originalTransforms.get(obj.uuid);
        
        if (originalTransform) {
          // Start from original scale and apply randomization
          obj.scale.copy(originalTransform.scale);
          
          const scaleFactor = min + Math.random() * (max - min);
          
          if (randomizationSettings.scale.uniform) {
            obj.scale.multiplyScalar(scaleFactor);
          } else {
            obj.scale.x *= min + Math.random() * (max - min);
            obj.scale.y *= min + Math.random() * (max - min);
            obj.scale.z *= min + Math.random() * (max - min);
          }
        }
      }
      
      // Randomize lights
      if (obj.userData.isLight && obj instanceof THREE.Light && 
          randomizationSettings.lighting.enabled) {
        const { min, max } = randomizationSettings.lighting.intensityRange;
        const originalLight = originalLights.get(obj.uuid);
        
        if (originalLight) {
          // Start from original intensity and apply randomization
          const intensityFactor = min + Math.random() * (max - min);
          obj.intensity = originalLight.intensity * intensityFactor;
          
          // Randomize color slightly
          const colorVar = randomizationSettings.lighting.colorVariation;
          if (colorVar > 0) {
            obj.color.copy(originalLight.color);
            obj.color.r = THREE.MathUtils.clamp(obj.color.r + (Math.random() - 0.5) * colorVar * 2, 0, 1);
            obj.color.g = THREE.MathUtils.clamp(obj.color.g + (Math.random() - 0.5) * colorVar * 2, 0, 1);
            obj.color.b = THREE.MathUtils.clamp(obj.color.b + (Math.random() - 0.5) * colorVar * 2, 0, 1);
          }
        }
      }
    });
    
    // Update the scene
    updateTransform();
    
    // Capture a preview image
    capturePreviewImage();
  };
  
  const capturePreviewImage = () => {
    // Get the canvas from the viewport
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    // Get the renderer, scene, and camera
    const renderer = (window as any).__THREE_RENDERER__;
    const scene = (window as any).__THREE_SCENE__;
    const camera = (window as any).__THREE_CAMERA__;
    
    if (!renderer || !scene || !camera) return;
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Get the image data
    const imageDataUrl = canvas.toDataURL('image/png');
    setPreviewImage(imageDataUrl);
  };
  
  const generateSyntheticData = async () => {
    if (annotatedObjectsCount === 0) {
      alert('Please annotate at least one object before generating synthetic data.');
      return;
    }
    
    setIsGenerating(true);
    setProgress(0);
    
    try {
      // Create a virtual camera for rendering
      const camera = new THREE.PerspectiveCamera(
        cameraSettings.fov,
        cameraSettings.resolution.width / cameraSettings.resolution.height,
        cameraSettings.near,
        cameraSettings.far
      );
      
      // Generate the specified number of samples
      const totalSamples = generationSettings.samples;
      const annotations = [];
      
      for (let i = 0; i < totalSamples; i++) {
        // Randomize the scene
        handleRandomizeScene();
        
        // For each camera position
        for (let j = 0; j < cameraSettings.positions.length; j++) {
          const cameraPos = cameraSettings.positions[j];
          camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
          camera.lookAt(0, 0, 0);
          
          // Render the scene
          const mainRenderer = (window as any).__THREE_RENDERER__;
          const mainScene = (window as any).__THREE_SCENE__;
          
          if (mainRenderer && mainScene) {
            mainRenderer.render(mainScene, camera);
            
            // Get the rendered image
            const canvas = document.querySelector('canvas');
            if (!canvas) continue;
            
            const imageDataUrl = canvas.toDataURL('image/png');
            
            // Generate annotations for this image
            const imageAnnotations = generateAnnotations(mainScene, camera, mainRenderer.domElement.width, mainRenderer.domElement.height);
            
            annotations.push({
              imageId: `sample_${i}_camera_${j}`,
              imageUrl: imageDataUrl,
              annotations: imageAnnotations
            });
            
            // Update progress
            const currentProgress = ((i * cameraSettings.positions.length + j + 1) / (totalSamples * cameraSettings.positions.length)) * 100;
            setProgress(currentProgress);
            
            // Set preview image (update periodically to avoid too many rerenders)
            if (i === 0 && j === 0) {
              setPreviewImage(imageDataUrl);
            }
            
            // Allow UI to update by yielding to the event loop
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
      
      // Export the annotations in the selected format
      exportAnnotations(annotations, generationSettings.outputFormat);
      
      // Restore original scene
      restoreOriginalScene();
      
    } catch (error) {
      console.error('Error generating synthetic data:', error);
      alert('An error occurred while generating synthetic data. See console for details.');
    } finally {
      setIsGenerating(false);
      setProgress(100);
      
      // Restore original scene
      restoreOriginalScene();
    }
  };
  
  const generateAnnotations = (scene: THREE.Scene, camera: THREE.Camera, width: number, height: number) => {
    const annotations = [];
    
    // Get all annotated objects in the scene
    scene.traverse(obj => {
      const annotation = objectAnnotations[obj.uuid];
      if (!annotation) return;
      
      const classInfo = annotationClasses.find(c => c.id === annotation.classId);
      if (!classInfo) return;
      
      // Calculate 2D bounding box
      const bbox = new THREE.Box3().setFromObject(obj);
      const corners = [
        new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
        new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
        new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
        new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
        new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
        new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
        new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
        new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
      ];
      
      // Project corners to 2D
      const screenCorners = corners.map(corner => {
        const screenPos = corner.clone().project(camera);
        return {
          x: (screenPos.x * 0.5 + 0.5) * width,
          y: (1 - (screenPos.y * 0.5 + 0.5)) * height
        };
      });
      
      // Find min/max X and Y
      const minX = Math.min(...screenCorners.map(c => c.x));
      const maxX = Math.max(...screenCorners.map(c => c.x));
      const minY = Math.min(...screenCorners.map(c => c.y));
      const maxY = Math.max(...screenCorners.map(c => c.y));
      
      // Create annotation
      annotations.push({
        category_id: classInfo.id,
        category_name: classInfo.name,
        bbox: [minX, minY, maxX - minX, maxY - minY],
        segmentation: [], // Would require more complex calculation
        area: (maxX - minX) * (maxY - minY),
        iscrowd: 0,
        keypoints: [], // Would require specific keypoint definitions
        num_keypoints: 0
      });
    });
    
    return annotations;
  };
  
  const formatAsCOCO = (data: any[]) => {
    // Create COCO format structure
    const images = [];
    const annotations = [];
    const categories = [];
    
    // Add categories
    annotationClasses.forEach((cls, index) => {
      categories.push({
        id: index + 1,
        name: cls.name,
        supercategory: 'object'
      });
    });
    
    // Add images and annotations
    data.forEach((item, imageIndex) => {
      // Add image
      images.push({
        id: imageIndex + 1,
        file_name: `${item.imageId}.png`,
        width: cameraSettings.resolution.width,
        height: cameraSettings.resolution.height,
        date_captured: new Date().toISOString()
      });
      
      // Add annotations for this image
      item.annotations.forEach((anno, annoIndex) => {
        const categoryId = categories.findIndex(c => c.name === anno.category_name) + 1;
        
        annotations.push({
          id: imageIndex * 1000 + annoIndex + 1,
          image_id: imageIndex + 1,
          category_id: categoryId,
          bbox: anno.bbox,
          segmentation: anno.segmentation,
          area: anno.area,
          iscrowd: anno.iscrowd,
          keypoints: anno.keypoints,
          num_keypoints: anno.num_keypoints
        });
      });
    });
    
    return {
      info: {
        description: 'Synthetic data generated by Browser Lab',
        url: '',
        version: '1.0',
        year: new Date().getFullYear(),
        contributor: 'Browser Lab',
        date_created: new Date().toISOString()
      },
      licenses: [
        {
          id: 1,
          name: 'Attribution-NonCommercial-ShareAlike License',
          url: 'http://creativecommons.org/licenses/by-nc-sa/2.0/'
        }
      ],
      images,
      annotations,
      categories
    };
  };
  
  const formatAsPascalVOC = (data: any[]) => {
    // For simplicity, we'll return a JSON representation of Pascal VOC
    // In a real implementation, this would generate XML files
    return {
      format: 'PASCAL_VOC',
      data: data.map(item => ({
        filename: `${item.imageId}.png`,
        width: cameraSettings.resolution.width,
        height: cameraSettings.resolution.height,
        objects: item.annotations.map(anno => ({
          name: anno.category_name,
          pose: 'Unspecified',
          truncated: 0,
          difficult: 0,
          bndbox: {
            xmin: anno.bbox[0],
            ymin: anno.bbox[1],
            xmax: anno.bbox[0] + anno.bbox[2],
            ymax: anno.bbox[1] + anno.bbox[3]
          }
        }))
      }))
    };
  };
  
  const formatAsYOLO = (data: any[]) => {
    // For simplicity, we'll return a JSON representation of YOLO format
    // In a real implementation, this would generate .txt files
    const classMap = {};
    annotationClasses.forEach((cls, index) => {
      classMap[cls.name] = index;
    });
    
    return {
      format: 'YOLO',
      classes: annotationClasses.map(cls => cls.name),
      data: data.map(item => ({
        image: `${item.imageId}.png`,
        annotations: item.annotations.map(anno => {
          const classId = classMap[anno.category_name];
          const x = (anno.bbox[0] + anno.bbox[2] / 2) / cameraSettings.resolution.width;
          const y = (anno.bbox[1] + anno.bbox[3] / 2) / cameraSettings.resolution.height;
          const w = anno.bbox[2] / cameraSettings.resolution.width;
          const h = anno.bbox[3] / cameraSettings.resolution.height;
          return `${classId} ${x.toFixed(6)} ${y.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
        })
      }))
    };
  };
  
  const exportAnnotations = (data: any[], format: string) => {
    let exportData;
    
    switch (format) {
      case 'COCO':
        exportData = formatAsCOCO(data);
        break;
      case 'PASCAL_VOC':
        exportData = formatAsPascalVOC(data);
        break;
      case 'YOLO':
        exportData = formatAsYOLO(data);
        break;
      default:
        exportData = data;
    }
    
    // Create a downloadable JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `synthetic_data_${format.toLowerCase()}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        
        // Update settings based on imported config
        if (config.randomizationSettings) {
          setRandomizationSettings(config.randomizationSettings);
        }
        
        if (config.cameraSettings) {
          setCameraSettings(config.cameraSettings);
        }
        
        if (config.generationSettings) {
          setGenerationSettings(config.generationSettings);
        }
        
      } catch (error) {
        console.error('Error parsing config file:', error);
        alert('Invalid configuration file. Please check the format and try again.');
      }
    };
    
    reader.readAsText(file);
  };
  
  const handleExportConfig = () => {
    const config = {
      randomizationSettings,
      cameraSettings,
      generationSettings
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'synthetic_data_config.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="absolute right-3 top-20 w-[270px] bg-[#252526]/90 backdrop-blur-sm rounded-lg border border-gray-700/50 text-xs z-40">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-700/50">
        <h2 className="text-sm font-medium text-gray-300">Synthetic Data</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
            title="Import Configuration"
          >
            <Database className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportConfig}
            className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
            title="Export Configuration"
          >
            <Download className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportConfig}
            className="hidden"
          />
        </div>
      </div>
      
      <div className="p-3 overflow-y-auto overflow-x-hidden thin-scrollbar max-h-[calc(100vh-200px)]">
        {/* Status Section */}
        <div className="mb-4 p-3 bg-gray-800/40 rounded-md border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Annotated Objects:</span>
            <span className="text-xs font-medium text-blue-400">{annotatedObjectsCount} / {totalObjectsCount}</span>
          </div>
          
          {annotatedObjectsCount === 0 ? (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
              Please annotate objects using the Annotation Panel before generating synthetic data.
            </div>
          ) : (
            <div className="text-xs text-green-400 bg-green-500/10 p-2 rounded border border-green-500/20">
              Ready to generate synthetic data with {annotatedObjectsCount} annotated objects.
            </div>
          )}
        </div>
        
        {/* Randomization Settings */}
        <Section title="Randomization" icon={<Shuffle className="w-4 h-4" />} defaultOpen={true}>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={randomizationSettings.enabled}
                onChange={(e) => setRandomizationSettings({
                  ...randomizationSettings,
                  enabled: e.target.checked
                })}
                className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
              />
              <span className="text-xs text-gray-400">Enable Randomization</span>
            </label>
            
            {/* Position Randomization */}
            <div className={cn(
              "space-y-2 p-2 rounded border border-gray-700/50 bg-gray-800/30",
              !randomizationSettings.enabled && "opacity-50 pointer-events-none"
            )}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={randomizationSettings.position.enabled}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    position: {
                      ...randomizationSettings.position,
                      enabled: e.target.checked
                    }
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Position Variation</span>
              </label>
              
              <div className={cn(
                "space-y-2",
                !randomizationSettings.position.enabled && "opacity-50 pointer-events-none"
              )}>
                <Slider
                  label="X Range"
                  value={randomizationSettings.position.range.x}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    position: {
                      ...randomizationSettings.position,
                      range: {
                        ...randomizationSettings.position.range,
                        x: value
                      }
                    }
                  })}
                  min={0}
                  max={10}
                  step={0.1}
                />
                
                <Slider
                  label="Y Range"
                  value={randomizationSettings.position.range.y}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    position: {
                      ...randomizationSettings.position,
                      range: {
                        ...randomizationSettings.position.range,
                        y: value
                      }
                    }
                  })}
                  min={0}
                  max={5}
                  step={0.1}
                />
                
                <Slider
                  label="Z Range"
                  value={randomizationSettings.position.range.z}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    position: {
                      ...randomizationSettings.position,
                      range: {
                        ...randomizationSettings.position.range,
                        z: value
                      }
                    }
                  })}
                  min={0}
                  max={10}
                  step={0.1}
                />
              </div>
            </div>
            
            {/* Rotation Randomization */}
            <div className={cn(
              "space-y-2 p-2 rounded border border-gray-700/50 bg-gray-800/30",
              !randomizationSettings.enabled && "opacity-50 pointer-events-none"
            )}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={randomizationSettings.rotation.enabled}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    rotation: {
                      ...randomizationSettings.rotation,
                      enabled: e.target.checked
                    }
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Rotation Variation</span>
              </label>
              
              <div className={cn(
                "space-y-2",
                !randomizationSettings.rotation.enabled && "opacity-50 pointer-events-none"
              )}>
                <Slider
                  label="X Range (°)"
                  value={randomizationSettings.rotation.range.x}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    rotation: {
                      ...randomizationSettings.rotation,
                      range: {
                        ...randomizationSettings.rotation.range,
                        x: value
                      }
                    }
                  })}
                  min={0}
                  max={180}
                  step={1}
                />
                
                <Slider
                  label="Y Range (°)"
                  value={randomizationSettings.rotation.range.y}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    rotation: {
                      ...randomizationSettings.rotation,
                      range: {
                        ...randomizationSettings.rotation.range,
                        y: value
                      }
                    }
                  })}
                  min={0}
                  max={180}
                  step={1}
                />
                
                <Slider
                  label="Z Range (°)"
                  value={randomizationSettings.rotation.range.z}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    rotation: {
                      ...randomizationSettings.rotation,
                      range: {
                        ...randomizationSettings.rotation.range,
                        z: value
                      }
                    }
                  })}
                  min={0}
                  max={180}
                  step={1}
                />
              </div>
            </div>
            
            {/* Scale Randomization */}
            <div className={cn(
              "space-y-2 p-2 rounded border border-gray-700/50 bg-gray-800/30",
              !randomizationSettings.enabled && "opacity-50 pointer-events-none"
            )}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={randomizationSettings.scale.enabled}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    scale: {
                      ...randomizationSettings.scale,
                      enabled: e.target.checked
                    }
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Scale Variation</span>
              </label>
              
              <div className={cn(
                "space-y-2",
                !randomizationSettings.scale.enabled && "opacity-50 pointer-events-none"
              )}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={randomizationSettings.scale.uniform}
                    onChange={(e) => setRandomizationSettings({
                      ...randomizationSettings,
                      scale: {
                        ...randomizationSettings.scale,
                        uniform: e.target.checked
                      }
                    })}
                    className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                  />
                  <span className="text-xs text-gray-400">Uniform Scaling</span>
                </label>
                
                <Slider
                  label="Min Scale"
                  value={randomizationSettings.scale.range.min}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    scale: {
                      ...randomizationSettings.scale,
                      range: {
                        ...randomizationSettings.scale.range,
                        min: value
                      }
                    }
                  })}
                  min={0.1}
                  max={2}
                  step={0.05}
                />
                
                <Slider
                  label="Max Scale"
                  value={randomizationSettings.scale.range.max}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    scale: {
                      ...randomizationSettings.scale,
                      range: {
                        ...randomizationSettings.scale.range,
                        max: value
                      }
                    }
                  })}
                  min={0.1}
                  max={2}
                  step={0.05}
                />
              </div>
            </div>
            
            {/* Lighting Randomization */}
            <div className={cn(
              "space-y-2 p-2 rounded border border-gray-700/50 bg-gray-800/30",
              !randomizationSettings.enabled && "opacity-50 pointer-events-none"
            )}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={randomizationSettings.lighting.enabled}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    lighting: {
                      ...randomizationSettings.lighting,
                      enabled: e.target.checked
                    }
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Lighting Variation</span>
              </label>
              
              <div className={cn(
                "space-y-2",
                !randomizationSettings.lighting.enabled && "opacity-50 pointer-events-none"
              )}>
                <Slider
                  label="Min Intensity"
                  value={randomizationSettings.lighting.intensityRange.min}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    lighting: {
                      ...randomizationSettings.lighting,
                      intensityRange: {
                        ...randomizationSettings.lighting.intensityRange,
                        min: value
                      }
                    }
                  })}
                  min={0.1}
                  max={2}
                  step={0.05}
                />
                
                <Slider
                  label="Max Intensity"
                  value={randomizationSettings.lighting.intensityRange.max}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    lighting: {
                      ...randomizationSettings.lighting,
                      intensityRange: {
                        ...randomizationSettings.lighting.intensityRange,
                        max: value
                      }
                    }
                  })}
                  min={0.1}
                  max={2}
                  step={0.05}
                />
                
                <Slider
                  label="Color Variation"
                  value={randomizationSettings.lighting.colorVariation}
                  onChange={(value) => setRandomizationSettings({
                    ...randomizationSettings,
                    lighting: {
                      ...randomizationSettings.lighting,
                      colorVariation: value
                    }
                  })}
                  min={0}
                  max={0.5}
                  step={0.01}
                />
              </div>
            </div>
            
            {/* Randomize Button */}
            <button
              onClick={handleRandomizeScene}
              disabled={!randomizationSettings.enabled}
              className={cn(
                "w-full py-2 rounded text-sm font-medium transition-colors",
                randomizationSettings.enabled
                  ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/20"
                  : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              )}
            >
              Randomize Scene
            </button>
            
            {/* Restore Button */}
            <button
              onClick={restoreOriginalScene}
              className="w-full py-2 rounded text-sm font-medium transition-colors bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border border-gray-600/20"
            >
              Restore Original Scene
            </button>
          </div>
        </Section>
        
        {/* Camera Settings */}
        <Section title="Camera Settings" icon={<Camera className="w-4 h-4" />} defaultOpen={false}>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Camera Positions</label>
                <button
                  onClick={() => setCameraSettings({
                    ...cameraSettings,
                    positions: [...cameraSettings.positions, { x: 0, y: 5, z: 0 }]
                  })}
                  className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                  title="Add Camera Position"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {cameraSettings.positions.map((pos, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-800/40 rounded border border-gray-700/50">
                    <div className="flex-1 grid grid-cols-3 gap-1">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">X</label>
                        <input
                          type="number"
                          value={pos.x}
                          onChange={(e) => {
                            const newPositions = [...cameraSettings.positions];
                            newPositions[index].x = parseFloat(e.target.value);
                            setCameraSettings({
                              ...cameraSettings,
                              positions: newPositions
                            });
                          }}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Y</label>
                        <input
                          type="number"
                          value={pos.y}
                          onChange={(e) => {
                            const newPositions = [...cameraSettings.positions];
                            newPositions[index].y = parseFloat(e.target.value);
                            setCameraSettings({
                              ...cameraSettings,
                              positions: newPositions
                            });
                          }}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Z</label>
                        <input
                          type="number"
                          value={pos.z}
                          onChange={(e) => {
                            const newPositions = [...cameraSettings.positions];
                            newPositions[index].z = parseFloat(e.target.value);
                            setCameraSettings({
                              ...cameraSettings,
                              positions: newPositions
                            });
                          }}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        const newPositions = [...cameraSettings.positions];
                        newPositions.splice(index, 1);
                        setCameraSettings({
                          ...cameraSettings,
                          positions: newPositions
                        });
                      }}
                      className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                      title="Remove Camera Position"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-400 block mb-1">Camera Parameters</label>
              
              <Slider
                label="FOV (°)"
                value={cameraSettings.fov}
                onChange={(value) => setCameraSettings({
                  ...cameraSettings,
                  fov: value
                })}
                min={10}
                max={120}
                step={1}
              />
              
              <Slider
                label="Near Plane"
                value={cameraSettings.near}
                onChange={(value) => setCameraSettings({
                  ...cameraSettings,
                  near: value
                })}
                min={0.01}
                max={1}
                step={0.01}
              />
              
              <Slider
                label="Far Plane"
                value={cameraSettings.far}
                onChange={(value) => setCameraSettings({
                  ...cameraSettings,
                  far: value
                })}
                min={100}
                max={2000}
                step={100}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-400 block mb-1">Resolution</label>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Width</label>
                  <input
                    type="number"
                    value={cameraSettings.resolution.width}
                    onChange={(e) => setCameraSettings({
                      ...cameraSettings,
                      resolution: {
                        ...cameraSettings.resolution,
                        width: parseInt(e.target.value)
                      }
                    })}
                    className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Height</label>
                  <input
                    type="number"
                    value={cameraSettings.resolution.height}
                    onChange={(e) => setCameraSettings({
                      ...cameraSettings,
                      resolution: {
                        ...cameraSettings.resolution,
                        height: parseInt(e.target.value)
                      }
                    })}
                    className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>
        
        {/* Generation Settings */}
        <Section title="Generation Settings" icon={<Settings className="w-4 h-4" />} defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Number of Samples</label>
              <input
                type="number"
                value={generationSettings.samples}
                onChange={(e) => setGenerationSettings({
                  ...generationSettings,
                  samples: parseInt(e.target.value)
                })}
                min={1}
                max={1000}
                className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-400 block mb-1">Output Format</label>
              <select
                value={generationSettings.outputFormat}
                onChange={(e) => setGenerationSettings({
                  ...generationSettings,
                  outputFormat: e.target.value as 'COCO' | 'PASCAL_VOC' | 'YOLO'
                })}
                className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
              >
                <option value="COCO">COCO JSON</option>
                <option value="PASCAL_VOC">Pascal VOC</option>
                <option value="YOLO">YOLO</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-400 block mb-1">Include Data Types</label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={generationSettings.includeBoundingBoxes}
                  onChange={(e) => setGenerationSettings({
                    ...generationSettings,
                    includeBoundingBoxes: e.target.checked
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Bounding Boxes</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={generationSettings.includeSegmentationMaps}
                  onChange={(e) => setGenerationSettings({
                    ...generationSettings,
                    includeSegmentationMaps: e.target.checked
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Segmentation Maps</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={generationSettings.includeDepthMaps}
                  onChange={(e) => setGenerationSettings({
                    ...generationSettings,
                    includeDepthMaps: e.target.checked
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Depth Maps</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={generationSettings.includeKeypoints}
                  onChange={(e) => setGenerationSettings({
                    ...generationSettings,
                    includeKeypoints: e.target.checked
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Keypoints</span>
              </label>
            </div>
          </div>
        </Section>
        
        {/* Preview */}
        {previewImage && (
          <div className="mt-4 p-2 bg-gray-800/40 rounded border border-gray-700/50">
            <h3 className="text-xs font-medium text-gray-300 mb-2">Preview</h3>
            <div className="aspect-square bg-black/50 rounded overflow-hidden">
              <img 
                src={previewImage} 
                alt="Preview" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Generate Button */}
      <div className="p-3 border-t border-gray-700/50">
        <button
          onClick={generateSyntheticData}
          disabled={isGenerating || annotatedObjectsCount === 0}
          className={cn(
            "w-full py-2 rounded text-sm font-medium transition-colors relative",
            isGenerating
              ? "bg-blue-500/50 text-blue-200 cursor-not-allowed"
              : annotatedObjectsCount === 0
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
          )}
        >
          {isGenerating ? (
            <>
              <span>Generating... {Math.round(progress)}%</span>
              <div 
                className="absolute left-0 bottom-0 h-1 bg-blue-400"
                style={{ width: `${progress}%` }}
              />
            </>
          ) : (
            <>
              <span>Generate Synthetic Data</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}