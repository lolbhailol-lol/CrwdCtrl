const { google } = require('googleapis');

/**
 * Append competition registration data to Google Sheets using direct API integration
 * @param {string} googleSheetsUrl - The Google Sheets URL
 * @param {Object} responses - The registration form responses (fieldId -> value)
 * @param {Object} competitionInfo - The competition information
 * @param {Object} userInfo - The user information
 * @param {Array} formSchema - The competition form schema
 */
const appendToCompetitionGoogleSheets = async (googleSheetsUrl, responses, competitionInfo, userInfo, formSchema) => {
  try {
    console.log('📊 Starting Competition Google Sheets integration...');
    
    // Extract spreadsheet ID from URL
    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets URL format');
    }

    console.log('📋 Spreadsheet ID:', spreadsheetId);

    // Initialize Google Sheets API
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet metadata to find the first sheet
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const firstSheet = spreadsheetInfo.data.sheets[0];
    const sheetName = firstSheet.properties.title;
    console.log('📄 Using sheet:', sheetName);

    // Get existing headers to check if we need to create them
    let existingHeaders = [];
    try {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      existingHeaders = headerResponse.data.values ? headerResponse.data.values[0] : [];
    } catch (error) {
      console.log('📝 No existing headers found, will create new ones');
    }

    console.log('📋 Competition form schema loaded with', formSchema.length, 'fields');

    // Create headers using field.label (human-readable names)
    const headers = ['Timestamp', 'User Name', 'User Email', 'Competition', 'Registration ID'];
    formSchema.forEach(field => {
      headers.push(field.label); // Use label for column headers
    });

    // Add headers if sheet is empty or headers don't match
    if (existingHeaders.length === 0 || !arraysEqual(existingHeaders, headers)) {
      console.log('📝 Creating/updating headers...');
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers],
        },
      });
      console.log('✅ Headers updated successfully');
    }

    // Prepare row data with proper mapping
    const rowData = [
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      userInfo.name || 'Unknown',
      userInfo.email || 'Unknown',
      competitionInfo.competitionName || 'Unknown',
      competitionInfo.registrationId || 'Unknown'
    ];

    // Map form responses using field IDs to match frontend field generation
    formSchema.forEach(field => {
      // Generate the same field ID format as frontend
      const fieldId = field.id ? `field_${field.id}` : 
                     field.fieldName ? field.fieldName :
                     field.label ? `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}` :
                     'unknown_field';
      
      if (field.type === 'image' || field.type === 'file') {
        // For file/image fields: show "🔗 View" hyperlink if uploaded
        const fileData = responses[fieldId];
        if (fileData && typeof fileData === 'string' && fileData.startsWith('http')) {
          // Use HYPERLINK formula but ensure it displays as clickable text
          rowData.push(`=HYPERLINK("${fileData}","🔗 View")`);
        } else {
          rowData.push('');
        }
      } else {
        // For other fields: show actual value or empty string
        const value = responses[fieldId];
        if (Array.isArray(value)) {
          rowData.push(value.join(', '));
        } else {
          rowData.push(value ?? '');
        }
      }
    });


    // Append the new row
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED', // This is crucial - it processes formulas
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData],
      },
    });

    console.log('✅ Data appended successfully to Google Sheets');
    console.log('📍 Updated range:', appendResponse.data.updates.updatedRange);

    return {
      success: true,
      message: 'Competition registration data synced to Google Sheets successfully',
      updatedRange: appendResponse.data.updates.updatedRange,
      rowsAdded: appendResponse.data.updates.updatedRows
    };

  } catch (error) {
    console.error('❌ Competition Google Sheets integration error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync with Google Sheets'
    };
  }
};

/**
 * Append registration data to Google Sheets using direct API integration
 * @param {string} googleSheetsUrl - The Google Sheets URL
 * @param {Object} responses - The registration form responses (fieldName -> value)
 * @param {Object} festInfo - The fest information
 * @param {Object} userInfo - The user information
 */
const appendToGoogleSheets = async (googleSheetsUrl, responses, festInfo, userInfo) => {
  try {
    console.log('📊 Starting Google Sheets integration...');
    
    // Extract spreadsheet ID from URL
    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets URL format');
    }

    console.log('📋 Spreadsheet ID:', spreadsheetId);

    // Initialize Google Sheets API
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet metadata to find the first sheet
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const firstSheet = spreadsheetInfo.data.sheets[0];
    const sheetName = firstSheet.properties.title;
    console.log('📄 Using sheet:', sheetName);

    // Get existing headers to check if we need to create them
    let existingHeaders = [];
    try {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      existingHeaders = headerResponse.data.values ? headerResponse.data.values[0] : [];
    } catch (error) {
      console.log('📝 No existing headers found, will create new ones');
    }

    // Get fest registration form schema from database
    const FestOrganizer = require('../model/fest_organizer_model');
    const fest = await FestOrganizer.findOne({
      $or: [
        { festName: festInfo.festName },
        { _id: festInfo.festId }
      ]
    });

    if (!fest || !fest.registration) {
      throw new Error('Fest registration configuration not found');
    }

    // ✅ CRITICAL FIX: Handle both single-step and multi-step forms
    let formSchema = [];
    if (fest.registration.formType === 'MULTI_STEP' && fest.registration.steps) {
      // For multi-step forms, flatten all fields from all steps
      formSchema = fest.registration.steps.flatMap(step => step.fields || []);
      console.log('📋 Multi-step form schema loaded with', formSchema.length, 'fields from', fest.registration.steps.length, 'steps');
    } else if (fest.registration.formSchema) {
      // For single-step forms, use the direct formSchema
      formSchema = fest.registration.formSchema;
      console.log('📋 Single-step form schema loaded with', formSchema.length, 'fields');
    }

    if (!formSchema || formSchema.length === 0) {
      throw new Error('Fest registration form schema not found or empty');
    }

    // Create headers using field.label (human-readable names)
    const headers = ['Timestamp', 'User Name', 'User Email'];
    formSchema.forEach(field => {
      headers.push(field.label); // Use label for column headers
    });

    // Add headers if sheet is empty or headers don't match
    if (existingHeaders.length === 0 || !arraysEqual(existingHeaders, headers)) {
      console.log('📝 Creating/updating headers...');
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers],
        },
      });
      console.log('✅ Headers updated successfully');
    }

    // Prepare row data with proper mapping
    const rowData = [
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      userInfo.name || 'Unknown',
      userInfo.email || 'Unknown'
    ];

    // Map form responses using field names for column headers
    formSchema.forEach(field => {
      if (field.type === 'image' || field.type === 'file') {
        // For file/image fields: show "🔗 View" hyperlink if uploaded
        // Try multiple field key strategies to find the file data
        const possibleKeys = [
          field.fieldName,
          field.id,
          `field_${field.id}`,
          `field_${field.label?.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`
        ].filter(Boolean);
        
        let fileData = null;
        for (const key of possibleKeys) {
          if (responses[key]) {
            fileData = responses[key];
            break;
          }
        }
        
        if (fileData && fileData.uploaded && fileData.cloudinaryLink) {
          // Use HYPERLINK formula but ensure it displays as clickable text
          rowData.push(`=HYPERLINK("${fileData.cloudinaryLink}","🔗 View")`);
        } else {
          rowData.push('');
        }
      } else {
        // For other fields: show actual value or empty string
        // Try multiple field key strategies to find the value
        const possibleKeys = [
          field.fieldName,
          field.id,
          `field_${field.id}`,
          `field_${field.label?.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`
        ].filter(Boolean);
        
        let value = null;
        for (const key of possibleKeys) {
          if (responses.hasOwnProperty(key)) {
            value = responses[key];
            break;
          }
        }
        
        if (Array.isArray(value)) {
          rowData.push(value.join(', '));
        } else {
          rowData.push(value ?? '');
        }
      }
    });

    console.log('📊 Row data prepared:', rowData);
    console.log('🔍 Field mapping debug:');
    formSchema.forEach((field, index) => {
      const possibleKeys = [
        field.fieldName,
        field.id,
        `field_${field.id}`,
        `field_${field.label?.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`
      ].filter(Boolean);
      
      let foundKey = null;
      let foundValue = null;
      for (const key of possibleKeys) {
        if (responses.hasOwnProperty(key)) {
          foundKey = key;
          foundValue = responses[key];
          break;
        }
      }
      
      console.log(`  Field ${index + 1}: ${field.label} -> Key: ${foundKey || 'NOT_FOUND'}, Value: ${foundValue ? 'FOUND' : 'EMPTY'}`);
    });

    // Append the new row
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED', // This is crucial - it processes formulas
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData],
      },
    });

    console.log('✅ Data appended successfully to Google Sheets');
    console.log('📍 Updated range:', appendResponse.data.updates.updatedRange);

    return {
      success: true,
      message: 'Registration data synced to Google Sheets successfully',
      updatedRange: appendResponse.data.updates.updatedRange,
      rowsAdded: appendResponse.data.updates.updatedRows
    };

  } catch (error) {
    console.error('❌ Google Sheets integration error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync with Google Sheets'
    };
  }
};

/**
 * Get Google API authentication
 * @returns {Object} Google Auth client
 */
const getGoogleAuth = async () => {
  try {
    // Use service account authentication
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!serviceAccountEmail || !privateKey) {
      throw new Error('Google service account credentials not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return auth;
  } catch (error) {
    console.error('Error setting up Google authentication:', error);
    throw error;
  }
};

/**
 * Extract spreadsheet ID from Google Sheets URL
 * @param {string} url - Google Sheets URL
 * @returns {string|null} Spreadsheet ID
 */
const extractSpreadsheetId = (url) => {
  if (!url) return null;
  
  // Match various Google Sheets URL formats
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/spreadsheets\/u\/\d+\/d\/([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]+)$/ // Direct spreadsheet ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

/**
 * Check if two arrays are equal
 * @param {Array} arr1 
 * @param {Array} arr2 
 * @returns {boolean}
 */
const arraysEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, index) => val === arr2[index]);
};

/**
 * Validate Google Sheets URL format
 * @param {string} url 
 * @returns {boolean}
 */
const validateGoogleSheetsUrl = (url) => {
  if (!url) return false;
  
  // Accept Google Sheets URLs
  const validPatterns = [
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/,
    /^https:\/\/docs\.google\.com\/spreadsheets\/u\/\d+\/d\/[a-zA-Z0-9-_]+/,
    /^[a-zA-Z0-9-_]+$/ // Direct spreadsheet ID
  ];
  
  return validPatterns.some(pattern => pattern.test(url));
};

/**
 * Test Google Sheets connection
 * @param {string} googleSheetsUrl - The Google Sheets URL
 * @returns {Object} Test result
 */
const testGoogleSheetsConnection = async (googleSheetsUrl) => {
  try {
    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      return { success: false, error: 'Invalid Google Sheets URL format' };
    }

    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Try to read the spreadsheet metadata
    const response = await sheets.spreadsheets.get({
      spreadsheetId
    });

    return { 
      success: true, 
      title: response.data.properties.title,
      message: 'Successfully connected to Google Sheets'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Failed to connect to Google Sheets'
    };
  }
};

module.exports = {
  appendToGoogleSheets,
  appendToCompetitionGoogleSheets,
  validateGoogleSheetsUrl,
  testGoogleSheetsConnection,
  extractSpreadsheetId
};