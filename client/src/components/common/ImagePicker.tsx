import * as React from 'react';
import { ImagePlus, Link2, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { uploadService } from '@/services/workspace.service';
import { SmartImage } from './SmartImage';
import { cn } from '@/lib/utils';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Image picker (Section 2).
 *
 * Two paths, neither requiring a storage provider to be configured: paste an
 * external URL, or choose a file which is downscaled in the browser and stored
 * inline. That keeps cover images and avatars working out of the box while
 * leaving room for a real provider later.
 */
export function ImagePicker({
  id = 'image',
  label,
  value,
  onChange,
  seed,
  error,
  hint,
  className,
  rounded = 'rounded-xl',
  aspect = 'aspect-[16/9]',
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Fallback gradient seed when no image is set. */
  seed: string;
  error?: string;
  hint?: string;
  className?: string;
  rounded?: string;
  aspect?: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image', 'Choose a PNG, JPG, WebP or GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('That image is too large', 'Please choose a file under 2 MB.');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await downscaleToDataUrl(file);
      const result = await uploadService.create({ dataUrl });
      onChange(result.url);
      toast.success('Image ready');
    } catch (uploadError) {
      toast.fromError(uploadError, 'We could not process that image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className={cn('relative shrink-0 overflow-hidden border border-border', rounded, aspect)}>
          <SmartImage
            src={value || null}
            alt=""
            decorative
            seed={seed}
            className="size-full"
          />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="relative">
            <Link2
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={id}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Paste an image URL…"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : `${id}-hint`}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? null : <Upload />}
              Upload from device
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                <X />
                Remove
              </Button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          <FieldError id={`${id}-error`}>{error}</FieldError>
          {!error ? (
            <FieldHint id={`${id}-hint`}>
              {hint ?? 'Paste a URL or upload a file under 2 MB. We will use a gradient if you skip this.'}
            </FieldHint>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Reads an image, caps its longest edge at 1600px and re-encodes it as WebP/JPEG.
 *
 * Downscaling in the browser keeps the inline payload small enough to store, so a
 * phone photo does not blow past the request body limit.
 */
function downscaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not read that image.'));
      image.onload = () => {
        const maxEdge = 1600;
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not process that image.'));
          return;
        }
        context.drawImage(image, 0, 0, width, height);

        // WebP is far smaller; browsers that cannot encode it silently fall back.
        const hasWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        resolve(canvas.toDataURL(hasWebp ? 'image/webp' : 'image/jpeg', 0.82));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export { ImagePlus };
