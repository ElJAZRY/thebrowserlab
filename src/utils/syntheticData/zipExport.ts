import JSZip from 'jszip';
import { SyntheticDataImage } from './exporters';

/**
 * Creates a zip file containing the synthetic data images and annotations
 * @param images Array of synthetic data images
 * @param annotationsJson JSON data in the selected format (COCO, PASCAL VOC, YOLO)
 * @returns Blob containing the zip file
 */
export async function createSyntheticDataZip(
  images: SyntheticDataImage[],
  annotationsJson: any
): Promise<Blob> {
  const zip = new JSZip();
  
  // Add JSON data
  zip.file('annotations.json', JSON.stringify(annotationsJson, null, 2));
  
  // Create images folder
  const imagesFolder = zip.folder('images');
  
  // Add images
  for (const image of images) {
    try {
      // Convert data URL to blob
      const dataUrl = image.dataUrl;
      
      // Skip invalid data URLs
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        console.warn(`Skipping invalid image data for ${image.id}`);
        continue;
      }
      
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      imagesFolder.file(`${image.id}.png`, blob);
      
      console.log(`Added image ${image.id} to zip (${blob.size} bytes)`);
    } catch (error) {
      console.error(`Error processing image ${image.id}:`, error);
    }
  }
  
  // Generate zip file
  return await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6
    }
  });
}

/**
 * Downloads a zip file containing the synthetic data
 * @param images Array of synthetic data images
 * @param annotationsJson JSON data in the selected format (COCO, PASCAL VOC, YOLO)
 * @param filename Name of the zip file to download
 */
export async function downloadSyntheticDataZip(
  images: SyntheticDataImage[],
  annotationsJson: any,
  filename: string = 'synthetic_data.zip'
): Promise<void> {
  try {
    console.log(`Creating zip with ${images.length} images...`);
    const blob = await createSyntheticDataZip(images, annotationsJson);
    console.log(`Zip created successfully (${blob.size} bytes)`);
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error creating zip file:', error);
    throw error;
  }
}