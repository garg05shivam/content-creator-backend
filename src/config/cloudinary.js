import "dotenv/config";
import { v2 as cloudinary } from 'cloudinary';

const configureCloudinary = () => {
  const url = process.env.CLOUDINARY_URL;

  if (url) {
    try {
      const parsed = new URL(url);
      const cloudName = parsed.hostname;
      const apiKey = decodeURIComponent(parsed.username);
      const apiSecret = decodeURIComponent(parsed.password);

      if (cloudName && apiKey && apiSecret) {
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true,
        });
        return;
      }
    } catch (error) {
      console.error('Invalid CLOUDINARY_URL format');
    }
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
};

configureCloudinary();

export default cloudinary;
