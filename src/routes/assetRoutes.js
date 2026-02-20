import express from 'express';
import * as assetController from '../controllers/assetController.js';
import protect from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public Routes
router.get('/getPublicasset', assetController.getPublicAssets);
router.get('/public', assetController.getPublicAssets);

// Apply authentication to protected asset routes
router.use(protect);

// Protected Routes
router.post('/create', upload.single('file'), assetController.uploadAsset);
router.get('/getMyAsset', assetController.getMyAssets);
router.get('/mine', assetController.getMyAssets);
router.delete('/:id', assetController.deleteAsset);

export default router;
