import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { imageUploadSchema } from '../validators/media.validators';

const router = Router();

router.use(requireAuth);

router.get('/config', asyncHandler(uploadController.getStorageConfig));
router.post('/', validate({ body: imageUploadSchema }), asyncHandler(uploadController.createUpload));

export default router;
