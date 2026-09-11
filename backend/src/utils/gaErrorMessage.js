/**
 * Turn googleapis / GA4 Data API failures into short admin-safe messages.
 * Never surface Google HTML error pages (502 robot pages) in the UI.
 */

const SETUP_HINT =
  'Check GA4_PROPERTY_ID, Google Analytics Data API enablement, and service-account Viewer access on the property.';

function extractRawMessage(error) {
  if (!error) return 'Unknown error';
  const fromErrors = error?.errors?.[0]?.message;
  if (fromErrors) return String(fromErrors);
  if (typeof error?.response?.data === 'string') return error.response.data;
  if (error?.response?.data?.error?.message) return String(error.response.data.error.message);
  if (error?.message) return String(error.message);
  return String(error);
}

function looksLikeHtmlOrGatewayPage(msg) {
  return /<!DOCTYPE|<html[\s>]|Error 502|Error 503|Error 500|That’s an error|robot\.png/i.test(msg);
}

function httpStatus(error) {
  return Number(
    error?.code
    || error?.status
    || error?.response?.status
    || error?.response?.statusCode
    || 0,
  );
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function describeGaError(error) {
  const raw = extractRawMessage(error);
  const status = httpStatus(error);
  const msg = looksLikeHtmlOrGatewayPage(raw)
    ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
    : raw;

  if (
    looksLikeHtmlOrGatewayPage(raw)
    || status === 502
    || status === 503
    || status === 504
    || /502|503|504|ECONNRESET|ETIMEDOUT|socket hang up|temporarily unavailable|fetch failed/i.test(raw)
  ) {
    return 'Google Analytics is temporarily unavailable (Google gateway error). Try again in a minute — CrwdCtrl login activity is unaffected.';
  }

  if (/permission|caller does not have|403|PERMISSION_DENIED/i.test(msg)) {
    return 'The service account does not have access to this GA4 property. Grant it "Viewer" access in GA4 Admin → Property Access Management.';
  }
  if (/has not been used|disabled|Data API|SERVICE_DISABLED/i.test(msg)) {
    return 'The Google Analytics Data API is not enabled for this project. Enable it in Google Cloud Console.';
  }
  if (/property|INVALID_ARGUMENT|404|not found/i.test(msg) && /property|GA4|analytics/i.test(msg + SETUP_HINT)) {
    return 'Invalid GA4_PROPERTY_ID. Use the numeric Property ID from GA4 Admin → Property Settings.';
  }
  if (/invalid_grant|invalid_client|private.?key|JWT|credentials/i.test(msg)) {
    return 'Google service account credentials look invalid. Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.';
  }

  const cleaned = msg.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 280) {
    return `Could not load Google Analytics right now. ${SETUP_HINT}`;
  }
  return cleaned;
}

module.exports = {
  describeGaError,
  extractRawMessage,
  looksLikeHtmlOrGatewayPage,
};
