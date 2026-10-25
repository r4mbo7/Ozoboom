export function downloadJson(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // The browser reads the file after the click returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  });
}
