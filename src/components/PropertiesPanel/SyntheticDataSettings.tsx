import { useState } from 'react';
import { useSyntheticDataStore } from '../../store/syntheticDataStore';
import { useEditorStore } from '../../store/editorStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { cn } from '../../utils/cn';
import { Camera, Cpu, Download, Plus, Minus, RefreshCw, Settings, Sliders } from 'lucide-react';
import { exportAsCOCO, exportAsPascalVOC, exportAsYOLO } from '../../utils/syntheticData/exporters';
import { downloadSyntheticDataZip } from '../../utils/syntheticData/zipExport';

export function SyntheticDataSettings() {
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
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Check if we have annotated objects
  const annotatedObjectsCount = Object.keys(objectAnnotations).length;
  const hasAnnotatedObjects = annotatedObjectsCount > 0;
  
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
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-blue-300">Synthetic Data Generator</h3>
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Generate synthetic data for machine learning by randomizing scene objects and capturing from multiple camera angles.
        </p>
        
        {!hasAnnotatedObjects && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2 mt-2 text-xs text-yellow-300">
            No annotated objects found. Please annotate objects before generating synthetic data.
          </div>
        )}
      </div>
      
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
          
          {/* Lighting Randomization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Lighting Variation</label>
              <input
                type="checkbox"
                checked={config.randomization.lighting.enabled}
                onChange={(e) => updateRandomization({ 
                  lighting: { ...config.randomization.lighting, enabled: e.target.checked } 
                })}
                className="rounded border-gray-700 checked:bg-blue-500 checked:border-blue-600"
              />
            </div>
            
            <div className={cn("space-y-2", !config.randomization.lighting.enabled && "opacity-50 pointer-events-none")}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Min Intensity</label>
                  <input
                    type="number"
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
                    step={0.1}
                    min={0.1}
                    max={2}
                    className="w-full py-1 px-2 bg-gray-800/40 border border-gray-700/50 rounded text-xs text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Max Intensity</label>
                  <input
                    type="number"
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
                    step={0.1}
                    min={0.1}
                    max={2}
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
                  className="w-full h-1.5 mt-1"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>None</span>
                  <span>{config.randomization.lighting.colorVariation.toFixed(2)}</span>
                  <span>High</span>
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
              max={100}
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
      
      {/* Generate Button */}
      <div className="pt-3 border-t border-gray-700/50">
        <button
          onClick={() => {
            // Open the full panel
            const toggleButton = document.querySelector('button[class*="bottom-20 right-3"]') as HTMLButtonElement;
            if (toggleButton) toggleButton.click();
          }}
          disabled={!hasAnnotatedObjects}
          className={cn(
            "w-full py-2 rounded-md text-sm transition-colors",
            hasAnnotatedObjects 
              ? "bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/20 text-blue-300" 
              : "bg-gray-700/20 border border-gray-700/20 text-gray-500 cursor-not-allowed"
          )}
        >
          Open Synthetic Data Generator
        </button>
        
        {!hasAnnotatedObjects && (
          <p className="text-xs text-yellow-300 mt-2 text-center">
            Please annotate objects first
          </p>
        )}
      </div>
    </div>
  );
}