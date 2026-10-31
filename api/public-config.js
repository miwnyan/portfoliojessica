import { resolveCloudinaryServerConfig } from './cloudinary-config.js';

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const config = resolveCloudinaryServerConfig();

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json({
    cloudinary: {
      configured: config.unsignedAvailable || config.signedAvailable,
      unsignedAvailable: config.unsignedAvailable,
      signedAvailable: config.signedAvailable,
      cloudName: config.cloudName,
      uploadPreset: config.uploadPreset
    }
  });
}
