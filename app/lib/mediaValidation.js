/**
 * Hardware validation and compatibility checks for the adbox LED display network.
 * Physical specs:
 * - Display: 128×128 RGB LED matrix (1:1 square aspect ratio).
 * - Controller: NovaStar TB20 HDMI sending card via Raspberry Pi DRM (1920×1080 scanout).
 * - Link: Cellular IoT connection with bandwidth limits.
 */

export function validateMediaFit(asset) {
  if (!asset) return { status: 'optimal', badges: [], warnings: [], errors: [], score: 100 };

  const width = Number(asset.width) || null;
  const height = Number(asset.height) || null;
  const bytes = Number(asset.bytes) || 0;
  const duration = Number(asset.durationSeconds) || 10;
  const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/'));

  const badges = [];
  const warnings = [];
  const errors = [];

  // 1. Aspect ratio and dimension checks
  if (width && height) {
    const ratio = width / height;
    const isSquare = Math.abs(ratio - 1.0) <= 0.05;
    const is128Native = width === 128 && height === 128;
    const is16x9 = Math.abs(ratio - 16 / 9) <= 0.1;

    if (is128Native) {
      badges.push({ label: '128×128 Native', type: 'success', description: 'Pixel-perfect 1:1 match for LED matrix' });
    } else if (isSquare) {
      badges.push({ label: '1:1 Square', type: 'success', description: 'Evenly scales to 128×128 square panel' });
    } else if (is16x9) {
      badges.push({ label: '16:9 Widescreen', type: 'warning', description: 'Will be squashed into 1:1 square on screen' });
      warnings.push(`16:9 aspect ratio (${width}×${height}) will be horizontally compressed on the 128×128 square LED display.`);
    } else {
      badges.push({ label: `${width}×${height}`, type: 'warning', description: 'Non-square aspect ratio' });
      warnings.push(`Non-square aspect ratio (${ratio.toFixed(2)}:1) will distort when mapped to the 1:1 LED panel.`);
    }

    if (width > 1920 || height > 1080) {
      errors.push(`Resolution (${width}×${height}) exceeds 1920×1080 and risks crashing the Raspberry Pi GPU memory.`);
    }
  } else {
    warnings.push('Image dimensions could not be verified.');
  }

  // 2. File size / bandwidth checks
  const mb = bytes / (1024 * 1024);
  if (mb > 15) {
    errors.push(`File is very large (${mb.toFixed(1)} MB). High chance of cellular IoT download timeouts on the boxes.`);
  } else if (mb > 4) {
    warnings.push(`Large file (${mb.toFixed(1)} MB). May take longer to download on cellular vehicle connections.`);
    badges.push({ label: `${mb.toFixed(1)} MB`, type: 'warning', description: 'Heavy download' });
  } else if (bytes > 0) {
    badges.push({ label: mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`, type: 'info' });
  }

  // 3. Duration checks
  if (duration < 5) {
    warnings.push(`Duration is very short (${duration}s). Traffic viewers might miss it.`);
  } else if (duration > 60) {
    warnings.push(`Duration is long (${duration}s). Will monopolize rotation cycles.`);
  }

  const status = errors.length > 0 ? 'danger' : warnings.length > 0 ? 'warning' : 'optimal';
  return {
    status,
    isSquare: width && height ? Math.abs(width / height - 1.0) <= 0.05 : false,
    width,
    height,
    bytes,
    duration,
    badges,
    warnings,
    errors
  };
}

/**
 * Validates a local File object in the browser before uploading.
 * Returns a Promise that inspects image or video metadata.
 */
export async function inspectFileBeforeUpload(file) {
  return new Promise((resolve) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (isImage) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(
          validateMediaFit({
            name: file.name,
            bytes: file.size,
            width: img.naturalWidth,
            height: img.naturalHeight,
            type: 'image',
            mimeType: file.type,
            durationSeconds: file.type === 'image/gif' ? 10 : 10
          })
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(
          validateMediaFit({
            name: file.name,
            bytes: file.size,
            type: 'image',
            mimeType: file.type
          })
        );
      };
      img.src = url;
    } else if (isVideo) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(
          validateMediaFit({
            name: file.name,
            bytes: file.size,
            width: video.videoWidth,
            height: video.videoHeight,
            durationSeconds: Math.round(video.duration || 10),
            type: 'video',
            mimeType: file.type
          })
        );
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(
          validateMediaFit({
            name: file.name,
            bytes: file.size,
            type: 'video',
            mimeType: file.type
          })
        );
      };
      video.src = url;
    } else {
      resolve(
        validateMediaFit({
          name: file.name,
          bytes: file.size,
          type: 'unknown',
          mimeType: file.type
        })
      );
    }
  });
}
