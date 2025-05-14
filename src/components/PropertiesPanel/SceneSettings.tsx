import { useEditorStore } from '../../store/editorStore';
import { getHDRIUrl } from '../../utils/environment/hdriLoader';
import { Eye, EyeOff, Film, Settings, Palette, Save, Code, Camera, Cpu } from 'lucide-react';
import { Section } from './Section';
import { PostProcessingSettings } from './PostProcessingSettings';
import { CapturePanel } from './CapturePanel';
import { SavedDataSettings } from './SavedDataSettings';
import { MaterialAssets } from './MaterialAssets';
import { ShaderAssets } from './ShaderAssets';
import { SyntheticDataSettings } from './SyntheticDataSettings';

export default function SceneSettings() {
  const sceneSettings = useEditorStore((state) => state.sceneSettings);
  const updateSceneSettings = useEditorStore((state) => state.updateSceneSettings);
  
  const handleEnvMapChange = async (preset: string) => {
    const url = await getHDRIUrl(preset as any);
    updateSceneSettings({
      envMap: {
        ...(sceneSettings.envMap || { enabled: true, intensity: 1.0 }),
        preset,
        url
      }
    });
  };

  return (
    <div className="space-y-4">
      <Section title="Scene" icon={<Settings className="w-4 h-4" />} id="scene">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-300">Grid</h3>
              <button
                onClick={() => updateSceneSettings({ showGrid: !sceneSettings.showGrid })}
                className="p-1 hover:bg-gray-700 rounded"
                title={sceneSettings.showGrid ? "Hide Grid" : "Show Grid"}
              >
                {sceneSettings.showGrid ? (
                  <Eye className="w-4 h-4 text-gray-300" />
                ) : (
                  <EyeOff className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">Background Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={sceneSettings.backgroundColor}
                  onChange={(e) => updateSceneSettings({ backgroundColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={sceneSettings.backgroundColor}
                  onChange={(e) => updateSceneSettings({ backgroundColor: e.target.value })}
                  className="flex-1 p-1 bg-gray-800 border border-gray-700 rounded text-gray-200"
                />
              </div>
            </div>
          </div>
          
          {/* Environment Map Settings */}
          <div className="space-y-2">
            <h3 className="font-medium text-gray-300 mb-2">Environment Map</h3>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={sceneSettings.envMap?.enabled}
                  onChange={(e) => updateSceneSettings({
                    envMap: {
                      ...(sceneSettings.envMap || { preset: 'studio', intensity: 1.0 }),
                      enabled: e.target.checked
                    }
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500"
                />
                Enable Environment Map
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={sceneSettings.envMap?.showBackground}
                  onChange={(e) => updateSceneSettings({
                    envMap: {
                      ...(sceneSettings.envMap || { preset: 'studio', intensity: 1.0, enabled: true }),
                      showBackground: e.target.checked
                    }
                  })}
                  className="rounded border-gray-700 checked:bg-blue-500"
                  disabled={!sceneSettings.envMap?.enabled}
                />
                Show as Background
              </label>
            </div>
            
            {sceneSettings.envMap?.enabled && (
              <>
                <div>
                  <select
                    value={sceneSettings.envMap?.preset || 'studio'}
                    onChange={(e) => handleEnvMapChange(e.target.value)}
                    className="w-full"
                  >
                    <option value="studio">Studio</option>
                    <option value="city">City</option>
                    <option value="apartment">Apartment</option>
                    <option value="dawn">Dawn</option>
                    <option value="forest">Forest</option>
                    <option value="lobby">Lobby</option>
                    <option value="night">Night</option>
                    <option value="park">Park</option>
                    <option value="sunset">Sunset</option>
                    <option value="warehouse">Warehouse</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title="Post Processing" icon={<Film className="w-4 h-4" />} id="post-processing">
        <PostProcessingSettings />
      </Section>
      
      <Section title="Material Assets" icon={<Palette className="w-4 h-4" />} id="material-assets">
        <MaterialAssets />
      </Section>
      
      <Section title="Shader Assets" icon={<Code className="w-4 h-4" />} id="shader-assets">
        <ShaderAssets />
      </Section>
      
      <Section title="AI Capture" icon={<Camera className="w-4 h-4" />} id="capture">
        <CapturePanel />
      </Section>
      
      <Section title="Synthetic Data" icon={<Cpu className="w-4 h-4" />} id="synthetic-data">
        <SyntheticDataSettings />
      </Section>
      
      <Section title="Saved Data" icon={<Save className="w-4 h-4" />} id="saved-data">
        <SavedDataSettings />
      </Section>
    </div>
  );
}