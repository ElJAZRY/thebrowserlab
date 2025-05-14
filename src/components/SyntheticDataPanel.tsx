import React, { useState, useRef } from 'react';
import { X, Camera, Download, Plus, Minus, RefreshCw, Settings, Sliders, Cpu } from 'lucide-react';
import { cn } from '../utils/cn';
import { useSyntheticDataStore } from '../store/syntheticDataStore';
import { useEditorStore } from '../store/editorStore';
import { useAnnotationStore } from '../store/annotationStore';
import { exportAsCOCO, exportAsPascalVOC, exportAsYOLO, SyntheticDataImage } from '../utils/syntheticData/exporters';
import { downloadSyntheticDataZip } from '../utils/syntheticData/zipExport';
import * as THREE from 'three';

export function SyntheticDataPanel() {
  const config = useSyntheticDataStore((state) => state.config);
  const updateRandomization = useSyntheticDataStore((state) => state.updateRandomization);
  const updateCamera = useSyntheticDataStore((state) => state.updateCamera);
  const updateGeneration = useSyntheticDataStore((state) => state.updateGeneration);
  
  const objects = useEditorStore((state) => state.objects);
  const annotationClasses = useAnnotationStore((state) => state.annotationClasses);
  const objectAnnotations = useAnnotationStore((state) => state.objectAnnotations);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<SyntheticDataImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const handleGenerate = async () => {
    if (isGenerating) return;
    
    try {
      setIsGenerating(true);
      setProgress(0);
      setPreviewImage(null);
      setGeneratedImages([]);
      
      // Check if we have annotated objects
      const annotatedObjects = objects.filter(obj => objectAnnotations[obj.uuid]);
      if (annotatedObjects.length === 0) {
        alert('No annotated objects found. Please annotate objects before generating synthetic data.');
        setIsGenerating(false);
        return;
      }
      
      // Get the main scene and renderer
      const scene = (window as any).__THREE_SCENE__;
      const renderer = (window as any).__THREE_RENDERER__;
      
      if (!scene || !renderer) {
        alert('Scene or renderer not found. Please ensure the 3D view is initialized.');
        setIsGenerating(false);
        return;
      }
      
      // Create a new renderer for offscreen rendering
      const offscreenRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: true
      });
      offscreenRenderer.setSize(config.camera.resolution.width, config.camera.resolution.height);
      offscreenRenderer.setClearColor(0x000000, 0); // Set clear color with alpha
      offscreenRenderer.shadowMap.enabled = true;
      offscreenRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
      offscreenRenderer.outputColorSpace = THREE.SRGBColorSpace;
      
      // Create a camera
      const camera = new THREE.PerspectiveCamera(
        config.camera.fov,
        config.camera.resolution.width / config.camera.resolution.height,
        config.camera.near,
        config.camera.far
      );
      
      // Clone the scene for each sample
      const images: SyntheticDataImage[] = [];
      const totalSamples = config.generation.samples * config.camera.positions.length;
      let currentSample = 0;
      
      // Store original object transforms
      const originalTransforms = new Map<THREE.Object3D, {
        position: THREE.Vector3,
        rotation: THREE.Euler,
        scale: THREE.Vector3
      }>();
      
      // Store original light properties
      const originalLights = new Map<THREE.Light, {
        intensity: number,
        color: THREE.Color
      }>();
      
      // Store all objects that will be randomized
      const objectsToRandomize = objects.filter(obj => objectAnnotations[obj.uuid]);
      const lightsToRandomize = objects.filter(obj => obj.userData.isLight) as THREE.Light[];
      
      // Store original transforms
      objectsToRandomize.forEach(obj => {
        originalTransforms.set(obj, {
          position: obj.position.clone(),
          rotation: obj.rotation.clone(),
          scale: obj.scale.clone()
        });
      });
      
      // Store original light properties
      lightsToRandomize.forEach(light => {
        originalLights.set(light, {
          intensity: light.intensity,
          color: light.color.clone()
        });
      });
      
      // Generate samples
      for (let i = 0; i < config.generation.samples; i++) {
        // Randomize objects if enabled
        if (config.randomization.enabled) {
          // Randomize object transforms
          objectsToRandomize.forEach(obj => {
            const original = originalTransforms.get(obj)!;
            
            // Randomize position
            if (config.randomization.position.enabled) {
              const { x, y, z } = config.randomization.position.range;
              obj.position.set(
                original.position.x + (Math.random() - 0.5) * x * 2,
                original.position.y + (Math.random() - 0.5) * y * 2,
                original.position.z + (Math.random() - 0.5) * z * 2
              );
            }
            
            // Randomize rotation
            if (config.randomization.rotation.enabled) {
              const { x, y, z } = config.randomization.rotation.range;
              obj.rotation.set(
                original.rotation.x + (Math.random() - 0.5) * (x * Math.PI / 180) * 2,
                original.rotation.y + (Math.random() - 0.5) * (y * Math.PI / 180) * 2,
                original.rotation.z + (Math.random() - 0.5) * (z * Math.PI / 180) * 2
              );
            }
            
            // Randomize scale
            if (config.randomization.scale.enabled) {
              const { min, max } = config.randomization.scale.range;
              const scaleFactor = min + Math.random() * (max - min);
              
              if (config.randomization.scale.uniform) {
                obj.scale.set(
                  original.scale.x * scaleFactor,
                  original.scale.y * scaleFactor,
                  original.scale.z * scaleFactor
                );
              } else {
                obj.scale.set(
                  original.scale.x * (min + Math.random() * (max - min)),
                  original.scale.y * (min + Math.random() * (max - min)),
                  original.scale.z * (min + Math.random() * (max - min))
                );
              }
            }
            
            // Update matrices
            obj.updateMatrix();
            obj.updateMatrixWorld(true);
          });
          
          // Randomize lights
          if (config.randomization.lighting.enabled) {
            lightsToRandomize.forEach(light => {
              const original = originalLights.get(light)!;
              
              // Randomize intensity
              const { min, max } = config.randomization.lighting.intensityRange;
              const intensityFactor = min + Math.random() * (max - min);
              light.intensity = original.intensity * intensityFactor;
              
              // Randomize color slightly
              const colorVar = config.randomization.lighting.colorVariation;
              if (colorVar > 0) {
                const color = original.color.clone();
                color.r += (Math.random() - 0.5) * colorVar * 2;
                color.g += (Math.random() - 0.5) * colorVar * 2;
                color.b += (Math.random() - 0.5) * colorVar * 2;
                light.color.copy(color);
              }
            });
          }
        }
        
        // For each camera position
        for (let j = 0; j < config.camera.positions.length; j++) {
          const cameraPos = config.camera.positions[j];
          camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
          camera.lookAt(0, 0, 0);
          
          // Render the scene
          offscreenRenderer.render(scene, camera);
          
          // Get the rendered image
          const imageDataUrl = offscreenRenderer.domElement.toDataURL('image/png');
          
          // Generate annotations for this image
          const annotations = generateAnnotationsForImage(
            scene,
            camera,
            offscreenRenderer,
            objectAnnotations,
            annotationClasses
          );
          
          // Add to result
          const imageId = `sample_${i}_camera_${j}`;
          images.push({
            id: imageId,
            dataUrl: imageDataUrl,
            width: config.camera.resolution.width,
            height: config.camera.resolution.height,
            cameraPosition: camera.position.clone(),
            cameraRotation: camera.rotation.clone(),
            annotations
          });
          
          // Update progress
          currentSample++;
          const progress = (currentSample / totalSamples) * 100;
          setProgress(progress);
          
          // Set preview image for the first render
          if (i === 0 && j === 0) {
            setPreviewImage(imageDataUrl);
          }
          
          // Allow UI to update by yielding to the event loop
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Restore original transforms
      objectsToRandomize.forEach(obj => {
        const original = originalTransforms.get(obj)!;
        obj.position.copy(original.position);
        obj.rotation.copy(original.rotation);
        obj.scale.copy(original.scale);
        obj.updateMatrix();
        obj.updateMatrixWorld(true);
      });
      
      // Restore original light properties
      lightsToRandomize.forEach(light => {
        const original = originalLights.get(light)!;
        light.intensity = original.intensity;
        light.color.copy(original.color);
      });
      
      // Clean up
      offscreenRenderer.dispose();
      
      // Store generated images
      setGeneratedImages(images);
      
    } catch (error) {
      console.error('Error generating synthetic data:', error);
      alert('Error generating synthetic data: ' + (error.message || 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleDownload = async () => {
    if (generatedImages.length === 0) return;
    
    try {
      // Export annotations based on selected format
      let annotationsJson;
      switch (config.generation.outputFormat) {
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
    const newPositions = [...config.camera.positions];
    newPositions.push({ x: 5, y: 5, z: 5 });
    updateCamera({ positions: newPositions });
  };
  
  const handleRemoveCameraPosition = (index: number) => {
    const newPositions = [...config.camera.positions];
    newPositions.splice(index, 1);
    updateCamera({ positions: newPositions });
  };
  
  const handleUpdateCameraPosition = (index: number, axis: 'x' | 'y' | 'z', value: number) => {
    const newPositions = [...config.camera.positions];
    newPositions[index] = { ...newPositions[index], [axis]: value };
    updateCamera({ positions: newPositions });
  };
  
  return (
    <div className="fixed right-3 top-20 w-[350px] bg-[#252526]/90 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl z-40">
      <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
        <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <span>Synthetic Data Generator</span>
        </h3>
        <button
          onClick={() => {
            // Close panel by toggling the state in App.tsx
            const toggleButton = document.querySelector('button[class*="bottom-20 right-3"]') as HTMLButtonElement;
            if (toggleButton) toggleButton.click();
          }}
          className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="space-y-4">
          {/* Randomization Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                <span>Randomization</span>
              </h4>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.randomization.enabled}
                  onChange={(e) => updateRandomization({ enabled: e.target.checked })}
                  className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                />
                <span className="text-xs text-gray-400">Enabled</span>
              </label>
            </div>
            
            <div className={cn("space-y-3", !config.randomization.enabled && "opacity-50 pointer-events-none")}>
              {/* Position Randomization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">Position Variation</label>
                  <input
                    type="checkbox"
                    checked={config.randomization.position.enabled}
                    onChange={(e) => updateRandomization({ 
                      position: { ...config.randomization.position, enabled: e.target.checked } 
                    })}
                    className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                  />
                </div>
                
                <div className={cn("grid grid-cols-3 gap-2", !config.randomization.position.enabled && "opacity-50 pointer-events-none")}>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">X Range</label>
                    <input
                      type="number"
                      value={config.randomization.position.range.x}
                      onChange={(e) => updateRandomization({
                        position: {
                          ...config.randomization.position,
                          range: { ...config.randomization.position.range, x: parseFloat(e.target.value) }
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
                      value={config.randomization.position.range.y}
                      onChange={(e) => updateRandomization({
                        position: {
                          ...config.randomization.position,
                          range: { ...config.randomization.position.range, y: parseFloat(e.target.value) }
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
                      value={config.randomization.position.range.z}
                      onChange={(e) => updateRandomization({
                        position: {
                          ...config.randomization.position,
                          range: { ...config.randomization.position.range, z: parseFloat(e.target.value) }
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
                    checked={config.randomization.rotation.enabled}
                    onChange={(e) => updateRandomization({ 
                      rotation: { ...config.randomization.rotation, enabled: e.target.checked } 
                    })}
                    className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                  />
                </div>
                
                <div className={cn("grid grid-cols-3 gap-2", !config.randomization.rotation.enabled && "opacity-50 pointer-events-none")}>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">X Range (°)</label>
                    <input
                      type="number"
                      value={config.randomization.rotation.range.x}
                      onChange={(e) => updateRandomization({
                        rotation: {
                          ...config.randomization.rotation,
                          range: { ...config.randomization.rotation.range, x: parseFloat(e.target.value) }
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
                      value={config.randomization.rotation.range.y}
                      onChange={(e) => updateRandomization({
                        rotation: {
                          ...config.randomization.rotation,
                          range: { ...config.randomization.rotation.range, y: parseFloat(e.target.value) }
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
                      value={config.randomization.rotation.range.z}
                      onChange={(e) => updateRandomization({
                        rotation: {
                          ...config.randomization.rotation,
                          range: { ...config.randomization.rotation.range, z: parseFloat(e.target.value) }
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
                    checked={config.randomization.scale.enabled}
                    onChange={(e) => updateRandomization({ 
                      scale: { ...config.randomization.scale, enabled: e.target.checked } 
                    })}
                    className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                  />
                </div>
                
                <div className={cn("space-y-2", !config.randomization.scale.enabled && "opacity-50 pointer-events-none")}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.randomization.scale.uniform}
                      onChange={(e) => updateRandomization({
                        scale: { ...config.randomization.scale, uniform: e.target.checked }
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
                        value={config.randomization.scale.range.min}
                        onChange={(e) => updateRandomization({
                          scale: {
                            ...config.randomization.scale,
                            range: { ...config.randomization.scale.range, min: parseFloat(e.target.value) }
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
                        value={config.randomization.scale.range.max}
                        onChange={(e) => updateRandomization({
                          scale: {
                            ...config.randomization.scale,
                            range: { ...config.randomization.scale.range, max: parseFloat(e.target.value) }
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
                  {config.camera.positions.map((pos, index) => (
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
                        disabled={config.camera.positions.length <= 1}
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
                    value={config.camera.resolution.width}
                    onChange={(e) => updateCamera({
                      resolution: { ...config.camera.resolution, width: parseInt(e.target.value) }
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
                    value={config.camera.resolution.height}
                    onChange={(e) => updateCamera({
                      resolution: { ...config.camera.resolution, height: parseInt(e.target.value) }
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
                onClick={() => setShowAdvanced(!showAdvanced)}
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
                  value={config.generation.samples}
                  onChange={(e) => updateGeneration({ samples: parseInt(e.target.value) })}
                  min={1}
                  max={1000}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Total images: {config.generation.samples * config.camera.positions.length}
                </p>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">Output Format</label>
                <select
                  value={config.generation.outputFormat}
                  onChange={(e) => updateGeneration({ 
                    outputFormat: e.target.value as 'COCO' | 'PASCAL_VOC' | 'YOLO' 
                  })}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                >
                  <option value="COCO">COCO JSON</option>
                  <option value="PASCAL_VOC">PASCAL VOC</option>
                  <option value="YOLO">YOLO</option>
                </select>
              </div>
              
              {showAdvanced && (
                <div className="space-y-2 pt-2 border-t border-gray-700/50">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.generation.includeBoundingBoxes}
                      onChange={(e) => updateGeneration({ includeBoundingBoxes: e.target.checked })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Include Bounding Boxes</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.generation.includeSegmentationMaps}
                      onChange={(e) => updateGeneration({ includeSegmentationMaps: e.target.checked })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Include Segmentation Maps</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.generation.includeDepthMaps}
                      onChange={(e) => updateGeneration({ includeDepthMaps: e.target.checked })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Include Depth Maps</span>
                  </label>
                </div>
              )}
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
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/20 rounded-md text-sm text-blue-300 transition-colors"
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
      </div>
    </div>
  );
}

// Helper function to generate annotations for an image
function generateAnnotationsForImage(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  objectAnnotations: Record<string, { classId: string }>,
  annotationClasses: AnnotationClass[]
): SyntheticDataAnnotation[] {
  const annotations: SyntheticDataAnnotation[] = [];
  
  // Find all objects with annotations
  scene.traverse(obj => {
    // Skip objects without annotations
    if (!objectAnnotations[obj.uuid]) return;
    
    // Get annotation for this object
    const annotation = objectAnnotations[obj.uuid];
    if (!annotation) return;
    
    // Get class info
    const classInfo = annotationClasses.find(c => c.id === annotation.classId);
    if (!classInfo) return;
    
    // Calculate 3D bounding box
    const bbox = new THREE.Box3().setFromObject(obj);
    
    // Get corners of the bounding box
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
        x: (screenPos.x * 0.5 + 0.5) * renderer.domElement.width,
        y: (1 - (screenPos.y * 0.5 + 0.5)) * renderer.domElement.height
      };
    });
    
    // Find min/max X and Y
    const minX = Math.max(0, Math.min(...screenCorners.map(c => c.x)));
    const maxX = Math.min(renderer.domElement.width, Math.max(...screenCorners.map(c => c.x)));
    const minY = Math.max(0, Math.min(...screenCorners.map(c => c.y)));
    const maxY = Math.min(renderer.domElement.height, Math.max(...screenCorners.map(c => c.y)));
    
    // Skip if bounding box is outside the view
    if (maxX <= 0 || minX >= renderer.domElement.width || 
        maxY <= 0 || minY >= renderer.domElement.height) {
      return;
    }
    
    // Create annotation
    annotations.push({
      objectId: obj.uuid,
      classId: annotation.classId,
      className: classInfo.name,
      bbox: [minX, minY, maxX - minX, maxY - minY],
      segmentation: [[]], // Placeholder for segmentation
      area: (maxX - minX) * (maxY - minY),
      iscrowd: 0
    });
  });
  
  return annotations;
}