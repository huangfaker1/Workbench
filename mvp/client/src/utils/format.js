export function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

export function formatFolderPath(path = []) {
  return path.join(' / ');
}
