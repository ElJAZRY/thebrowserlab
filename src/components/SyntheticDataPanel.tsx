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

export function SyntheticDataPanel() {
  const objects = useEditorStore((state) => state.objects);
  const annotationClasses = useAnnotationStore((state) => state.annotationClasses);
  const objectAnnotations = useAnnotationStore((state) => state.objectAnnotations);
  const updateTransform = useEditorStore((state) => state.updateTransform);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Randomization settings
  const [randomizationEnabled, setRandomizationEnabled] = useState(true);
  const [positionRandomization, setPositionRandomization] = useState({
    enabled: true,
    range: { x: 2, y: 0.5, z: 2 }
  });
  const [rotationRandomization, setRotationRandomization] = useState({
    enabled: true,
    range: { x: 45, y: 180, z: 45 }
  });
  const [scaleRandomization, setScaleRandomization] = useState({
    enabled: true,
    uniform: true,
    range: { min: 0.8, max: 1.2 }
  });
  const [lightingRandomization, setLightingRandomization] = useState({
    enabled: true,
    intensityRange: { min: 0.8, max: 1.2 },
    colorVariation: 0.1
  });
  
  // Camera settings
  const [cameraPositions, setCameraPositions] = useState([
    { x: 5, y: 5, z: 5 },
    { x: -5, y: 5, z: 5 },
    { x: 5, y: 5, z: -5 },
    { x: -5, y: 5, z: -5 }
  ]);
  const [resolution, setResolution] = useState({ width: 1024, height: 1024 });
  
  // Generation settings
  const [sampleCount, setSampleCount] = useState(10);
  const [outputFormat, setOutputFormat] = useState<'COCO' | 'PASCAL_VOC' | 'YOLO'>('COCO');
  const [includeOptions, setIncludeOptions] = useState({
    depthMaps: false,
    segmentationMaps: false,
    boundingBoxes: true
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
    if (!randomizationEnabled) return;
    
    // First restore original scene to avoid compounding randomizations
    restoreOriginalScene();
    
    // Apply randomization to each object
    objects.forEach(obj => {
      if (!obj) return;
      
      // Skip cameras
      if (obj.userData.isCamera) return;
      
      // Randomize position for non-light objects
      if (!obj.userData.isLight && positionRandomization.enabled) {
        const { x, y, z } = positionRandomization.range;
        obj.position.x += (Math.random() - 0.5) * x * 2;
        // Ensure objects stay above ground
        obj.position.y = Math.max(0.1, obj.position.y + (Math.random() - 0.5) * y * 2);
        obj.position.z += (Math.random() - 0.5) * z * 2;
      }
      
      // Randomize rotation
      if ((!obj.userData.isLight || obj instanceof THREE.DirectionalLight) && 
          rotationRandomization.enabled) {
        const { x, y, z } = rotationRandomization.range;
        obj.rotation.x += (Math.random() - 0.5) * (x * Math.PI / 180) * 2;
        obj.rotation.y += (Math.random() - 0.5) * (y * Math.PI / 180) * 2;
        obj.rotation.z += (Math.random() - 0.5) * (z * Math.PI / 180) * 2;
      }
      
      // Randomize scale for non-light objects
      if (!obj.userData.isLight && scaleRandomization.enabled) {
        const { min, max } = scaleRandomization.range;
        const scaleFactor = min + Math.random() * (max - min);
        
        if (scaleRandomization.uniform) {
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
          lightingRandomization.enabled) {
        const { min, max } = lightingRandomization.intensityRange;
        const intensityFactor = min + Math.random() * (max - min);
        obj.intensity = obj.intensity * intensityFactor;
        
        // Randomize color slightly
        const colorVar = lightingRandomization.colorVariation;
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
    try {
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
      
      // Prepare randomization settings
      const randomizationSettings = {
        enabled: randomizationEnabled,
        position: positionRandomization,
        rotation: rotationRandomization,
        scale: scaleRandomization,
        lighting: lightingRandomization
      };
      
      // Prepare camera settings
      const cameraSettings = {
        positions: cameraPositions,
        fov: 50,
        near: 0.1,
        far: 1000,
        resolution
      };
      
      // Generate the synthetic data
      const images = await generateSyntheticData(
        objects,
        annotationClasses,
        objectAnnotations,
        randomizationSettings,
        cameraSettings,
        sampleCount,
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
      switch (outputFormat) {
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
    setCameraPositions([...cameraPositions, { x: 5, y: 5, z: 5 }]);
  };
  
  const handleRemoveCameraPosition = (index: number) => {
    if (cameraPositions.length <= 1) return;
    const newPositions = [...cameraPositions];
    newPositions.splice(index, 1);
    setCameraPositions(newPositions);
  };
  
  const handleUpdateCameraPosition = (index: number, axis: 'x' | 'y' | 'z', value: number) => {
    const newPositions = [...cameraPositions];
    newPositions[index] = { ...newPositions[index], [axis]: value };
    setCameraPositions(newPositions);
  };
  
  return (
    <div className="absolute right-3 top-20 w-[320px] bg-[#252526]/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl overflow-hidden z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">Synthetic Data Generator</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="p-1.5 hover:bg-gray-700/50 rounded text-gray-400"
            title={showAdvancedSettings ? "Hide Advanced Settings" : "Show Advanced Settings"}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 max-h-[calc(100vh-180px)] overflow-y-auto thin-scrollbar">
        {/* Status */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Annotated Objects:</span>
            <span className="text-xs font-medium text-blue-300">{annotatedObjectsCount} / {totalObjectsCount}</span>
          </div>
          
          {annotatedObjectsCount === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2 text-xs text-yellow-200">
              Please annotate at least one object before generating data.
            </div>
          )}
        </div>
        
        {/* Preview Image */}
        {previewImage && (
          <div className="mb-4">
            <div className="aspect-square w-full rounded-md border border-gray-700/50 overflow-hidden bg-gray-800/50">
              <img 
                src={previewImage} 
                alt="Preview" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
        
        {/* Main Controls */}
        <div className="space-y-4">
          {/* Basic Settings */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Samples</label>
                <input
                  type="number"
                  value={sampleCount}
                  onChange={(e) => setSampleCount(parseInt(e.target.value) || 1)}
                  min={1}
                  max={100}
                  className="w-full py-1.5 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full py-1.5 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                >
                  <option value="COCO">COCO JSON</option>
                  <option value="PASCAL_VOC">PASCAL VOC</option>
                  <option value="YOLO">YOLO</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400 block mb-1">Resolution</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={resolution.width}
                    onChange={(e) => setResolution({...resolution, width: parseInt(e.target.value) || 512})}
                    step={64}
                    min={256}
                    max={2048}
                    className="w-full py-1.5 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                  />
                  <span className="text-xs text-gray-500">W</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={resolution.height}
                    onChange={(e) => setResolution({...resolution, height: parseInt(e.target.value) || 512})}
                    step={64}
                    min={256}
                    max={2048}
                    className="w-full py-1.5 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                  />
                  <span className="text-xs text-gray-500">H</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Randomization Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shuffle className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-400">Randomization</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={randomizationEnabled} 
                onChange={(e) => setRandomizationEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500/50"></div>
            </label>
          </div>
          
          {/* Camera Positions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-400">Camera Positions</span>
              </div>
              <button
                onClick={handleAddCameraPosition}
                className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                title="Add Camera Position"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
              {cameraPositions.map((pos, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    <input
                      type="number"
                      value={pos.x}
                      onChange={(e) => handleUpdateCameraPosition(index, 'x', parseFloat(e.target.value) || 0)}
                      step={0.5}
                      className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                    />
                    <input
                      type="number"
                      value={pos.y}
                      onChange={(e) => handleUpdateCameraPosition(index, 'y', parseFloat(e.target.value) || 0)}
                      step={0.5}
                      className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                    />
                    <input
                      type="number"
                      value={pos.z}
                      onChange={(e) => handleUpdateCameraPosition(index, 'z', parseFloat(e.target.value) || 0)}
                      step={0.5}
                      className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveCameraPosition(index)}
                    className="p-1 hover:bg-gray-700/50 rounded text-gray-500 hover:text-red-400"
                    disabled={cameraPositions.length <= 1}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-1 text-[10px] text-gray-500">
              Total images: {sampleCount * cameraPositions.length}
            </div>
          </div>
          
          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
              <h4 className="text-xs font-medium text-gray-300">Advanced Settings</h4>
              
              {/* Position Randomization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Position Variation</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={positionRandomization.enabled} 
                      onChange={(e) => setPositionRandomization({
                        ...positionRandomization,
                        enabled: e.target.checked
                      })}
                      className="sr-only peer"
                      disabled={!randomizationEnabled}
                    />
                    <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500/50 peer-disabled:opacity-50"></div>
                  </label>
                </div>
                
                {positionRandomization.enabled && randomizationEnabled && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">X Range</label>
                      <input
                        type="number"
                        value={positionRandomization.range.x}
                        onChange={(e) => setPositionRandomization({
                          ...positionRandomization,
                          range: { ...positionRandomization.range, x: parseFloat(e.target.value) || 0 }
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
                        value={positionRandomization.range.y}
                        onChange={(e) => setPositionRandomization({
                          ...positionRandomization,
                          range: { ...positionRandomization.range, y: parseFloat(e.target.value) || 0 }
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
                        value={positionRandomization.range.z}
                        onChange={(e) => setPositionRandomization({
                          ...positionRandomization,
                          range: { ...positionRandomization.range, z: parseFloat(e.target.value) || 0 }
                        })}
                        step={0.1}
                        min={0}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Rotation Randomization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Rotation Variation</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={rotationRandomization.enabled} 
                      onChange={(e) => setRotationRandomization({
                        ...rotationRandomization,
                        enabled: e.target.checked
                      })}
                      className="sr-only peer"
                      disabled={!randomizationEnabled}
                    />
                    <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500/50 peer-disabled:opacity-50"></div>
                  </label>
                </div>
                
                {rotationRandomization.enabled && randomizationEnabled && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">X (°)</label>
                      <input
                        type="number"
                        value={rotationRandomization.range.x}
                        onChange={(e) => setRotationRandomization({
                          ...rotationRandomization,
                          range: { ...rotationRandomization.range, x: parseFloat(e.target.value) || 0 }
                        })}
                        step={5}
                        min={0}
                        max={180}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Y (°)</label>
                      <input
                        type="number"
                        value={rotationRandomization.range.y}
                        onChange={(e) => setRotationRandomization({
                          ...rotationRandomization,
                          range: { ...rotationRandomization.range, y: parseFloat(e.target.value) || 0 }
                        })}
                        step={5}
                        min={0}
                        max={180}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Z (°)</label>
                      <input
                        type="number"
                        value={rotationRandomization.range.z}
                        onChange={(e) => setRotationRandomization({
                          ...rotationRandomization,
                          range: { ...rotationRandomization.range, z: parseFloat(e.target.value) || 0 }
                        })}
                        step={5}
                        min={0}
                        max={180}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Scale Randomization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Scale Variation</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={scaleRandomization.enabled} 
                      onChange={(e) => setScaleRandomization({
                        ...scaleRandomization,
                        enabled: e.target.checked
                      })}
                      className="sr-only peer"
                      disabled={!randomizationEnabled}
                    />
                    <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500/50 peer-disabled:opacity-50"></div>
                  </label>
                </div>
                
                {scaleRandomization.enabled && randomizationEnabled && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={scaleRandomization.uniform}
                        onChange={(e) => setScaleRandomization({
                          ...scaleRandomization,
                          uniform: e.target.checked
                        })}
                        className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                      />
                      <span className="text-xs text-gray-400">Uniform Scaling</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Min</label>
                        <input
                          type="number"
                          value={scaleRandomization.range.min}
                          onChange={(e) => setScaleRandomization({
                            ...scaleRandomization,
                            range: { ...scaleRandomization.range, min: parseFloat(e.target.value) || 0.1 }
                          })}
                          step={0.1}
                          min={0.1}
                          max={2}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Max</label>
                        <input
                          type="number"
                          value={scaleRandomization.range.max}
                          onChange={(e) => setScaleRandomization({
                            ...scaleRandomization,
                            range: { ...scaleRandomization.range, max: parseFloat(e.target.value) || 0.1 }
                          })}
                          step={0.1}
                          min={0.1}
                          max={2}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Include Options */}
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400">Include in Output</h4>
                <div className="space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeOptions.boundingBoxes}
                      onChange={(e) => setIncludeOptions({
                        ...includeOptions,
                        boundingBoxes: e.target.checked
                      })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Bounding Boxes</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeOptions.segmentationMaps}
                      onChange={(e) => setIncludeOptions({
                        ...includeOptions,
                        segmentationMaps: e.target.checked
                      })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Segmentation Maps</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeOptions.depthMaps}
                      onChange={(e) => setIncludeOptions({
                        ...includeOptions,
                        depthMaps: e.target.checked
                      })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Depth Maps</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer with Action Buttons */}
      <div className="p-3 border-t border-gray-700/50">
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
              className="w-full py-2 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 rounded-md text-sm text-gray-300 transition-colors"
            >
              Randomize Scene
            </button>
            
            <button
              onClick={generateSyntheticDataHandler}
              disabled={annotatedObjectsCount === 0}
              className={cn(
                "w-full py-2 border rounded-md text-sm transition-colors",
                annotatedObjectsCount > 0
                  ? "bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/20 text-blue-300"
                  : "bg-gray-700/50 border-gray-700/50 text-gray-500 cursor-not-allowed"
              )}
            >
              Generate Data
            </button>
            
            {generatedImages.length > 0 && (
              <button
                onClick={handleDownload}
                className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/20 rounded-md text-sm text-green-300 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download ({generatedImages.length} images)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}