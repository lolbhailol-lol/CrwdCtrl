const fs = require('fs').promises;
const path = require('path');

// Create uploads directory if it doesn't exist
const createUploadsDir = async () => {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'payment-screenshots');
    try {
        await fs.access(uploadsDir);
    } catch (error) {
        // Directory doesn't exist, create it
        await fs.mkdir(uploadsDir, { recursive: true });
    }
    return uploadsDir;
};

// Save uploaded file to file system
const saveUploadedFile = async (file, registrationId) => {
    if (!file) {
        throw new Error('No file provided');
    }

    const uploadsDir = await createUploadsDir();

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const filename = `${registrationId}_${timestamp}${fileExtension}`;
    const filePath = path.join(uploadsDir, filename);

    // Save file buffer to file system
    await fs.writeFile(filePath, file.buffer);

    return {
        filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        filePath: filePath
    };
};

// Delete uploaded file (for cleanup if needed)
const deleteUploadedFile = async (filePath) => {
    try {
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
};

// Get file from file system
const getUploadedFile = async (filePath) => {
    try {
        const fileBuffer = await fs.readFile(filePath);
        return fileBuffer;
    } catch (error) {
        throw new Error('File not found or cannot be read');
    }
};

module.exports = {
    saveUploadedFile,
    deleteUploadedFile,
    getUploadedFile,
    createUploadsDir
};