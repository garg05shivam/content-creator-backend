import * as assetService from '../services/assetService.js';
import cloudinary from '../config/cloudinary.js';

export const uploadAsset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!req.body.title || !req.body.description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const resourceType = req.file.mimetype.startsWith('video') ? 'video' : 'image';

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'creator_connect/assets',
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    const fileForDb = {
      mimetype: req.file.mimetype,
      path: uploadResult.secure_url,
      filename: uploadResult.public_id,
    };

    const asset = await assetService.createAssetService(fileForDb, req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: 'Asset uploaded successfully',
      asset
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
};

export const getPublicAssets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await assetService.getPublicAssetsService(page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Fetch public assets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch public assets' });
  }
};

export const getMyAssets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await assetService.getMyAssetsService(req.user._id, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Fetch my assets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your assets' });
  }
};

export const deleteAsset = async (req, res) => {
  try {
    const assetId = req.params.id;
    const asset = await assetService.getOwnedAsset(assetId, req.user._id);

    if (!asset) {
      const exists = await assetService.getAssetDetails(assetId);
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Asset not found' });
      }
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const publicId = asset.cloudinary_id || asset.url.split("/").pop().split(".")[0];
    await cloudinary.uploader.destroy(publicId, { resource_type: asset.type });

    await assetService.deleteAssetRecord(assetId, req.user._id);

    res.status(200).json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};
