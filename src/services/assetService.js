import Asset from '../models/Asset.js';

export const createAssetService = async (file, body, userId) => {
  const { title, description, tags, visibility } = body;
  
  const assetData = {
    title,
    description,
    type: file.mimetype.startsWith('video') ? 'video' : 'image',
    url: file.path,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    visibility,
    owner: userId,
    cloudinary_id: file.filename
  };

  return await Asset.create(assetData);
};

export const getPublicAssetsService = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  
  const [assets, totalAssets] = await Promise.all([
    Asset.find({ visibility: 'public' })
      .populate('owner', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Asset.countDocuments({ visibility: 'public' })
  ]);

  const totalPages = Math.ceil(totalAssets / limit);

  return {
    assets,
    totalAssets,
    totalPages,
    currentPage: page,
    limit
  };
};

export const getMyAssetsService = async (userId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  
  const [assets, totalAssets] = await Promise.all([
    Asset.find({ owner: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Asset.countDocuments({ owner: userId })
  ]);

  const totalPages = Math.ceil(totalAssets / limit);

  return {
    assets,
    totalAssets,
    totalPages,
    currentPage: page,
    limit
  };
};

export const getAssetDetails = async (assetId) => {
  return await Asset.findById(assetId);
};

export const getOwnedAsset = async (assetId, userId) => {
  return await Asset.findOne({ _id: assetId, owner: userId });
};

export const deleteAssetRecord = async (assetId, userId) => {
  return await Asset.findOneAndDelete({ _id: assetId, owner: userId });
};
