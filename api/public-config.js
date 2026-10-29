function clean(value, pattern) {
  const text = String(value || '').trim();
  return pattern.test(text) ? text : '';
}

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const cloudName = clean(
    process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME,
    /^[a-zA-Z0-9_-]+$/
  );
  const uploadPreset = clean(
    process.env.CLOUDINARY_UPLOAD_PRESET || process.env.VITE_CLOUDINARY_UPLOAD_PRESET,
    /^[a-zA-Z0-9_-]+$/
  );

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json({
    cloudinary: {
      configured: Boolean(cloudName && uploadPreset),
      cloudName,
      uploadPreset
    }
  });
}
