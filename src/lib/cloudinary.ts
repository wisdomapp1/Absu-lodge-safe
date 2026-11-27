export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'video';
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
}

const cloudName =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)
    : undefined;
const uploadPreset =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined)
    : undefined;

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    cloudName &&
      uploadPreset &&
      !cloudName.includes('YOUR_') &&
      !uploadPreset.includes('YOUR_')
  );
}

export function getCloudinaryConfigStatus() {
  return {
    configured: isCloudinaryConfigured(),
    cloudNameSet: Boolean(cloudName && !cloudName.includes('YOUR_')),
    uploadPresetSet: Boolean(uploadPreset && !uploadPreset.includes('YOUR_')),
  };
}

/**
 * Generates an optimized, responsive Cloudinary delivery URL when URL is a Cloudinary URL,
 * otherwise returns the original URL untouched.
 */
export function getOptimizedImageUrl(url: string, width = 900): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
}

export function getOptimizedVideoUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  return url.replace('/upload/', '/upload/f_auto,q_auto:good/');
}

/**
 * Uploads an image or video directly to Cloudinary using unsigned preset (no API secret exposed client-side),
 * reporting real XHR upload progress. Throws an explicit error if Cloudinary credentials are not configured.
 */
export function uploadFileToCloudinary(
  file: File,
  kind: 'image' | 'video',
  onProgress?: (pct: number) => void
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(
      new Error(
        'Cloudinary is not configured yet. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in environment secrets.'
      )
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${kind}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset!);
  formData.append('folder', `absu-lodge/${kind === 'image' ? 'photos' : 'videos'}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
          resolve({
            secureUrl: data.secure_url,
            publicId: data.public_id,
            resourceType: kind,
            bytes: data.bytes || file.size,
            width: data.width,
            height: data.height,
            duration: data.duration,
          });
        } else {
          reject(new Error(data?.error?.message || `Cloudinary upload failed (${xhr.status}).`));
        }
      } catch {
        reject(new Error('Invalid response from Cloudinary upload endpoint.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network interruption during Cloudinary upload. Please retry.'));
    };

    xhr.send(formData);
  });
}
