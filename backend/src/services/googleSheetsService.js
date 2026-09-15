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
    
    if (responses['Payment Receipt']) headers.push('Payment Receipt');
    if (responses['Transaction ID']) headers.push('Transaction ID');
    if (responses['Payment ID']) headers.push('Payment ID');

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
    console.log('🔍 MATCHING FIELDS - Frontend responses keys:', Object.keys(responses));
    console.log('🔍 MATCHING FIELDS - Backend formSchema fields:', formSchema.map(f => ({ label: f.label, id: f.id, fieldName: f.fieldName })));
    
    formSchema.forEach(field => {
      let fieldValue = null;
      let matchedFieldId = null;
      
      // Try multiple key formats to find the value
      // Priority: fieldName > id variations > label-based > position-based fallback
      
      // 1. Try exact fieldName
      if (field.fieldName && responses[field.fieldName] !== undefined) {
        fieldValue = responses[field.fieldName];
        matchedFieldId = field.fieldName;
        console.log('✅ Matched by fieldName:', field.label, '→', matchedFieldId);
      }
      // 2. Try field.id (might be hash without field_ prefix)
      else if (field.id && responses[field.id] !== undefined) {
        fieldValue = responses[field.id];
        matchedFieldId = field.id;
        console.log('✅ Matched by id:', field.label, '→', matchedFieldId);
      }
      // 3. Try with field_ prefix on id
      else if (field.id && responses[`field_${field.id}`] !== undefined) {
        fieldValue = responses[`field_${field.id}`];
        matchedFieldId = `field_${field.id}`;
        console.log('✅ Matched by field_id:', field.label, '→', matchedFieldId);
      }
      // 4. Generate from label and try
      else if (field.label) {
        const generatedId = `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
        if (responses[generatedId] !== undefined) {
          fieldValue = responses[generatedId];
          matchedFieldId = generatedId;
          console.log('✅ Matched by generated label ID:', field.label, '→', matchedFieldId);
        }
      }
      
      // 5. Fallback: If no exact match, try field_ prefix variations of the ID
      if ((fieldValue === null || fieldValue === undefined) && field.id) {
        // Try the plain ID without any prefix
        const allResponseKeys = Object.keys(responses).filter(k => k.startsWith('field_'));
        if (allResponseKeys.length > 0) {
          // Use position-based matching if we know the field position
          const fieldIndex = formSchema.indexOf(field);
          if (fieldIndex >= 0 && fieldIndex < allResponseKeys.length) {
            fieldValue = responses[allResponseKeys[fieldIndex]];
            matchedFieldId = allResponseKeys[fieldIndex];
            console.log('✅ Matched by position fallback:', field.label, '→', matchedFieldId, 'at index', fieldIndex);
          }
        }
      }
      
      // If still not found, log what we tried
      if (fieldValue === null || fieldValue === undefined) {
        console.log('❌ NO MATCH FOUND for field:', field.label);
        console.log('   Tried keys:', [field.fieldName, field.id, `field_${field.id}`, `field_${field.label?.toLowerCase().replace(/[^a-z0-9]/g, '_')}`]);
        console.log('   Available response keys:', Object.keys(responses));
      }
      
      if (field.type === 'image' || field.type === 'file') {
        // For file/image fields: show "🔗 View" hyperlink if uploaded
        let fileUrl = null;
        
        // ✅ NEW: Handle both string URLs and object format {url: '...'}
        if (fieldValue) {
          if (typeof fieldValue === 'string' && fieldValue.startsWith('http')) {
            fileUrl = fieldValue;
          } else if (typeof fieldValue === 'object' && fieldValue.url && fieldValue.url.startsWith('http')) {
            fileUrl = fieldValue.url;
          }
        }
        
        if (fileUrl) {
          // Use HYPERLINK formula but ensure it displays as clickable text
          rowData.push(`=HYPERLINK("${fileUrl}","🔗 View")`);
          console.log('✅ File field added:', { label: field.label, fieldId: matchedFieldId, url: fileUrl });
        } else {
          rowData.push('');
          console.log('⚠️ File field empty or no URL:', { label: field.label, fieldId: matchedFieldId, value: fieldValue });
        }
      } else if (field.type === 'group') {
        // ✅ NEW: Handle group field type - format array of objects as readable string
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
          // Format each entry as a readable string
          const formattedEntries = fieldValue.map((entry, idx) => {
            if (typeof entry === 'object' && entry !== null) {
              // Get the sub-field values and format them
              const entryParts = Object.entries(entry)
                .filter(([key, val]) => val !== '' && val !== null && val !== undefined)
                .map(([key, val]) => `${key}: ${val}`)
                .join(', ');
              return `[Entry ${idx + 1}: ${entryParts}]`;
            }
            return String(entry);
          });
          rowData.push(formattedEntries.join(' | '));
          console.log('✅ Group field added:', { label: field.label, entries: fieldValue.length });
        } else {
          rowData.push('');
          console.log('⚠️ Group field empty:', { label: field.label });
        }
      } else if (field.type === 'category_competition_selector' && typeof fieldValue === 'object' && fieldValue !== null) {
        // ✅ Handle category_competition_selector - format as "Category - Competition"
        const formatted = `${fieldValue.category || ''} - ${fieldValue.competition || ''}`;
        rowData.push(formatted);
        console.log('✅ Category-Competition field added:', { label: field.label, category: fieldValue.category, competition: fieldValue.competition });
      } else {
        // For other fields: show actual value or empty string
        if (Array.isArray(fieldValue)) {
          // Check if it's an array of objects (shouldn't normally happen for non-group fields)
          if (fieldValue.length > 0 && typeof fieldValue[0] === 'object') {
            // Convert array of objects to JSON string
            rowData.push(JSON.stringify(fieldValue));
          } else {
            rowData.push(fieldValue.join(', '));
          }
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          // Handle any other object types - convert to readable string
          rowData.push(JSON.stringify(fieldValue));
        } else {
          rowData.push(fieldValue ?? '');
        }
        console.log('✅ Text field added:', { label: field.label, fieldId: matchedFieldId, value: fieldValue });
      }
    });

    // ✅ ALWAYS add Payment Receipt data if available in responses
    if (responses['Payment Receipt']) {
      const paymentReceiptData = responses['Payment Receipt'];
      console.log('💳 Processing competition payment receipt from responses:', paymentReceiptData);
      
      let paymentReceiptUrl = null;
      
      // ✅ NEW: Handle both string URLs and object format {url: '...'}
      if (typeof paymentReceiptData === 'string' && paymentReceiptData.startsWith('http')) {
        paymentReceiptUrl = paymentReceiptData;
      } else if (typeof paymentReceiptData === 'object' && paymentReceiptData.url && paymentReceiptData.url.startsWith('http')) {
        paymentReceiptUrl = paymentReceiptData.url;
      }
      
      if (paymentReceiptUrl) {
        // Use HYPERLINK formula for clickable link
        rowData.push(`=HYPERLINK("${paymentReceiptUrl}","🔗 View Receipt")`);
        console.log('✅ Competition payment receipt added to Google Sheets row data');
      } else {
        rowData.push('');
        console.log('⚠️ Competition payment receipt URL not valid:', paymentReceiptData);
      }
    }

    if (responses['Transaction ID']) {
      const tid = responses['Transaction ID'];
      rowData.push(tid && typeof tid === 'string' && tid.trim() ? tid : '');
    }

    if (responses['Payment ID']) {
      rowData.push(responses['Payment ID']);
      console.log('✅ Payment ID added to competition sheets row');
    }

    // Append the new row
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
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
    
    if (responses['Payment Receipt']) headers.push('Payment Receipt');
    if (responses['Transaction ID']) headers.push('Transaction ID');
    if (responses['Payment ID']) headers.push('Payment ID');

    // Add headers if sheet is empty or headers don't match
    const hasPaymentReceiptInResponses = !!responses['Payment Receipt'];
    const hasPaymentReceiptColumn = existingHeaders.includes('Payment Receipt');
    const hasTransactionIdInResponses = !!responses['Transaction ID'];
    const hasTransactionIdColumn = existingHeaders.includes('Transaction ID');
    
    const headersNeedUpdate = existingHeaders.length === 0 || 
                             !arraysEqual(existingHeaders, headers) ||
                             (hasPaymentReceiptInResponses && !hasPaymentReceiptColumn) ||
                             (hasTransactionIdInResponses && !hasTransactionIdColumn);
    
    if (headersNeedUpdate) {
      console.log('📝 Creating/updating headers...');
      console.log('🔍 Header update reason:', {
        emptyHeaders: existingHeaders.length === 0,
        headersMismatch: !arraysEqual(existingHeaders, headers),
        hasPaymentReceiptInResponses: hasPaymentReceiptInResponses,
        hasPaymentReceiptColumn: hasPaymentReceiptColumn,
        hasTransactionIdInResponses: hasTransactionIdInResponses,
        hasTransactionIdColumn: hasTransactionIdColumn
      });
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
        
        // ✅ Handle group field type - array of objects
        if (field.type === 'group' && Array.isArray(value) && value.length > 0) {
          // Format each entry as a readable string
          const formattedEntries = value.map((entry, idx) => {
            if (typeof entry === 'object' && entry !== null) {
              const entryParts = Object.entries(entry)
                .filter(([key, val]) => val !== '' && val !== null && val !== undefined)
                .map(([key, val]) => `${key}: ${val}`)
                .join(', ');
              return `[Entry ${idx + 1}: ${entryParts}]`;
            }
            return String(entry);
          });
          rowData.push(formattedEntries.join(' | '));
        } else if (field.type === 'category_competition_selector' && typeof value === 'object' && value !== null) {
          // ✅ Handle category_competition_selector - format as "Category: X, Competition: Y"
          const formatted = `${value.category || ''} - ${value.competition || ''}`;
          rowData.push(formatted);
        } else if (Array.isArray(value)) {
          // Check if it's an array of objects (shouldn't normally happen for non-group fields)
          if (value.length > 0 && typeof value[0] === 'object') {
            rowData.push(JSON.stringify(value));
          } else {
            rowData.push(value.join(', '));
          }
        } else if (typeof value === 'object' && value !== null) {
          // Handle any other object types - convert to readable string
          rowData.push(JSON.stringify(value));
        } else {
          rowData.push(value ?? '');
        }
      }
    });

    // ✅ ALWAYS add Payment Receipt data if available in responses
    if (responses['Payment Receipt']) {
      const paymentReceiptUrl = responses['Payment Receipt'];
      console.log('💳 Processing payment receipt from responses:', paymentReceiptUrl);
      
      if (paymentReceiptUrl && typeof paymentReceiptUrl === 'string' && paymentReceiptUrl.startsWith('http')) {
        // Use HYPERLINK formula for clickable link
        rowData.push(`=HYPERLINK("${paymentReceiptUrl}","🔗 View Receipt")`);
        console.log('✅ Payment receipt added to Google Sheets row data with HYPERLINK formula');
      } else {
        rowData.push('');
        console.log('⚠️ Payment receipt URL not valid:', paymentReceiptUrl);
      }
    } else {
      console.log('⚠️ No payment receipt in responses - Payment Receipt column will be empty');
    }

    if (responses['Transaction ID']) {
      const tid = responses['Transaction ID'];
      rowData.push(tid && typeof tid === 'string' && tid.trim() ? tid : '');
      console.log('✅ Transaction ID added to Google Sheets row data');
    }

    if (responses['Payment ID']) {
      rowData.push(responses['Payment ID']);
      console.log('✅ Payment ID added to sheets row');
    }

    console.log('📊 Row data prepared:', { rowLength: rowData.length });

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
 * Append an event-show registration to the organiser's Google Sheet.
 * Mirrors the competition exporter but with event-appropriate headers and
 * dedicated payment columns (Amount Paid / Payment ID / Payment Status).
 *
 * @param {string} googleSheetsUrl - Organiser's Google Sheets URL
 * @param {Object} responses - Form responses keyed by field name
 * @param {Object} eventInfo - { eventName, registrationId, amountPaid, paymentId, paymentStatus }
 * @param {Object} userInfo - { name, email, phone }
 * @param {Array} formSchema - Flattened event form schema (label/fieldName/type/...)
 */
const appendToEventGoogleSheets = async (googleSheetsUrl, responses, eventInfo, userInfo, formSchema) => {
  try {
    console.log('📊 Starting Event Google Sheets integration...');

    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      throw new Error('Invalid Google Sheets URL format');
    }

    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = spreadsheetInfo.data.sheets[0].properties.title;
    console.log('📄 Using sheet:', sheetName);

    let existingHeaders = [];
    try {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      existingHeaders = headerResponse.data.values ? headerResponse.data.values[0] : [];
    } catch {
      console.log('📝 No existing headers found, will create new ones');
    }

    const safeFormSchema = Array.isArray(formSchema) ? formSchema : [];

    // Build headers: meta + form fields + package + payment columns
    const headers = ['Timestamp', 'Name', 'Email', 'Phone', 'Event', 'Registration ID'];
    safeFormSchema.forEach((field) => headers.push(field.label || field.fieldName || 'Field'));
    // Extra keys stored on registration but not in schema (e.g. driver_count)
    const schemaFieldNames = new Set(
      safeFormSchema.map((f) => String(f.fieldName || '').trim()).filter(Boolean),
    );
    const extraKeys = Object.keys(responses || {})
      .filter((k) => k && !schemaFieldNames.has(k))
      .sort();
    extraKeys.forEach((k) => headers.push(k));
    headers.push('Package', 'Amount Paid (₹)', 'Payment ID', 'Payment Status');

    if (existingHeaders.length === 0 || !arraysEqual(existingHeaders, headers)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] },
      });
      console.log('✅ Event sheet headers updated');
    }

    const rowData = [
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      userInfo.name || '',
      userInfo.email || '',
      userInfo.phone || '',
      eventInfo.eventName || '',
      eventInfo.registrationId ? String(eventInfo.registrationId) : '',
    ];

    // Map each configured field to its response value (matched by fieldName)
    safeFormSchema.forEach((field) => {
      const possibleKeys = [
        field.fieldName,
        field.id,
        `field_${field.id}`,
        field.label && `field_${field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`,
      ].filter(Boolean);

      let value;
      for (const key of possibleKeys) {
        if (responses && Object.prototype.hasOwnProperty.call(responses, key)) {
          value = responses[key];
          break;
        }
      }

      // File / image uploads → clickable link (supports multiple)
      if (field.type === 'image' || field.type === 'file') {
        const toUrl = (v) => {
          if (typeof v === 'string' && v.startsWith('http')) return v;
          if (v && typeof v === 'object' && typeof v.url === 'string' && v.url.startsWith('http')) return v.url;
          return null;
        };
        if (Array.isArray(value)) {
          const urls = value.map(toUrl).filter(Boolean);
          // Single HYPERLINK if one file; otherwise list raw URLs (one per line)
          rowData.push(
            urls.length === 1
              ? `=HYPERLINK("${urls[0]}","🔗 View")`
              : urls.join('\n'),
          );
        } else {
          const fileUrl = toUrl(value);
          rowData.push(fileUrl ? `=HYPERLINK("${fileUrl}","🔗 View")` : '');
        }
        return;
      }

      if (Array.isArray(value)) {
        rowData.push(value.length && typeof value[0] === 'object' ? JSON.stringify(value) : value.join(', '));
      } else if (value && typeof value === 'object') {
        rowData.push(JSON.stringify(value));
      } else {
        rowData.push(value ?? '');
      }
    });

    extraKeys.forEach((k) => {
      const value = responses?.[k];
      if (Array.isArray(value)) {
        rowData.push(value.length && typeof value[0] === 'object' ? JSON.stringify(value) : value.join(', '));
      } else if (value && typeof value === 'object') {
        rowData.push(JSON.stringify(value));
      } else {
        rowData.push(value ?? '');
      }
    });

    rowData.push(
      eventInfo.tierName || '',
      eventInfo.amountPaid != null ? eventInfo.amountPaid : 0,
      eventInfo.paymentId || '',
      eventInfo.paymentStatus || '',
    );

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [rowData] },
    });

    console.log('✅ Event registration appended to Google Sheets:', appendResponse.data.updates.updatedRange);
    return {
      success: true,
      message: 'Event registration synced to Google Sheets',
      updatedRange: appendResponse.data.updates.updatedRange,
    };
  } catch (error) {
    console.error('❌ Event Google Sheets integration error:', error.message);
    return { success: false, error: error.message || 'Failed to sync with Google Sheets' };
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

/**
 * Append a paid (no-form) registration to Google Sheets.
 */
const appendPaymentOnlyToSheets = async (googleSheetsUrl, { name, email, phone, amountPaid, paymentId, entityName, entityType }) => {
  try {
    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) return { success: false, error: 'Invalid Google Sheets URL' };

    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = spreadsheetInfo.data.sheets[0].properties.title;

    const headers = ['Timestamp', 'Name', 'Email', 'Phone', entityType || 'Event', 'Amount Paid (₹)', 'Payment ID'];

    let existingHeaders = [];
    try {
      const hr = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!1:1` });
      existingHeaders = hr.data.values ? hr.data.values[0] : [];
    } catch (_) { /* no headers yet */ }

    if (existingHeaders.length === 0 || !arraysEqual(existingHeaders, headers)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] },
      });
    }

    const rowData = [
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      name || '',
      email || '',
      phone || '',
      entityName || '',
      amountPaid || 0,
      paymentId || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [rowData] },
    });

    console.log('✅ Payment-only registration saved to Google Sheets');
    return { success: true };
  } catch (error) {
    console.error('❌ appendPaymentOnlyToSheets error:', error.message);
    return { success: false, error: error.message };
  }
};

const CHECKIN_SHEET_TITLE = 'Check-ins';
const CHECKIN_HEADERS = [
  'Checked In At',
  'Name',
  'Email',
  'Fest',
  'Competition',
  'Ticket Type',
  'Registration ID',
  'Status',
  'Scanned By',
];

async function ensureCheckinSheet(sheets, spreadsheetId) {
  const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  let sheet = spreadsheetInfo.data.sheets.find(
    (s) => s.properties.title === CHECKIN_SHEET_TITLE,
  );

  if (!sheet) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{ addSheet: { properties: { title: CHECKIN_SHEET_TITLE } } }],
      },
    });
    const newSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
    sheet = { properties: { title: CHECKIN_SHEET_TITLE, sheetId: newSheetId } };
  }

  return sheet.properties.title;
}

/**
 * Log a successful QR check-in to a dedicated "Check-ins" tab (created if missing).
 */
const appendCheckinToGoogleSheets = async (googleSheetsUrl, checkinData) => {
  try {
    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      return { success: false, error: 'Invalid Google Sheets URL' };
    }

    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = await ensureCheckinSheet(sheets, spreadsheetId);

    let existingHeaders = [];
    try {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      existingHeaders = headerResponse.data.values ? headerResponse.data.values[0] : [];
    } catch {
      existingHeaders = [];
    }

    if (existingHeaders.length === 0 || !arraysEqual(existingHeaders, CHECKIN_HEADERS)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        resource: { values: [CHECKIN_HEADERS] },
      });
    }

    const rowData = [
      checkinData.checkedInAt
        ? new Date(checkinData.checkedInAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      checkinData.userName || '',
      checkinData.userEmail || '',
      checkinData.festName || '',
      checkinData.competitionName || '',
      checkinData.ticketType || 'fest',
      checkinData.registrationId ? String(checkinData.registrationId) : '',
      checkinData.status || 'Completed',
      checkinData.scannedBy || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [rowData] },
    });

    console.log('✅ Check-in logged to Google Sheets tab:', CHECKIN_SHEET_TITLE);
    return { success: true };
  } catch (error) {
    console.error('❌ appendCheckinToGoogleSheets error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  appendToGoogleSheets,
  appendToCompetitionGoogleSheets,
  appendToEventGoogleSheets,
  appendPaymentOnlyToSheets,
  appendCheckinToGoogleSheets,
  validateGoogleSheetsUrl,
  testGoogleSheetsConnection,
  extractSpreadsheetId,
};