import * as THREE from 'three';
import { AnnotationClass } from '../../types/annotation';
import { SyntheticDataImage, SyntheticDataAnnotation } from './exporters';

export interface RandomizationSettings {
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

export interface CameraSettings {
  positions: Array<{ x: number; y: number; z: number }>;
  fov: number;
  near: number;
  far: number;
  resolution: { width: number; height: number };
}

export async function generateSyntheticData(
  objects: THREE.Object3D[],
  annotationClasses: AnnotationClass[],
  objectAnnotations: Record<string, { classId: string }>,
  randomizationSettings: RandomizationSettings,
  cameraSettings: CameraSettings,
  numSamples: number,
  onProgress: (progress: number) => void,
  onPreview: (imageUrl: string) => void
): Promise<SyntheticDataImage[]> {
  const result: SyntheticDataImage[] = [];
  
  // Create a renderer with proper configuration
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    preserveDrawingBuffer: true, // Important for image capture
    alpha: true
  });
  renderer.setSize(cameraSettings.resolution.width, cameraSettings.resolution.height);
  renderer.setPixelRatio(1); // Use a consistent pixel ratio
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  // Create a camera
  const camera = new THREE.PerspectiveCamera(
    cameraSettings.fov,
    cameraSettings.resolution.width / cameraSettings.resolution.height,
    cameraSettings.near,
    cameraSettings.far
  );
  
  // Create a temporary DOM element to attach the renderer
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '-9999px';
  document.body.appendChild(tempContainer);
  tempContainer.appendChild(renderer.domElement);
  
  try {
    console.log('Starting synthetic data generation with settings:', {
      resolution: cameraSettings.resolution,
      numSamples,
      cameraCount: cameraSettings.positions.length
    });
    
    // Generate the specified number of samples
    for (let i = 0; i < numSamples; i++) {
      // Create a randomized scene
      const scene = createRandomizedScene(
        objects,
        objectAnnotations,
        randomizationSettings
      );
      
      // Add default lighting to ensure visibility
      addDefaultLighting(scene);
      
      // Set background color (not black)
      scene.background = new THREE.Color(0x808080); // Medium gray
      
      // For each camera position
      for (let j = 0; j < cameraSettings.positions.length; j++) {
        const cameraPos = cameraSettings.positions[j];
        camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
        camera.lookAt(0, 0, 0);
        
        // Force camera update
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        
        // Ensure renderer is properly sized
        renderer.setSize(cameraSettings.resolution.width, cameraSettings.resolution.height);
        
        // Render the scene
        renderer.render(scene, camera);
        
        // Get the rendered image
        const imageDataUrl = renderer.domElement.toDataURL('image/png');
        
        // Verify image data is valid
        if (!imageDataUrl || imageDataUrl === 'data:,') {
          console.error('Failed to capture image data');
          continue;
        }
        
        // Log image capture
        console.log(`Captured image for sample ${i}, camera ${j}:`, {
          dataUrlLength: imageDataUrl.length,
          startsWithData: imageDataUrl.startsWith('data:image/png;base64,')
        });
        
        // Generate annotations for this image
        const annotations = generateAnnotationsForImage(
          scene,
          camera,
          renderer,
          objectAnnotations,
          annotationClasses
        );
        
        // Add to result
        const imageId = `sample_${i}_camera_${j}`;
        result.push({
          id: imageId,
          dataUrl: imageDataUrl,
          width: cameraSettings.resolution.width,
          height: cameraSettings.resolution.height,
          cameraPosition: camera.position.clone(),
          cameraRotation: camera.rotation.clone(),
          annotations
        });
        
        // Update progress
        const progress = ((i * cameraSettings.positions.length + j + 1) / 
                         (numSamples * cameraSettings.positions.length)) * 100;
        onProgress(progress);
        
        // Set preview image for the first render
        if (i === 0 && j === 0) {
          onPreview(imageDataUrl);
        }
        
        // Allow UI to update by yielding to the event loop
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Clean up scene
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    
    return result;
  } finally {
    // Clean up
    renderer.dispose();
    document.body.removeChild(tempContainer);
  }
}

function addDefaultLighting(scene: THREE.Scene): void {
  // Add ambient light to ensure basic visibility
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Add directional light for shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
}

function createRandomizedScene(
  objects: THREE.Object3D[],
  objectAnnotations: Record<string, { classId: string }>,
  randomizationSettings: RandomizationSettings
): THREE.Scene {
  const scene = new THREE.Scene();
  
  // Clone and randomize objects
  objects.forEach(obj => {
    if (!obj) return;
    
    // Skip lights and cameras for now
    if (obj.userData.isLight || obj.userData.isCamera) return;
    
    // Only include annotated objects
    if (!objectAnnotations[obj.uuid]) return;
    
    // Create a clone of the object
    const clone = obj.clone();
    
    // Preserve the original UUID for annotation lookup
    clone.userData.originalUuid = obj.uuid;
    
    // Randomize position
    if (randomizationSettings.position.enabled) {
      const { x, y, z } = randomizationSettings.position.range;
      clone.position.x += (Math.random() - 0.5) * x * 2;
      clone.position.y = Math.max(0, clone.position.y + (Math.random() - 0.5) * y * 2);
      clone.position.z += (Math.random() - 0.5) * z * 2;
    }
    
    // Randomize rotation
    if (randomizationSettings.rotation.enabled) {
      const { x, y, z } = randomizationSettings.rotation.range;
      clone.rotation.x += (Math.random() - 0.5) * (x * Math.PI / 180) * 2;
      clone.rotation.y += (Math.random() - 0.5) * (y * Math.PI / 180) * 2;
      clone.rotation.z += (Math.random() - 0.5) * (z * Math.PI / 180) * 2;
    }
    
    // Randomize scale
    if (randomizationSettings.scale.enabled) {
      const { min, max } = randomizationSettings.scale.range;
      const scaleFactor = min + Math.random() * (max - min);
      
      if (randomizationSettings.scale.uniform) {
        clone.scale.set(
          clone.scale.x * scaleFactor,
          clone.scale.y * scaleFactor,
          clone.scale.z * scaleFactor
        );
      } else {
        clone.scale.x *= min + Math.random() * (max - min);
        clone.scale.y *= min + Math.random() * (max - min);
        clone.scale.z *= min + Math.random() * (max - min);
      }
    }
    
    // Ensure shadows are enabled
    if (clone instanceof THREE.Mesh) {
      clone.castShadow = true;
      clone.receiveShadow = true;
    }
    
    scene.add(clone);
  });
  
  // Add randomized lights
  objects.forEach(obj => {
    if (!obj || !obj.userData.isLight) return;
    
    const clone = obj.clone();
    
    if (randomizationSettings.lighting.enabled && obj instanceof THREE.Light) {
      const { min, max } = randomizationSettings.lighting.intensityRange;
      const intensityFactor = min + Math.random() * (max - min);
      clone.intensity = obj.intensity * intensityFactor;
      
      // Randomize color slightly
      const colorVar = randomizationSettings.lighting.colorVariation;
      if (colorVar > 0) {
        const color = obj.color.clone();
        color.r = THREE.MathUtils.clamp(color.r + (Math.random() - 0.5) * colorVar * 2, 0, 1);
        color.g = THREE.MathUtils.clamp(color.g + (Math.random() - 0.5) * colorVar * 2, 0, 1);
        color.b = THREE.MathUtils.clamp(color.b + (Math.random() - 0.5) * colorVar * 2, 0, 1);
        clone.color.copy(color);
      }
    }
    
    scene.add(clone);
  });
  
  // Add a ground plane to ensure objects have something to cast shadows on
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xcccccc,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01; // Slightly below zero to avoid z-fighting
  ground.receiveShadow = true;
  scene.add(ground);
  
  return scene;
}

function generateAnnotationsForImage(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  objectAnnotations: Record<string, { classId: string }>,
  annotationClasses: AnnotationClass[]
): SyntheticDataAnnotation[] {
  const annotations: SyntheticDataAnnotation[] = [];
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  
  // Find all objects with annotations
  scene.traverse(obj => {
    // Skip objects without original UUID
    if (!obj.userData.originalUuid) return;
    
    // Get annotation for this object
    const annotation = objectAnnotations[obj.userData.originalUuid];
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
        x: Math.round((screenPos.x * 0.5 + 0.5) * width),
        y: Math.round((1 - (screenPos.y * 0.5 + 0.5)) * height)
      };
    });
    
    // Find min/max X and Y
    const minX = Math.max(0, Math.min(...screenCorners.map(c => c.x)));
    const maxX = Math.min(width, Math.max(...screenCorners.map(c => c.x)));
    const minY = Math.max(0, Math.min(...screenCorners.map(c => c.y)));
    const maxY = Math.min(height, Math.max(...screenCorners.map(c => c.y)));
    
    // Skip if bounding box is outside the view
    if (maxX <= 0 || minX >= width || maxY <= 0 || minY >= height) {
      return;
    }
    
    // Skip if bounding box is too small
    if ((maxX - minX) < 5 || (maxY - minY) < 5) {
      return;
    }
    
    // Create annotation
    annotations.push({
      objectId: obj.userData.originalUuid,
      classId: annotation.classId,
      className: classInfo.name,
      bbox: [minX, minY, maxX - minX, maxY - minY],
      segmentation: [], // Would require more complex calculation
      area: (maxX - minX) * (maxY - minY),
      iscrowd: 0
    });
  });
  
  return annotations;
}