import sharp from 'sharp';
import {
  inspectFile,
  validateEditorial,
  validatePdf,
  MAX_FILE_BYTES,
  MAX_IMAGE_PIXELS,
} from './validation.ts';
import type { EditorialMetadata, ValidatedFile } from './types.ts';
export async function validateBuildFile(
  file: File,
  metadata: EditorialMetadata,
): Promise<ValidatedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error('El archivo supera 10 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = inspectFile(bytes, file.name, file.type);
  validateEditorial(metadata, file.type !== 'application/pdf');
  let width: number | null = null,
    height: number | null = null;
  if (file.type === 'application/pdf') await validatePdf(bytes);
  else {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS });
    const info = await image.metadata();
    if ((info.pages ?? 1) > 1) throw new Error('Las imágenes animadas no están admitidas.');
    const decoded = await image.rotate().raw().toBuffer({ resolveWithObject: true });
    width = decoded.info.width;
    height = decoded.info.height;
  }
  return { bytes, filename: file.name, ...format, size: bytes.length, width, height };
}
