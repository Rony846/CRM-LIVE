import axios from 'axios';

/**
 * Open an uploaded file that lives behind the authenticated /uploads route.
 *
 * The /uploads and /files endpoints require a Bearer JWT (or a signed URL);
 * a plain <a href> link sends neither and gets a 401. This fetches the file
 * with the auth header as a blob and opens that in a new tab.
 *
 * Opens the tab synchronously (before the first await) so the browser keeps
 * it as a user-initiated action and the popup blocker stays out of the way.
 *
 * @param {string} pathOrUrl - invoice_file value (relative path or absolute URL)
 * @param {string} token     - JWT
 * @param {string} apiBase   - the API base (e.g. `${BACKEND}/api`)
 * @returns {Promise<boolean>} true on success
 */
export async function openAuthedFile(pathOrUrl, token, apiBase) {
  if (!pathOrUrl) return false;
  const win = window.open('', '_blank');
  try {
    const origin = (apiBase || '').replace(/\/api$/, '');
    const url = /^https?:/i.test(pathOrUrl)
      ? pathOrUrl
      : `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });
    const blobUrl = URL.createObjectURL(resp.data);
    if (win) win.location = blobUrl;
    else window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return true;
  } catch (e) {
    if (win) win.close();
    return false;
  }
}
