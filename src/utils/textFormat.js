export function capitalizeDisplayName(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  return text
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const first = word.charAt(0).toLocaleUpperCase();
      const rest = word.slice(1);
      return `${first}${rest}`;
    })
    .join(' ');
}
