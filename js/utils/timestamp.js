// Updates the "Last updated" timestamp in the header

export function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (!el) return;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const dd   = String(now.getUTCDate()).padStart(2, '0');
  const mon  = months[now.getUTCMonth()];
  const yyyy = now.getUTCFullYear();
  const hh   = String(now.getUTCHours()).padStart(2, '0');
  const mm   = String(now.getUTCMinutes()).padStart(2, '0');

  el.textContent = `Last updated: ${dd} ${mon} ${yyyy}, ${hh}:${mm} UTC`;
}
