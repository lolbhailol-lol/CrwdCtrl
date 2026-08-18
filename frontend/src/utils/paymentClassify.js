/**
 * Map Cashfree / verify outcomes to UI kinds. Pure — safe for unit tests.
 */

export function classifyVerifyResponse(data = {}, httpStatus = 200) {
  const verified = Boolean(data?.verified);
  const status = data?.status || (verified ? 'paid' : 'failed');
  const code = data?.code || (verified ? 'PAYMENT_PAID' : 'PAYMENT_FAILED');
  const retryable = data?.retryable ?? status === 'pending';

  return {
    verified,
    status,
    code,
    message: data?.message || '',
    retryable,
    data,
    httpStatus,
  };
}

export function classifyVerifyError(result = {}) {
  const status = result.status || result.classified?.status;
  const code = result.code || result.classified?.code;
  const message = result.data?.message || result.message || result.classified?.message || '';

  if (status === 'cancelled' || code === 'PAYMENT_CANCELLED') {
    return {
      kind: 'cancelled',
      message: message || 'Payment was cancelled. You can try again when ready.',
    };
  }

  if (status === 'pending' || code === 'PAYMENT_PENDING') {
    return {
      kind: 'pending',
      message: message || 'Payment is still processing. Please wait a moment…',
    };
  }

  if (code === 'ORDER_OWNERSHIP_MISMATCH') {
    return {
      kind: 'failed',
      message: message || 'This payment belongs to a different account. Sign in and try again.',
    };
  }

  if (code === 'ORDER_EMAIL_REQUIRED') {
    return {
      kind: 'failed',
      message: message || 'Use the same email from checkout to confirm this payment.',
    };
  }

  if (
    code === 'NETWORK_ERROR'
    || /network|timeout|timed out|offline|internet|connection|failed to fetch/i.test(message)
  ) {
    return {
      kind: 'network',
      message: 'We couldn’t verify your payment. Check your connection and try again.',
    };
  }

  return {
    kind: 'failed',
    message: message || 'Payment could not be verified.',
  };
}

export function classifyCheckoutError(error) {
  const raw =
    (typeof error === 'string' ? error : error?.message) || 'Payment could not be completed.';
  const msg = raw.toLowerCase();

  if (
    /cancel|dismiss|closed by user|user closed|user_cancelled|aborted|back press/i.test(msg)
  ) {
    return {
      kind: 'cancelled',
      message: 'Payment was cancelled. You can try again whenever you’re ready.',
    };
  }

  if (
    /network|timeout|timed out|offline|internet|connection|failed to fetch|econn|unreachable/i.test(
      msg,
    )
  ) {
    return {
      kind: 'network',
      message:
        'We couldn’t reach the payment gateway. Check your internet connection and try again.',
    };
  }

  return {
    kind: 'failed',
    message:
      'Your payment didn’t go through. If money was deducted it will be refunded automatically. Please try again.',
  };
}
