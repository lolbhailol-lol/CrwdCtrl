const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const { logger } = require('../utils/logger');

// Configure Cloudinary (will use env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  return err;
}

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/bmp',
]);

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.heif',
  '.avif',
  '.bmp',
]);

function isAllowedImageFile(file) {
  const mime = String(file?.mimetype || '').toLowerCase();
  if (IMAGE_MIME_TYPES.has(mime)) return true;
  // Some browsers/OS send blank or generic MIME for camera/HEIC exports
  if (!mime || mime === 'application/octet-stream') {
    const ext = path.extname(file?.originalname || '').toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  }
  return false;
}

function imageFileFilter(req, file, cb) {
  if (isAllowedImageFile(file)) {
    cb(null, true);
    return;
  }
  cb(httpError('Only image files are allowed (JPG, PNG, GIF, WebP, HEIC, AVIF).'), false);
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit instead of default 10MB
  },
  fileFilter: imageFileFilter,
});

// Generic file upload (for registration forms)
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB for rulebook zip archives
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed =
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      ext === '.zip';
    if (!allowed) {
      return cb(httpError('Only .zip files are allowed for rulebook import'));
    }
    cb(null, true);
  },
});

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit to match frontend validation
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types for registration forms
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/avif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowedTypes.includes(String(file.mimetype || '').toLowerCase()) || isAllowedImageFile(file)) {
      cb(null, true);
    } else {
      cb(httpError('File type not allowed'), false);
    }
  },
});


const ALLOWED_UPLOAD_FOLDERS = new Set([
  'crwdctrl',
  'crwdctrl/fests',
  'crwdctrl/competitions',
  'crwdctrl/treks',
  'crwdctrl/events',
  'crwdctrl/sports',
  'crwdctrl/profiles',
  'crwdctrl/registrations',
  'crwdctrl/admin',
  'crwdctrl/gallery',
]);

function sanitizeUploadFolder(folder) {
  if (typeof folder !== 'string' || !folder.trim()) return 'crwdctrl';
  const normalized = folder.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith('crwdctrl')) return 'crwdctrl';
  if (normalized.includes('..')) return 'crwdctrl';
  const base = normalized.split('/').filter(Boolean).join('/');
  if (!base) return 'crwdctrl';
  if (ALLOWED_UPLOAD_FOLDERS.has(base)) return base;
  // Allow one extra sub-segment under known roots, e.g. crwdctrl/fests/abc
  const root = base.split('/').slice(0, 2).join('/');
  if (ALLOWED_UPLOAD_FOLDERS.has(root)) return base;
  return 'crwdctrl';
}


// Single image upload
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.' });
    }

    // Convert buffer to base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const folder = sanitizeUploadFolder(req.body.folder);
    // Store originals at full quality — optimize on delivery via Cloudinary URL transforms
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: folder,
      resource_type: 'image',
    });

    res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    logger.error('Error uploading image to Cloudinary', { message: error.message });
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

function collectUploadedFiles(req) {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') {
    return [
      ...(req.files.images || []),
      ...(req.files.image || []),
      ...(req.files.file || []),
    ];
  }
  if (req.file) return [req.file];
  return [];
}

// Multiple images upload
exports.uploadMultipleImages = async (req, res) => {
  try {
    const files = collectUploadedFiles(req);
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check if Cloudinary is configured
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return res.status(500).json({
        error: 'Cloudinary is not fully configured'
      });
    }

    const folder = sanitizeUploadFolder(req.body.folder);

    const uploadPromises = files.map(file => {
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      return cloudinary.uploader.upload(base64Image, {
        folder: folder,
        resource_type: 'image',
      });
    });

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      urls: results.map(result => ({
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      }))
    });
  } catch (error) {
    logger.error('Error uploading images to Cloudinary', { message: error.message });
    res.status(500).json({ error: 'Failed to upload images' });
  }
};

// Generic file upload (for registration forms and other files)
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.' });
    }

    // Convert buffer to base64
    const base64File = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const folder = sanitizeUploadFolder(req.body.folder);
    const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
    
    const uploadOptions = {
      folder: folder,
      resource_type: resourceType,
    };

    const result = await cloudinary.uploader.upload(base64File, uploadOptions);

    res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error) {
    logger.error('Error uploading file to Cloudinary', { message: error.message });
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

// Export multer middleware
exports.uploadSingle = upload.single('image');
exports.uploadFileMiddleware = fileUpload.single('file');
// Accept common field names used by admin UI components (images / image / file)
exports.uploadMultiple = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 10 },
  { name: 'file', maxCount: 10 },
]);
exports.uploadRulebookZip = zipUpload.single('zip');

exports.multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum size is 50MB.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Unexpected upload field "${err.field || 'unknown'}". Use "images" or "image".`
          : err.message;
    return res.status(status).json({
      success: false,
      error: message,
      message,
    });
  }
  if (err) {
    const status = err.status || err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message || 'Upload failed',
      message: err.message || 'Upload failed',
    });
  }
  next();
};




