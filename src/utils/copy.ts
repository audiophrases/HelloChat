// Copies text, also where the clipboard API is missing (a laptop page opened over plain http).
// When nothing works, the text is shown in a box to copy by hand. True when it was copied.
export async function copyText(text: string, what = 'Copy this link for your students:'): Promise<boolean> {
  try { if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; } } catch { /* try the old way */ }
  const box = document.createElement('textarea');
  box.value = text; box.setAttribute('readonly', ''); box.style.position = 'fixed'; box.style.opacity = '0';
  document.body.appendChild(box); box.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* not allowed */ }
  box.remove();
  if (!copied) window.prompt(what, text);
  return copied;
}
