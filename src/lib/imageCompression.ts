const MAX_IMAGE_DIMENSION = 1200;
const MAX_IMAGE_BYTES = 300 * 1024;
const MIN_QUALITY = 0.45;

export async function compressProductImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the product image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let quality = 0.88;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > MAX_IMAGE_BYTES && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
      blob = await canvasToBlob(canvas, quality);
    }

    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error(`${file.name} remains larger than 300 KB after compression. Choose a smaller image.`);
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Your browser could not compress this image.'));
    }, 'image/jpeg', quality);
  });
}
