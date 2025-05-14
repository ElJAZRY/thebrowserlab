import { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useEditorStore } from '../store/editorStore';
import { TransformControls3D } from './Scene/TransformControls3D';
import Scene from './Scene';
import { PostProcessing } from './Scene/PostProcessing';
import Timeline from './Timeline/index';
import { ContextMenu } from './ContextMenu';
import { SelectionController } from './Scene/SelectionBox/SelectionController';
import { SelectionBoxOverlay } from './Scene/SelectionBox/SelectionBoxOverlay';
import * as THREE from 'three';
import { ChatInterface } from './ChatInterface';
import { CameraPreviewPanel } from './CameraPreviewPanel';
import { CodeHistoryPanel } from './CodeHistoryPanel';
import { XRButton } from './XRButton';
import { useAnnotationStore } from '../store/annotationStore';
import { updateAllVisualizations } from '../utils/annotation/visualization';

const useSelectionState = () => {
  return useEditorStore((state) => ({
    isSelecting: state.isSelecting,
    startPoint: state.selectionStart,
    endPoint: state.selectionEnd
  }));
};

export default function Viewport() {
  const sceneSettings = useEditorStore((state) => state.sceneSettings);
  const selectionState = useSelectionState();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const duplicateObject = useEditorStore((state) => state.duplicateObject);
  const removeObject = useEditorStore((state) => state.removeObject);
  const [isARSupported, setIsARSupported] = useState(false);
  const objects = useEditorStore((state) => state.objects);
  const objectAnnotations = useAnnotationStore((state) => state.objectAnnotations);
  const annotationClasses = useAnnotationStore((state) => state.annotationClasses);

  useEffect(() => {
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-ar')
        .then(supported => setIsARSupported(supported))
        .catch(err => console.warn('AR support check failed:', err));
    }
  }, []);
  
  const removeObjects = useEditorStore((state) => state.removeObjects);
  const selectedObject = useEditorStore((state) => state.selectedObject);
  const selectedObjects = useEditorStore((state) => state.selectedObjects);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey && selectedObject) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, [selectedObject]);
  
  // Update visualizations when annotations or objects change
  useEffect(() => {
    updateAllVisualizations(objects);
  }, [objects, objectAnnotations, annotationClasses]);
  
  return (
    <div className="flex-1 relative" onContextMenu={handleContextMenu}>
      {isARSupported && <XRButton />}
      <Canvas 
        onCreated={({ gl, scene, camera }) => {
          // Store references globally for capture
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.xr.setFramebufferScaleFactor(2.0); // Higher quality for AR
          gl.setClearColor(sceneSettings.backgroundColor);
          gl.xr.enabled = true;
          gl.alpha = true; // Enable alpha for AR passthrough
          
          (window as any).__THREE_RENDERER__ = gl;
          (window as any).__THREE_SCENE__ = scene;
          (window as any).__THREE_CAMERA__ = camera;
          
          // Set up AR reference space
          gl.xr.addEventListener('sessionstart', () => {
            gl.xr.setReferenceSpaceType('local');
          });
        }}
        shadows
        shadows="soft"
        gl={{ alpha: true }} // Enable alpha for AR passthrough
        camera={{ position: [5, 5, 5], fov: 50, near: 0.1, far: 1000 }}
      >
        <color attach="background" args={[sceneSettings.backgroundColor]} />
        <Scene />
        <OrbitControls
          makeDefault
          mouseButtons={{
            LEFT: undefined,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.ROTATE // Keep right-click for orbit
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_ROTATE
          }}
          enablePan={true}
          keyPanSpeed={10}
          panSpeed={1.5}
          enableDamping={true}
          dampingFactor={0.05}
        />
        <TransformControls3D />
        <GizmoHelper
          alignment="bottom-right"
          margin={[60, 120]}
          renderPriority={2}
        >
          <GizmoViewport
            axisColors={['#ff3653', '#0adb50', '#2c8fdf']}
            labelColor="white"
          />
        </GizmoHelper>
        <PostProcessing />
        <SelectionController />
      </Canvas>
      <SelectionBoxOverlay {...selectionState} />
      <CodeHistoryPanel />
      <CameraPreviewPanel />
      {contextMenu && selectedObject && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDuplicate={() => duplicateObject(selectedObject)}
          onDelete={() => {
            if (selectedObjects.size > 1) {
              removeObjects(Array.from(selectedObjects));
            } else {
              removeObject(selectedObject);
            }
          }}
        />
      )}
    </div>
  );
}