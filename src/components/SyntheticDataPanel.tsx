import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useAnnotationStore } from '../store/annotationStore';
import { useSyntheticDataStore } from '../store/syntheticDataStore';
import { cn } from '../utils/cn';
import { 
  X, Camera, Sliders, Settings, Download, Cpu, 
  RotateCw, Move, Maximize, Sun, Plus, Minus, 
  RefreshCw, Undo, Save, Upload, Play, Pause
} from 'lucide-react';
import { 
  generateSyntheticData, 
  RandomizationSettings, 
  CameraSettings 
} from '../utils/syntheticData/generators';
import { 
  exportAsCOCO, 
  exportAsPascalVOC, 
  exportAsYOLO,
  SyntheticDataImage
} from '../utils/syntheticData/exporters';
import * as THREE from 'three';
import JSZip from 'jszip';

export function SyntheticDataPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'randomization' | 'camera' | 'generation'>('randomization');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<SyntheticDataImage[] | null>(null);
  const [generatedDataFormat, setGeneratedDataFormat] = useState<any | null>(null);
  const [originalTransforms, setOriginalTransforms] = useState<Map<string, {
    position: THREE.Vector3,
    rotation: THREE.Euler,
    scale: THREE.Vector3
  }>>(new Map());
  const [isRandomized, setIsRandomized] = useState(false);

  // Get objects and annotations from stores
  const objects = useEditorStore((state) => state.objects);
  const annotationClasses = useAnnotationStore((state) => state.annotationClasses);
  const objectAnnotations = useAnnotationStore((state) => state.objectAnnotations);
  
  // Get synthetic data config from store
  const config = useSyntheticDataStore((state) => state.config);
  const updateRandomization = useSyntheticDataStore((state) => state.updateRandomization);
  const updateCamera = useSyntheticDataStore((state) => state.updateCamera);
  const updateGeneration = useSyntheticDataStore((state) => state.updateGeneration);

  // Store original transforms when component mounts
  useEffect(() => {
    const transforms = new Map();
    objects.forEach(obj => {
      if (!obj) return;
      transforms.set(obj.uuid, {
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone()
      });
    });
    setOriginalTransforms(transforms);
  }, [objects]);

  // Restore original transforms when component unmounts
  useEffect(() => {
    return () => {
      if (isRandomized) {
        restoreOriginalScene();
      }
    };
  }, [isRandomized]);

  const randomizeScene = () => {
    // Store original transforms if not already stored
    if (!isRandomized) {
      const transforms = new Map();
      objects.forEach(obj => {
        if (!obj) return;
        transforms.set(obj.uuid, {
          position: obj.position.clone(),
          rotation: obj.rotation.clone(),
          scale: obj.scale.clone()
        });
      });
      setOriginalTransforms(transforms);
    }

    // Apply randomization to actual scene objects
    objects.forEach(obj => {
      if (!obj) return;
      
      // Skip lights and cameras for now
      if (obj.userData.isLight || obj.userData.isCamera) return;
      
      // Randomize position
      if (config.randomization.position.enabled) {
        const { x, y, z } = config.randomization.position.range;
        obj.position.x += (Math.random() - 0.5) * x * 2;
        obj.position.y += (Math.random() - 0.5) * y * 2;
        obj.position.z += (Math.random() - 0.5) * z * 2;
      }
      
      // Randomize rotation
      if (config.randomization.rotation.enabled) {
        const { x, y, z } = config.randomization.rotation.range;
        obj.rotation.x += (Math.random() - 0.5) * (x * Math.PI / 180) * 2;
        obj.rotation.y += (Math.random() - 0.5) * (y * Math.PI / 180) * 2;
        obj.rotation.z += (Math.random() - 0.5) * (z * Math.PI / 180) * 2;
      }
      
      // Randomize scale
      if (config.randomization.scale.enabled) {
        const { min, max } = config.randomization.scale.range;
        const scaleFactor = min + Math.random() * (max - min);
        
        if (config.randomization.scale.uniform) {
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
    });

    // Randomize lights
    if (config.randomization.lighting.enabled) {
      objects.forEach(obj => {
        if (!obj || !obj.userData.isLight) return;
        
        if (obj instanceof THREE.Light) {
          const { min, max } = config.randomization.lighting.intensityRange;
          const intensityFactor = min + Math.random() * (max - min);
          obj.intensity *= intensityFactor;
          
          // Randomize color slightly
          const colorVar = config.randomization.lighting.colorVariation;
          if (colorVar > 0) {
            const color = obj.color.clone();
            color.r += (Math.random() - 0.5) * colorVar * 2;
            color.g += (Math.random() - 0.5) * colorVar * 2;
            color.b += (Math.random() - 0.5) * colorVar * 2;
            obj.color.copy(color);
          }
        }
      });
    }

    // Update scene
    useEditorStore.getState().updateTransform();
    setIsRandomized(true);

    // Capture preview image
    setTimeout(() => {
      capturePreviewImage();
    }, 100);
  };

  const restoreOriginalScene = () => {
    objects.forEach(obj => {
      if (!obj) return;
      
      const originalTransform = originalTransforms.get(obj.uuid);
      if (originalTransform) {
        obj.position.copy(originalTransform.position);
        obj.rotation.copy(originalTransform.rotation);
        obj.scale.copy(originalTransform.scale);
      }
    });
    
    // Update scene
    useEditorStore.getState().updateTransform();
    setIsRandomized(false);
    setPreviewImage(null);
  };

  const capturePreviewImage = () => {
    const renderer = (window as any).__THREE_RENDERER__;
    const scene = (window as any).__THREE_SCENE__;
    const camera = (window as any).__THREE_CAMERA__;
    
    if (!renderer || !scene || !camera) {
      console.warn('Cannot capture preview: renderer, scene, or camera not found');
      return;
    }
    
    try {
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');
      setPreviewImage(dataUrl);
    } catch (error) {
      console.error('Error capturing preview:', error);
    }
  };

  const generateData = async () => {
    setIsGenerating(true);
    setProgress(0);
    setGeneratedData(null);
    setGeneratedDataFormat(null);
    
    try {
      // Generate synthetic data
      const data = await generateSyntheticData(
        objects,
        annotationClasses,
        objectAnnotations,
        config.randomization,
        config.camera,
        config.generation.samples,
        (progress) => setProgress(progress),
        (imageUrl) => setPreviewImage(imageUrl)
      );
      
      setGeneratedData(data);
      
      // Export in the selected format
      let formattedData;
      switch (config.generation.outputFormat) {
        case 'COCO':
          formattedData = exportAsCOCO(data, annotationClasses);
          break;
        case 'PASCAL_VOC':
          formattedData = exportAsPascalVOC(data, annotationClasses);
          break;
        case 'YOLO':
          formattedData = exportAsYOLO(data, annotationClasses);
          break;
      }
      
      setGeneratedDataFormat(formattedData);
    } catch (error) {
      console.error('Error generating synthetic data:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadGeneratedData = async () => {
    if (!generatedData || !generatedDataFormat) return;
    
    try {
      // Create a zip file
      const zip = new JSZip();
      
      // Add JSON data
      zip.file('annotations.json', JSON.stringify(generatedDataFormat, null, 2));
      
      // Create images folder
      const imagesFolder = zip.folder('images');
      
      // Add images
      generatedData.forEach(image => {
        // Convert data URL to blob
        const dataUrl = image.dataUrl;
        const byteString = atob(dataUrl.split(',')[1]);
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        
        const blob = new Blob([ab], { type: mimeString });
        imagesFolder.file(`${image.id}.png`, blob);
      });
      
      // Generate zip file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'synthetic_data.zip';
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading data:', error);
    }
  };

  const exportConfig = () => {
    const configJson = JSON.stringify(config, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'synthetic_data_config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        useSyntheticDataStore.getState().updateConfig(config);
      } catch (error) {
        console.error('Error importing config:', error);
      }
    };
    reader.readAsText(file);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn(
      "fixed right-3 top-20 z-50 bg-[#252526]/90 backdrop-blur-sm rounded-lg",
      "border border-gray-700/50 text-xs transition-all duration-200",
      isOpen ? "w-[350px]" : "w-[40px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700/50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 hover:bg-gray-700/50 rounded text-gray-400"
        >
          <Cpu className="w-4 h-4" />
        </button>
        {isOpen && (
          <>
            <h3 className="text-sm font-medium text-gray-300">Synthetic Data Generator</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-gray-700/50 rounded text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {isOpen && (
        <div className="p-3">
          {/* Tabs */}
          <div className="flex border-b border-gray-700/50 mb-3">
            <button
              onClick={() => setActiveTab('randomization')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === 'randomization'
                  ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              Randomization
            </button>
            <button
              onClick={() => setActiveTab('camera')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === 'camera'
                  ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              Camera
            </button>
            <button
              onClick={() => setActiveTab('generation')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === 'generation'
                  ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              Generation
            </button>
          </div>

          {/* Randomization Tab */}
          {activeTab === 'randomization' && (
            <div className="space-y-4">
              {/* Enable Randomization */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Enable Randomization</label>
                <div className="relative inline-block w-10 h-5 select-none">
                  <input
                    type="checkbox"
                    className="opacity-0 w-0 h-0"
                    checked={config.randomization.enabled}
                    onChange={(e) => updateRandomization({ enabled: e.target.checked })}
                  />
                  <span
                    className={cn(
                      "absolute cursor-pointer inset-0 rounded-full transition-colors",
                      config.randomization.enabled ? "bg-blue-500" : "bg-gray-700"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute h-4 w-4 rounded-full bg-white transition-transform",
                        "top-0.5 left-0.5",
                        config.randomization.enabled && "transform translate-x-5"
                      )}
                    />
                  </span>
                </div>
              </div>

              {/* Position Randomization */}
              <div className={cn(
                "space-y-2 p-2 rounded border border-gray-700/50",
                !config.randomization.enabled && "opacity-50 pointer-events-none"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Move className="w-3.5 h-3.5 text-gray-500" />
                    <label className="text-xs text-gray-400">Position Randomization</label>
                  </div>
                  <div className="relative inline-block w-8 h-4 select-none">
                    <input
                      type="checkbox"
                      className="opacity-0 w-0 h-0"
                      checked={config.randomization.position.enabled}
                      onChange={(e) => updateRandomization({
                        position: { ...config.randomization.position, enabled: e.target.checked }
                      })}
                    />
                    <span
                      className={cn(
                        "absolute cursor-pointer inset-0 rounded-full transition-colors",
                        config.randomization.position.enabled ? "bg-blue-500" : "bg-gray-700"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute h-3 w-3 rounded-full bg-white transition-transform",
                          "top-0.5 left-0.5",
                          config.randomization.position.enabled && "transform translate-x-4"
                        )}
                      />
                    </span>
                  </div>
                </div>

                {config.randomization.position.enabled && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">X Range</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={config.randomization.position.range.x}
                        onChange={(e) => updateRandomization({
                          position: {
                            ...config.randomization.position,
                            range: {
                              ...config.randomization.position.range,
                              x: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Y Range</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={config.randomization.position.range.y}
                        onChange={(e) => updateRandomization({
                          position: {
                            ...config.randomization.position,
                            range: {
                              ...config.randomization.position.range,
                              y: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Z Range</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={config.randomization.position.range.z}
                        onChange={(e) => updateRandomization({
                          position: {
                            ...config.randomization.position,
                            range: {
                              ...config.randomization.position.range,
                              z: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Rotation Randomization */}
              <div className={cn(
                "space-y-2 p-2 rounded border border-gray-700/50",
                !config.randomization.enabled && "opacity-50 pointer-events-none"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-3.5 h-3.5 text-gray-500" />
                    <label className="text-xs text-gray-400">Rotation Randomization</label>
                  </div>
                  <div className="relative inline-block w-8 h-4 select-none">
                    <input
                      type="checkbox"
                      className="opacity-0 w-0 h-0"
                      checked={config.randomization.rotation.enabled}
                      onChange={(e) => updateRandomization({
                        rotation: { ...config.randomization.rotation, enabled: e.target.checked }
                      })}
                    />
                    <span
                      className={cn(
                        "absolute cursor-pointer inset-0 rounded-full transition-colors",
                        config.randomization.rotation.enabled ? "bg-blue-500" : "bg-gray-700"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute h-3 w-3 rounded-full bg-white transition-transform",
                          "top-0.5 left-0.5",
                          config.randomization.rotation.enabled && "transform translate-x-4"
                        )}
                      />
                    </span>
                  </div>
                </div>

                {config.randomization.rotation.enabled && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">X Range (°)</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        step="5"
                        value={config.randomization.rotation.range.x}
                        onChange={(e) => updateRandomization({
                          rotation: {
                            ...config.randomization.rotation,
                            range: {
                              ...config.randomization.rotation.range,
                              x: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Y Range (°)</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        step="5"
                        value={config.randomization.rotation.range.y}
                        onChange={(e) => updateRandomization({
                          rotation: {
                            ...config.randomization.rotation,
                            range: {
                              ...config.randomization.rotation.range,
                              y: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Z Range (°)</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        step="5"
                        value={config.randomization.rotation.range.z}
                        onChange={(e) => updateRandomization({
                          rotation: {
                            ...config.randomization.rotation,
                            range: {
                              ...config.randomization.rotation.range,
                              z: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Scale Randomization */}
              <div className={cn(
                "space-y-2 p-2 rounded border border-gray-700/50",
                !config.randomization.enabled && "opacity-50 pointer-events-none"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Maximize className="w-3.5 h-3.5 text-gray-500" />
                    <label className="text-xs text-gray-400">Scale Randomization</label>
                  </div>
                  <div className="relative inline-block w-8 h-4 select-none">
                    <input
                      type="checkbox"
                      className="opacity-0 w-0 h-0"
                      checked={config.randomization.scale.enabled}
                      onChange={(e) => updateRandomization({
                        scale: { ...config.randomization.scale, enabled: e.target.checked }
                      })}
                    />
                    <span
                      className={cn(
                        "absolute cursor-pointer inset-0 rounded-full transition-colors",
                        config.randomization.scale.enabled ? "bg-blue-500" : "bg-gray-700"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute h-3 w-3 rounded-full bg-white transition-transform",
                          "top-0.5 left-0.5",
                          config.randomization.scale.enabled && "transform translate-x-4"
                        )}
                      />
                    </span>
                  </div>
                </div>

                {config.randomization.scale.enabled && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-400">Uniform Scaling</label>
                      <div className="relative inline-block w-8 h-4 select-none">
                        <input
                          type="checkbox"
                          className="opacity-0 w-0 h-0"
                          checked={config.randomization.scale.uniform}
                          onChange={(e) => updateRandomization({
                            scale: { ...config.randomization.scale, uniform: e.target.checked }
                          })}
                        />
                        <span
                          className={cn(
                            "absolute cursor-pointer inset-0 rounded-full transition-colors",
                            config.randomization.scale.uniform ? "bg-blue-500" : "bg-gray-700"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute h-3 w-3 rounded-full bg-white transition-transform",
                              "top-0.5 left-0.5",
                              config.randomization.scale.uniform && "transform translate-x-4"
                            )}
                          />
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Min Scale</label>
                        <input
                          type="number"
                          min="0.1"
                          max="2"
                          step="0.1"
                          value={config.randomization.scale.range.min}
                          onChange={(e) => updateRandomization({
                            scale: {
                              ...config.randomization.scale,
                              range: {
                                ...config.randomization.scale.range,
                                min: parseFloat(e.target.value)
                              }
                            }
                          })}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Max Scale</label>
                        <input
                          type="number"
                          min="0.1"
                          max="2"
                          step="0.1"
                          value={config.randomization.scale.range.max}
                          onChange={(e) => updateRandomization({
                            scale: {
                              ...config.randomization.scale,
                              range: {
                                ...config.randomization.scale.range,
                                max: parseFloat(e.target.value)
                              }
                            }
                          })}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lighting Randomization */}
              <div className={cn(
                "space-y-2 p-2 rounded border border-gray-700/50",
                !config.randomization.enabled && "opacity-50 pointer-events-none"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-gray-500" />
                    <label className="text-xs text-gray-400">Lighting Randomization</label>
                  </div>
                  <div className="relative inline-block w-8 h-4 select-none">
                    <input
                      type="checkbox"
                      className="opacity-0 w-0 h-0"
                      checked={config.randomization.lighting.enabled}
                      onChange={(e) => updateRandomization({
                        lighting: { ...config.randomization.lighting, enabled: e.target.checked }
                      })}
                    />
                    <span
                      className={cn(
                        "absolute cursor-pointer inset-0 rounded-full transition-colors",
                        config.randomization.lighting.enabled ? "bg-blue-500" : "bg-gray-700"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute h-3 w-3 rounded-full bg-white transition-transform",
                          "top-0.5 left-0.5",
                          config.randomization.lighting.enabled && "transform translate-x-4"
                        )}
                      />
                    </span>
                  </div>
                </div>

                {config.randomization.lighting.enabled && (
                  <div className="space-y-2 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Min Intensity</label>
                        <input
                          type="number"
                          min="0.1"
                          max="2"
                          step="0.1"
                          value={config.randomization.lighting.intensityRange.min}
                          onChange={(e) => updateRandomization({
                            lighting: {
                              ...config.randomization.lighting,
                              intensityRange: {
                                ...config.randomization.lighting.intensityRange,
                                min: parseFloat(e.target.value)
                              }
                            }
                          })}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Max Intensity</label>
                        <input
                          type="number"
                          min="0.1"
                          max="2"
                          step="0.1"
                          value={config.randomization.lighting.intensityRange.max}
                          onChange={(e) => updateRandomization({
                            lighting: {
                              ...config.randomization.lighting,
                              intensityRange: {
                                ...config.randomization.lighting.intensityRange,
                                max: parseFloat(e.target.value)
                              }
                            }
                          })}
                          className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Color Variation</label>
                      <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={config.randomization.lighting.colorVariation}
                        onChange={(e) => updateRandomization({
                          lighting: {
                            ...config.randomization.lighting,
                            colorVariation: parseFloat(e.target.value)
                          }
                        })}
                        className="w-full h-1.5"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>None</span>
                        <span>{(config.randomization.lighting.colorVariation * 100).toFixed(0)}%</span>
                        <span>Max</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Randomize Button */}
              <div className="flex gap-2">
                <button
                  onClick={randomizeScene}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/20 rounded-md text-xs text-blue-300 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Randomize Scene</span>
                </button>
                
                {isRandomized && (
                  <button
                    onClick={restoreOriginalScene}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-700/30 rounded-md text-xs text-gray-300 transition-colors"
                  >
                    <Undo className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                )}
              </div>

              {/* Preview Image */}
              {previewImage && (
                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-1">Preview:</div>
                  <div className="border border-gray-700/50 rounded overflow-hidden">
                    <img src={previewImage} alt="Preview" className="w-full h-auto" />
                  </div>
                </div>
              )}

              {/* Config Import/Export */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700/50">
                <button
                  onClick={exportConfig}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-700/30 rounded-md text-xs text-gray-300 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Export Config</span>
                </button>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-700/30 rounded-md text-xs text-gray-300 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Config</span>
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={importConfig}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Camera Tab */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              {/* Camera Positions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">Camera Positions</label>
                  <button
                    onClick={() => updateCamera({
                      positions: [
                        ...config.camera.positions,
                        { x: 0, y: 5, z: 5 }
                      ]
                    })}
                    className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {config.camera.positions.map((pos, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="grid grid-cols-3 gap-1 flex-1">
                        <div>
                          <input
                            type="number"
                            value={pos.x}
                            onChange={(e) => {
                              const newPositions = [...config.camera.positions];
                              newPositions[index] = {
                                ...newPositions[index],
                                x: parseFloat(e.target.value)
                              };
                              updateCamera({ positions: newPositions });
                            }}
                            className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                            placeholder="X"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={pos.y}
                            onChange={(e) => {
                              const newPositions = [...config.camera.positions];
                              newPositions[index] = {
                                ...newPositions[index],
                                y: parseFloat(e.target.value)
                              };
                              updateCamera({ positions: newPositions });
                            }}
                            className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                            placeholder="Y"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={pos.z}
                            onChange={(e) => {
                              const newPositions = [...config.camera.positions];
                              newPositions[index] = {
                                ...newPositions[index],
                                z: parseFloat(e.target.value)
                              };
                              updateCamera({ positions: newPositions });
                            }}
                            className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                            placeholder="Z"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newPositions = [...config.camera.positions];
                          newPositions.splice(index, 1);
                          updateCamera({ positions: newPositions });
                        }}
                        className="p-1 hover:bg-gray-700/50 rounded text-gray-400"
                        disabled={config.camera.positions.length <= 1}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Camera Settings */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 block mb-1">Camera Settings</label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">FOV</label>
                    <input
                      type="number"
                      min="10"
                      max="120"
                      value={config.camera.fov}
                      onChange={(e) => updateCamera({ fov: parseFloat(e.target.value) })}
                      className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Near Plane</label>
                    <input
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={config.camera.near}
                      onChange={(e) => updateCamera({ near: parseFloat(e.target.value) })}
                      className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Far Plane</label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      step="100"
                      value={config.camera.far}
                      onChange={(e) => updateCamera({ far: parseFloat(e.target.value) })}
                      className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                    />
                  </div>
                </div>
              </div>

              {/* Resolution Settings */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 block mb-1">Resolution</label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Width</label>
                    <input
                      type="number"
                      min="256"
                      max="4096"
                      step="64"
                      value={config.camera.resolution.width}
                      onChange={(e) => updateCamera({
                        resolution: {
                          ...config.camera.resolution,
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
                      min="256"
                      max="4096"
                      step="64"
                      value={config.camera.resolution.height}
                      onChange={(e) => updateCamera({
                        resolution: {
                          ...config.camera.resolution,
                          height: parseInt(e.target.value)
                        }
                      })}
                      className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generation Tab */}
          {activeTab === 'generation' && (
            <div className="space-y-4">
              {/* Number of Samples */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Number of Samples</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={config.generation.samples}
                  onChange={(e) => updateGeneration({ samples: parseInt(e.target.value) })}
                  className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                />
              </div>

              {/* Output Format */}
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
                  <option value="PASCAL_VOC">Pascal VOC</option>
                  <option value="YOLO">YOLO</option>
                </select>
              </div>

              {/* Include Options */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 block mb-1">Include</label>
                
                <div className="space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.generation.includeBoundingBoxes}
                      onChange={(e) => updateGeneration({ includeBoundingBoxes: e.target.checked })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Bounding Boxes</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.generation.includeSegmentationMaps}
                      onChange={(e) => updateGeneration({ includeSegmentationMaps: e.target.checked })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Segmentation Maps</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.generation.includeDepthMaps}
                      onChange={(e) => updateGeneration({ includeDepthMaps: e.target.checked })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Depth Maps</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.generation.includeKeypoints}
                      onChange={(e) => updateGeneration({ includeKeypoints: e.target.checked })}
                      className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
                    />
                    <span className="text-xs text-gray-400">Keypoints</span>
                  </label>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateData}
                disabled={isGenerating || annotationClasses.length === 0 || Object.keys(objectAnnotations).length === 0}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs transition-colors",
                  isGenerating
                    ? "bg-purple-500/20 text-purple-300 cursor-not-allowed"
                    : annotationClasses.length === 0 || Object.keys(objectAnnotations).length === 0
                      ? "bg-gray-700/30 text-gray-500 cursor-not-allowed"
                      : "bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/20 text-blue-300"
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-t-transparent border-purple-400 rounded-full animate-spin" />
                    <span>Generating... {progress.toFixed(0)}%</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Generate Synthetic Data</span>
                  </>
                )}
              </button>

              {/* Download Button */}
              {generatedData && generatedDataFormat && (
                <button
                  onClick={downloadGeneratedData}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/20 rounded-md text-xs text-green-300 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Data ({generatedData.length} images)</span>
                </button>
              )}

              {/* Warning if no annotations */}
              {(annotationClasses.length === 0 || Object.keys(objectAnnotations).length === 0) && (
                <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-200">
                  <p>⚠️ You need to create annotation classes and annotate objects before generating synthetic data.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}