import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/cn';
import { useEditorStore } from '../store/editorStore';
import { useAnnotationStore } from '../store/annotationStore';
import { 
  Camera, Database, Layers, Shuffle, Box, Sun, Image, 
  Grid, Download, Play, Pause, Settings, ChevronDown, ChevronRight,
  Tag, Sliders, Aperture, Repeat, Cpu, Plus, X, Minus
} from 'lucide-react';
import * as THREE from 'three';
import { generateSyntheticData } from '../utils/syntheticData/generators';
import { exportAsCOCO, exportAsPascalVOC, exportAsYOLO } from '../utils/syntheticData/exporters';
import { downloadSyntheticDataZip } from '../utils/syntheticData/zipExport';

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
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
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
    samples: 10, // Reduced default for faster testing
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
    
    // First restore original scene to avoid compounding randomizations
    restoreOriginalScene();
    
    // Apply randomization to each object
    objects.forEach(obj => {
      if (!obj) return;
      
      // Skip cameras
      if (obj.userData.isCamera) return;
      
      // Randomize position for non-light objects
      if (!obj.userData.isLight && randomizationSettings.position.enabled) {
        const { x, y, z } = randomizationSettings.position.range;
        obj.position.x += (Math.random() - 0.5) * x * 2;
        obj.position.y += Math.max(0, obj.position.y + (Math.random() - 0.5) * y * 2);
        obj.position.z += (Math.random() - 0.5) * z * 2;
      }
      
      // Randomize rotation for non-light objects (except directional lights)
      if ((!obj.userData.isLight || obj instanceof THREE.DirectionalLight) && 
          randomizationSettings.rotation.enabled) {
        const { x, y, z } = randomizationSettings.rotation.range;
        obj.rotation.x += (Math.random() - 0.5) * (x * Math.PI / 180) * 2;
        obj.rotation.y += (Math.random() - 0.5) * (y * Math.PI / 180) * 2;
        obj.rotation.z += (Math.random() - 0.5) * (z * Math.PI / 180) * 2;
      }
      
      // Randomize scale for non-light objects
      if (!obj.userData.isLight && randomizationSettings.scale.enabled) {
        const { min, max } = randomizationSettings.scale.range;
        const scaleFactor = min + Math.random() * (max - min);
        
        if (randomizationSettings.scale.uniform) {
          obj.scale.set(
            obj.scale.x * scaleFactor,
            obj.scale.y * scaleFactor,
            obj.scale.z * scaleFactor
          );
        } else {
          obj.scale.x *= min + Math.random() * (max - min);
          obj.scale.y *= min + Math.random() * (max - min);
          obj.scale.z *= min + Math.random() * (max - min);
        }
      }
      
      // Randomize lights
      if (obj.userData.isLight && obj instanceof THREE.Light && 
          randomizationSettings.lighting.enabled) {
        const { min, max } = randomizationSettings.lighting.intensityRange;
        const intensityFactor = min + Math.random() * (max - min);
        obj.intensity = obj.intensity * intensityFactor;
        
        // Randomize color slightly
        const colorVar = randomizationSettings.lighting.colorVariation;
        if (colorVar > 0) {
          const color = obj.color.clone();
          color.r = THREE.MathUtils.clamp(color.r + (Math.random() - 0.5) * colorVar * 2, 0, 1);
          color.g = THREE.MathUtils.clamp(color.g + (Math.random() - 0.5) * colorVar * 2, 0, 1);
          color.b = THREE.MathUtils.clamp(color.b + (Math.random() - 0.5) * colorVar * 2, 0, 1);
          obj.color.copy(color);
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
    if (!canvas) {
      console.error('No canvas found for preview capture');
      return;
    }
    
    // Get the renderer, scene, and camera
    const renderer = (window as any).__THREE_RENDERER__;
    const scene = (window as any).__THREE_SCENE__;
    const camera = (window as any).__THREE_CAMERA__;
    
    if (!renderer || !scene || !camera) {
      console.error('Missing Three.js components for preview capture');
      return;
    }
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Get the image data
    try {
      const imageDataUrl = canvas.toDataURL('image/png');
      console.log('Preview image captured:', {
        width: canvas.width,
        height: canvas.height,
        dataUrlLength: imageDataUrl.length
      });
      setPreviewImage(imageDataUrl);
    } catch (error) {
      console.error('Error capturing preview image:', error);
    }
  };
  
  const generateSyntheticDataHandler = async () => {
    if (annotatedObjectsCount === 0) {
      alert('Please annotate at least one object before generating synthetic data.');
      return;
    }
    
    setIsGenerating(true);
    setProgress(0);
    setGeneratedImages([]);
    
    try {
      console.log('Starting synthetic data generation...');
      
      // Generate the synthetic data
      const images = await generateSyntheticData(
        objects,
        annotationClasses,
        objectAnnotations,
        randomizationSettings,
        cameraSettings,
        generationSettings.samples,
        (progress) => setProgress(progress),
        (imageUrl) => setPreviewImage(imageUrl)
      );
      
      console.log(`Generated ${images.length} synthetic images`);
      setGeneratedImages(images);
      
      // Restore original scene
      restoreOriginalScene();
      
    } catch (error) {
      console.error('Error generating synthetic data:', error);
      alert('An error occurred while generating synthetic data: ' + (error.message || 'Unknown error'));
    } finally {
      setIsGenerating(false);
      setProgress(100);
      
      // Restore original scene
      restoreOriginalScene();
    }
  };
  
  const handleDownload = async () => {
    if (generatedImages.length === 0) {
      alert('No images to download. Please generate synthetic data first.');
      return;
    }
    
    try {
      console.log(`Preparing to download ${generatedImages.length} images...`);
      
      // Export annotations based on selected format
      let annotationsJson;
      switch (generationSettings.outputFormat) {
        case 'COCO':
          annotationsJson = exportAsCOCO(generatedImages, annotationClasses);
          break;
        case 'PASCAL_VOC':
          annotationsJson = exportAsPascalVOC(generatedImages, annotationClasses);
          break;
        case 'YOLO':
          annotationsJson = exportAsYOLO(generatedImages, annotationClasses);
          break;
      }
      
      // Download as zip
      await downloadSyntheticDataZip(
        generatedImages, 
        annotationsJson, 
        `synthetic_data_${new Date().toISOString().slice(0, 10)}.zip`
      );
      
    } catch (error) {
      console.error('Error downloading synthetic data:', error);
      alert('Error downloading synthetic data: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handleAddCameraPosition = () => {
    const newPositions = [...cameraSettings.positions];
    newPositions.push({ x: 5, y: 5, z: 5 });
    setCameraSettings({ ...cameraSettings, positions: newPositions });
  };
  
  const handleRemoveCameraPosition = (index: number) => {
    const newPositions = [...cameraSettings.positions];
    newPositions.splice(index, 1);
    setCameraSettings({ ...cameraSettings, positions: newPositions });
  };
  
  const handleUpdateCameraPosition = (index: number, axis: 'x' | 'y' | 'z', value: number) => {
    const newPositions = [...cameraSettings.positions];
    newPositions[index] = { ...newPositions[index], [axis]: value };
    setCameraSettings({ ...cameraSettings, positions: newPositions });
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-blue-300">Synthetic Data Generator</h3>
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Generate synthetic data for machine learning by randomizing scene objects and capturing from multiple camera angles.
        </p>
      </div>
      
      {/* Randomization Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5 text-gray-500" />
            <span>Randomization</span>
          </h4>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={randomizationSettings.enabled}
              onChange={(e) => setRandomizationSettings({ ...randomizationSettings, enabled: e.target.checked })}
              className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
            />
            <span className="text-xs text-gray-400">Enabled</span>
          </label>
        </div>
        
        <div className={cn("space-y-3", !randomizationSettings.enabled && "opacity-50 pointer-events-none")}>
          {/* Position Randomization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Position Variation</label>
              <input
                type="checkbox"
                checked={randomizationSettings.position.enabled}
                onChange={(e) => setRandomizationSettings({ 
                  ...randomizationSettings, 
                  position: { ...randomizationSettings.position, enabled: e.target.checked } 
                })}
                className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
              />
            </div>
            
            <div className={cn("grid grid-cols-3 gap-2", !randomizationSettings.position.enabled && "opacity-50 pointer-events-none")}>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">X Range</label>
                <input
                  type="number"
                  value={randomizationSettings.position.range.x}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    position: {
                      ...randomizationSettings.position,
                      range: { ...randomizationSettings.position.range, x: parseFloat(e.target.value) }
                    }
                  })}
                  step={0.1}
                  min={0}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Y Range</label>
                <input
                  type="number"
                  value={randomizationSettings.position.range.y}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    position: {
                      ...randomizationSettings.position,
                      range: { ...randomizationSettings.position.range, y: parseFloat(e.target.value) }
                    }
                  })}
                  step={0.1}
                  min={0}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Z Range</label>
                <input
                  type="number"
                  value={randomizationSettings.position.range.z}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    position: {
                      ...randomizationSettings.position,
                      range: { ...randomizationSettings.position.range, z: parseFloat(e.target.value) }
                    }
                  })}
                  step={0.1}
                  min={0}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>
            </div>
          </div>
          
          {/* Rotation Randomization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Rotation Variation</label>
              <input
                type="checkbox"
                checked={randomizationSettings.rotation.enabled}
                onChange={(e) => setRandomizationSettings({ 
                  ...randomizationSettings, 
                  rotation: { ...randomizationSettings.rotation, enabled: e.target.checked } 
                })}
                className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
              />
            </div>
            
            <div className={cn("grid grid-cols-3 gap-2", !randomizationSettings.rotation.enabled && "opacity-50 pointer-events-none")}>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">X Range (°)</label>
                <input
                  type="number"
                  value={randomizationSettings.rotation.range.x}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    rotation: {
                      ...randomizationSettings.rotation,
                      range: { ...randomizationSettings.rotation.range, x: parseFloat(e.target.value) }
                    }
                  })}
                  step={5}
                  min={0}
                  max={180}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Y Range (°)</label>
                <input
                  type="number"
                  value={randomizationSettings.rotation.range.y}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    rotation: {
                      ...randomizationSettings.rotation,
                      range: { ...randomizationSettings.rotation.range, y: parseFloat(e.target.value) }
                    }
                  })}
                  step={5}
                  min={0}
                  max={180}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Z Range (°)</label>
                <input
                  type="number"
                  value={randomizationSettings.rotation.range.z}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    rotation: {
                      ...randomizationSettings.rotation,
                      range: { ...randomizationSettings.rotation.range, z: parseFloat(e.target.value) }
                    }
                  })}
                  step={5}
                  min={0}
                  max={180}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>
            </div>
          </div>
          
          {/* Scale Randomization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Scale Variation</label>
              <input
                type="checkbox"
                checked={randomizationSettings.scale.enabled}
                onChange={(e) => setRandomizationSettings({ 
                  ...randomizationSettings, 
                  scale: { ...randomizationSettings.scale, enabled: e.target.checked } 
                })}
                className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
              />
            </div>
            
            <div className={cn("space-y-2", !randomizationSettings.scale.enabled && "opacity-50 pointer-events-none")}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={randomizationSettings.scale.uniform}
                  onChange={(e) => setRandomizationSettings({
                    ...randomizationSettings,
                    scale: { ...randomizationSettings.scale, uniform: e.target.checked }
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Uniform Scaling</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Min Scale</label>
                  <input
                    type="number"
                    value={randomizationSettings.scale.range.min}
                    onChange={(e) => setRandomizationSettings({
                      ...randomizationSettings,
                      scale: {
                        ...randomizationSettings.scale,
                        range: { ...randomizationSettings.scale.range, min: parseFloat(e.target.value) }
                      }
                    })}
                    step={0.1}
                    min={0.1}
                    max={2}
                    className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Max Scale</label>
                  <input
                    type="number"
                    value={randomizationSettings.scale.range.max}
                    onChange={(e) => setRandomizationSettings({
                      ...randomizationSettings,
                      scale: {
                        ...randomizationSettings.scale,
                        range: { ...randomizationSettings.scale.range, max: parseFloat(e.target.value) }
                      }
                    })}
                    step={0.1}
                    min={0.1}
                    max={2}
                    className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Camera Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-gray-500" />
          <span>Camera Settings</span>
        </h4>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-gray-400 block">Camera Positions</label>
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
              {cameraSettings.positions.map((pos, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <div>
                      <input
                        type="number"
                        value={pos.x}
                        onChange={(e) => handleUpdateCameraPosition(index, 'x', parseFloat(e.target.value))}
                        step={0.5}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        placeholder="X"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={pos.y}
                        onChange={(e) => handleUpdateCameraPosition(index, 'y', parseFloat(e.target.value))}
                        step={0.5}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        placeholder="Y"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={pos.z}
                        onChange={(e) => handleUpdateCameraPosition(index, 'z', parseFloat(e.target.value))}
                        step={0.5}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        placeholder="Z"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCameraPosition(index)}
                    className="p-1 hover:bg-gray-700/50 rounded text-gray-500 hover:text-red-400"
                    disabled={cameraSettings.positions.length <= 1}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleAddCameraPosition}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Camera Position</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Resolution Width</label>
              <input
                type="number"
                value={cameraSettings.resolution.width}
                onChange={(e) => setCameraSettings({
                  ...cameraSettings,
                  resolution: { ...cameraSettings.resolution, width: parseInt(e.target.value) }
                })}
                step={64}
                min={256}
                max={2048}
                className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Resolution Height</label>
              <input
                type="number"
                value={cameraSettings.resolution.height}
                onChange={(e) => setCameraSettings({
                  ...cameraSettings,
                  resolution: { ...cameraSettings.resolution, height: parseInt(e.target.value) }
                })}
                step={64}
                min={256}
                max={2048}
                className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Generation Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-gray-500" />
            <span>Generation Settings</span>
          </h4>
          <button
            onClick={() => setRandomizationSettings({...randomizationSettings})}
            className="p-1 hover:bg-gray-700/50 rounded text-gray-500 hover:text-gray-400"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Number of Samples</label>
            <input
              type="number"
              value={generationSettings.samples}
              onChange={(e) => setGenerationSettings({ ...generationSettings, samples: parseInt(e.target.value) })}
              min={1}
              max={100}
              className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Total images: {generationSettings.samples * cameraSettings.positions.length}
            </p>
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
              <option value="PASCAL_VOC">PASCAL VOC</option>
              <option value="YOLO">YOLO</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Preview and Generation */}
      <div className="space-y-3 pt-3 border-t border-gray-700/50">
        {previewImage && (
          <div className="relative aspect-square mb-3">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full h-full object-cover rounded border border-gray-700/50"
            />
          </div>
        )}
        
        {isGenerating ? (
          <div className="space-y-2">
            <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-center text-gray-400">
              Generating... {Math.round(progress)}%
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleRandomizeScene}
              className="w-full py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/20 rounded-md text-sm text-blue-300 transition-colors"
            >
              Randomize Scene
            </button>
            
            <button
              onClick={generateSyntheticDataHandler}
              disabled={isGenerating || annotatedObjectsCount === 0}
              className={cn(
                "w-full py-2 border rounded-md text-sm transition-colors",
                annotatedObjectsCount > 0
                  ? "bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/20 text-blue-300"
                  : "bg-gray-700/50 border-gray-700/50 text-gray-500 cursor-not-allowed"
              )}
            >
              Generate Synthetic Data
            </button>
            
            {generatedImages.length > 0 && (
              <button
                onClick={handleDownload}
                className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/20 rounded-md text-sm text-green-300 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Data ({generatedImages.length} images)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}