/**
 * Helper to safely extract string error messages from API responses.
 * FastAPI validation errors return arrays: [{ loc: [...], msg: "..." }]
 * Passing raw arrays to Alert.alert causes Android DialogModule native crashes.
 */
export function formatApiError(error: any, fallbackMessage: string = 'An error occurred'): string {
  if (!error) return fallbackMessage;

  const detail = error.response?.data?.detail ?? error.detail ?? error.message;

  if (!detail) return fallbackMessage;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.msg || item.detail || JSON.stringify(item);
        }
        return String(item);
      })
      .join('\n');
  }

  if (typeof detail === 'object') {
    if (detail.msg) return String(detail.msg);
    if (detail.detail) return String(detail.detail);
    return JSON.stringify(detail);
  }

  return String(detail);
}
