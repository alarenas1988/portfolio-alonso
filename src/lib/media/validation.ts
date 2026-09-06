import type { EditorialMetadata, ValidatedFile } from './types.ts';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
const formats: Readonly<Record<string, readonly string[]>> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'application/pdf': ['pdf'],
};
export function inspectFile(bytes: Uint8Array, filename: string, mime: string) {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES)
    throw new Error('El archivo debe pesar entre 1 byte y 10 MiB.');
  if (
    !filename.trim() ||
    filename.length > 255 ||
    /[\\/]/u.test(filename) ||
    [...filename].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new Error('Nombre de archivo no válido.');
  const extension = filename.split('.').at(-1)?.toLowerCase() ?? '';
  if (!formats[mime]?.includes(extension))
    throw new Error('Tipo y extensión de archivo incompatibles.');
  const ascii = (start: number, end: number) =>
    new TextDecoder('latin1').decode(bytes.subarray(start, end));
  let detected = '';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) detected = 'image/jpeg';
  if (
    bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]) &&
    bytes.length >= 8
  )
    detected = 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') detected = 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /avif|avis/.test(ascii(8, 64))) detected = 'image/avif';
  if (ascii(0, 5) === '%PDF-') detected = 'application/pdf';
  if (detected !== mime) throw new Error('Los bytes no corresponden al tipo declarado.');
  return { extension: mime === 'image/jpeg' ? 'jpg' : extension, mime };
}
export function validateEditorial(metadata: EditorialMetadata, image: boolean) {
  if (!['project', 'blog', 'profile', 'document', 'general'].includes(metadata.category))
    throw new Error('Categoría no válida.');
  if (metadata.caption.length > 2000) throw new Error('La descripción es demasiado larga.');
  if (
    image &&
    (metadata.decorative
      ? metadata.altText !== ''
      : !metadata.altText.trim() || metadata.altText.length > 500)
  )
    throw new Error('Escribe un texto alternativo o marca la imagen como decorativa.');
  if (!image && metadata.decorative) throw new Error('Un documento no es una imagen decorativa.');
}
export async function validatePdf(bytes: Uint8Array): Promise<void> {
  if (!/%%EOF\s*$/.test(new TextDecoder('latin1').decode(bytes.subarray(-1024))))
    throw new Error('PDF incompleto.');
  const { PDFDocument, PDFDict, PDFName, PDFArray, PDFRawStream } = await import('pdf-lib');
  const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true, updateMetadata: false });
  if (pdf.isEncrypted || pdf.getPageCount() < 1 || pdf.getPageCount() > 500)
    throw new Error('PDF no admitido.');
  const forbidden = [
    'JavaScript',
    'JS',
    'AA',
    'OpenAction',
    'EmbeddedFiles',
    'Launch',
    'RichMedia',
    'XFA',
  ];
  const visited = new Set<unknown>();
  function inspect(object: unknown, depth: number) {
    if (visited.has(object)) return;
    if (depth > 64 || visited.size > 20000) throw new Error('PDF demasiado complejo.');
    visited.add(object);
    if (object instanceof PDFRawStream) inspect(object.dict, depth + 1);
    if (object instanceof PDFDict) {
      const action = object.get(PDFName.of('S'));
      if (
        forbidden.some((key) => object.has(PDFName.of(key))) ||
        (action instanceof PDFName &&
          ['/JavaScript', '/Launch', '/Rendition', '/GoToE'].includes(action.toString()))
      )
        throw new Error('El PDF contiene contenido activo no permitido.');
      for (const [, value] of object.entries()) inspect(value, depth + 1);
    }
    if (object instanceof PDFArray)
      for (let i = 0; i < object.size(); i++) inspect(object.get(i), depth + 1);
  }
  for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object, 0);
}
export async function validateBrowserFile(
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
    const bitmap = await createImageBitmap(file);
    try {
      width = bitmap.width;
      height = bitmap.height;
      if (!width || !height || width * height > MAX_IMAGE_PIXELS)
        throw new Error('Dimensiones de imagen no admitidas.');
    } finally {
      bitmap.close();
    }
  }
  return { bytes, filename: file.name, ...format, size: bytes.length, width, height };
}
