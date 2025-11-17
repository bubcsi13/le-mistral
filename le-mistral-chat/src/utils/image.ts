// utils/image.ts
export function guessMimeFromBase64(b64: string): string {
  if (b64.startsWith('/9j/')) return 'image/jpeg';              // JPEG
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';        // PNG
  if (b64.startsWith('R0lGOD')) return 'image/gif';             // GIF
  if (b64.startsWith('PHN2Zy')) return 'image/svg+xml';         // SVG (rare as base64)
  return 'application/octet-stream';
}

export function base64ToBlobUrl(b64: string, mime?: string) {
  const m = !mime || mime === 'application/octet-stream' ? guessMimeFromBase64(b64) : mime;
  const byteString = atob(b64);
  const array = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) array[i] = byteString.charCodeAt(i);
  const blob = new Blob([array], { type: m });
  const url = URL.createObjectURL(blob);
  return { url, mime: m };
}
