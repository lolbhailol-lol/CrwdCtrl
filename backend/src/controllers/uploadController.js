const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary (will use env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit instead of default 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/gif',
      'image/webp'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Generic file upload (for registration forms)
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
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
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
    console.error('Error uploading image to Cloudinary:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// Multiple images upload
exports.uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
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

    const uploadPromises = req.files.map(file => {
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
    console.error('Error uploading images to Cloudinary:', error);
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
    console.error('Error uploading file to Cloudinary:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

// Export multer middleware
exports.uploadSingle = upload.single('image');
exports.uploadFileMiddleware = fileUpload.single('file');
exports.uploadMultiple = upload.array('images', 10); // Max 10 images

exports.multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      error: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      error: err.message,
    });
  }
  next();
};




