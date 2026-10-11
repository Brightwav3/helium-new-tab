export const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
]);
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function validImageFile(file) {
  return file && IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES;
}

export async function decodeImage(file) {
  const bitmap = await createImageBitmap(file);
  bitmap.close();
}
