const IDENTIFIER = /^[a-zA-Z0-9_-]+$/;

function identifier(value) {
  const text = String(value || '').trim();
  return IDENTIFIER.test(text) ? text : '';
}

function cloudinaryUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'cloudinary:') return {};
    return {
      cloudName: identifier(parsed.hostname),
      apiKey: decodeURIComponent(parsed.username || ''),
      apiSecret: decodeURIComponent(parsed.password || '')
    };
  } catch {
    return {};
  }
}

export function resolveCloudinaryServerConfig(environment = process.env) {
  const fromUrl = cloudinaryUrl(environment.CLOUDINARY_URL);
  const cloudName = identifier(
    environment.CLOUDINARY_CLOUD_NAME
      || environment.VITE_CLOUDINARY_CLOUD_NAME
      || environment.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      || fromUrl.cloudName
  );
  const uploadPreset = identifier(
    environment.CLOUDINARY_UPLOAD_PRESET
      || environment.VITE_CLOUDINARY_UPLOAD_PRESET
      || environment.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  );
  const signedUploadPreset = identifier(environment.CLOUDINARY_SIGNED_UPLOAD_PRESET);
  const apiKey = String(environment.CLOUDINARY_API_KEY || fromUrl.apiKey || '').trim();
  const apiSecret = String(environment.CLOUDINARY_API_SECRET || fromUrl.apiSecret || '').trim();
  return {
    cloudName,
    uploadPreset,
    signedUploadPreset,
    apiKey,
    apiSecret,
    unsignedAvailable: Boolean(cloudName && uploadPreset),
    signedAvailable: Boolean(cloudName && apiKey && apiSecret)
  };
}
