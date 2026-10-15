// FastAPI validation details can be objects or arrays, which React cannot render.
export const getApiErrorMessage = (error, fallback = 'The request failed. Please try again.') => {
  const detail = error?.response?.data?.detail;
  const formatDetail = (item) => {
    if (typeof item === 'string') return item.trim();
    if (!item || typeof item.msg !== 'string') return '';

    const field = Array.isArray(item.loc)
      ? item.loc
        .filter((part) => !['body', 'query', 'path', 'header', 'cookie'].includes(part))
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join('.')
      : '';
    const message = item.msg.trim();
    return message && field ? `${field}: ${message}` : message;
  };

  const messages = (Array.isArray(detail) ? detail : [detail])
    .map(formatDetail)
    .filter(Boolean);
  return messages.join('; ') || fallback;
};
