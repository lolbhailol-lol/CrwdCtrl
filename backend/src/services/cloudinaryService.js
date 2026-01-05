const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original filename
 * @param {string} festName - Fest name
 * @param {string} registrationId - Registration ID
 * @param {string} userId - User ID
 * @param {string} fieldName - Form field name
 * @returns {Object} Upload result with cloudinary link
 */
const uploadToCloudinary = async (fileBuffer, fileName, festName, registrationId, userId, fieldName) => {
  try {
    console.log('🚀 Starting Cloudinary upload...');
    console.log('📋 Upload details:', { 
      fileName, 
      size: fileBuffer.length,
      festName,
      registrationId,
      userId,
      fieldName
    });

    // Create organized folder structure: crwdctrl/festName/registrationId_userId/
    const folderPath = `crwdctrl/${festName.replace(/[^a-zA-Z0-9]/g, '_')}/${registrationId}_${userId}`;
    
    // Generate clean public ID
    const publicId = `${folderPath}/${fieldName}`;
    
    console.log('📁 Upload path:', publicId);

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto', // Automatically detect file type
          public_id: publicId,
          use_filename: false,
          unique_filename: false,
          overwrite: true,
          tags: ['registration', 'payment', festName, registrationId],
          context: {
            fest_name: festName,
            registration_id: registrationId,
            user_id: userId,
            field_name: fieldName,
            original_filename: fileName
          }
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload successful:', result.public_id);
            resolve(result);
          }
        }
      ).end(fileBuffer);
    });

    // Generate secure URL
    const secureUrl = cloudinary.url(uploadResult.public_id, {
      secure: true,
      quality: 'auto',
      fetch_format: 'auto'
    });

    console.log('🔗 Cloudinary URL generated:', secureUrl);

    return {
      success: true,
      fileId: uploadResult.public_id,
      cloudinaryLink: secureUrl,
      fileName: fileName,
      uploadMethod: 'cloudinary',
      fileType: uploadResult.resource_type,
      fileSize: uploadResult.bytes,
      format: uploadResult.format
    };

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload to Cloudinary',
    };
  }
};

/**
 * Test Cloudinary connection
 * @returns {Object} Test result
 */
const testCloudinaryConnection = async () => {
  try {
    // Test by getting account details
    const result = await cloudinary.api.ping();
    
    return {
      success: true,
      message: 'Successfully connected to Cloudinary',
      status: result.status
    };
  } catch (error) {
    console.error('❌ Cloudinary connection test error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to Cloudinary',
    };
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Object} Delete result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      result: result.result
    };
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  uploadToCloudinary,
  testCloudinaryConnection,
  deleteFromCloudinary,
};