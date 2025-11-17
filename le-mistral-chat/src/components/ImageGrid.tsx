// components/ImageGrid.tsx
import React, { useEffect } from 'react';
import { base64ToBlobUrl } from '@/utils/image';

type ApiImage = { fileId?: string; mime?: string; base64: string };
type Payload = { images: ApiImage[] };

export default function ImageGrid({ payload }: { payload: Payload }) {
  const items = payload.images.map((img, i) => {
    const { url, mime } = base64ToBlobUrl(img.base64, img.mime);
    const ext = (mime.split('/')[1] || 'bin').replace('jpeg', 'jpg');
    return { url, mime, filename: `${img.fileId ?? `image-${i}`}.${ext}` };
  });

  // Clean up object URLs when unmounting
  useEffect(() => {
    return () => { items.forEach(it => URL.revokeObjectURL(it.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((it, i) => (
        <div key={i} className="rounded border p-2">
          <img src={it.url} alt={`generated-${i}`} className="w-full h-auto" />
          <div className="mt-2 flex items-center gap-3 text-sm">
            <a href={it.url} download={it.filename} className="px-3 py-1 rounded bg-gray-200">
              Download
            </a>
            <span>{it.mime}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
