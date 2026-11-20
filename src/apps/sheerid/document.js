import { open } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { AutomationError, requireValue } from '../../core/errors.js';
import { networkFetch } from '../../core/network.js';

const MAX_BYTES = 20 * 1024 * 1024; // Buffering limit, not a claim about a program's upload limit.

export function selectDocumentSource(document = {}, { file, url } = {}, data) {
  requireValue(!(file !== undefined && url !== undefined), 'Only one of --file and --url may be specified');
  if (file !== undefined) return { path: file };
  if (url === undefined) {
    requireValue(!(document.path?.trim() && document.url?.trim()), 'Only one of document.path and document.url may be set');
    if (!document.url?.trim()) return { path: document.path };
    url = document.url;
  }
  // Standalone material configs may omit personal data. When supplied, both
  // names are required so the source retrieves the intended original document.
  if (data?.firstName === undefined && data?.lastName === undefined) return { url };
  requireValue(typeof data?.firstName === 'string' && data.firstName.trim().length > 0
    && typeof data?.lastName === 'string' && data.lastName.trim().length > 0,
    'Downloading materials by name requires both data.firstName and data.lastName');
  const sourceUrl = downloadUrl(url);
  sourceUrl.searchParams.set('name', `${data.firstName.trim()} ${data.lastName.trim()}`);
  return { url: sourceUrl.href };
}

function metadata(bytes, filename) {
  let mimeType;
  let extension;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mimeType = 'image/png'; extension = '.png';
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    mimeType = 'image/jpeg'; extension = '.jpg';
  } else if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    mimeType = 'application/pdf'; extension = '.pdf';
  }
  requireValue(Boolean(mimeType), 'The material content must be PNG, JPEG, or PDF; an HTML login page or a JSON response is not accepted');
  if (filename) {
    const suffix = extname(filename).toLowerCase();
    requireValue(suffix === extension || (extension === '.jpg' && suffix === '.jpeg'),
      'The local material extension does not match the file header');
  }
  return { bytes, mimeType, fileSize: bytes.length, fileName: filename ?? `document${extension}` };
}

function downloadUrl(value) {
  let url;
  try { url = new URL(value); } catch {
    throw new AutomationError('INVALID_DOCUMENT_URL', 'The material network address is not a valid URL');
  }
  requireValue(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password,
    'The material network address only supports HTTP/HTTPS URLs without embedded credentials');
  url.hash = '';
  return url;
}

async function readRemoteDocument(source, { signal, timeoutMs = 120000 } = {}) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const downloadSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let response;
  try {
    let url = downloadUrl(source);
    for (let redirects = 0; ; redirects++) {
      // A loopback material URL names this computer, not the upstream proxy host.
      // Re-evaluate each redirect so remote destinations still use the configured route.
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      response = await (loopback ? fetch : networkFetch)(url, { signal: downloadSignal, redirect: 'manual',
        cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      await response.body?.cancel();
      requireValue(redirects < 3, 'The material download exceeded 3 redirects');
      const location = response.headers.get('location');
      requireValue(Boolean(location), 'The material download redirect is missing a target address');
      const next = downloadUrl(new URL(location, url).href);
      requireValue(!(url.protocol === 'https:' && next.protocol === 'http:'), 'The material download does not allow a redirect from HTTPS to HTTP');
      url = next;
    }
    requireValue(response.ok && response.status !== 206, 'The material download did not return a complete successful response');
    const length = response.headers.get('content-length');
    if (length !== null) {
      requireValue(/^\d+$/.test(length) && Number(length) > 0 && Number(length) <= MAX_BYTES,
        'The network material must be non-empty and must not exceed this project\'s 20 MiB limit');
    }
    requireValue(Boolean(response.body), 'The material download response has no file content');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      requireValue(size <= MAX_BYTES, 'The network material exceeds this project\'s 20 MiB limit');
      chunks.push(chunk);
    }
    downloadSignal.throwIfAborted();
    requireValue(size > 0, 'The network material content is empty');
    // Fetch decompresses bodies; compare Content-Length only for unencoded responses.
    if (length !== null && !response.headers.get('content-encoding')) {
      requireValue(size === Number(length), 'The network material download is incomplete');
    }
    return metadata(Buffer.concat(chunks, size));
  } catch (error) {
    if (signal?.aborted) throw new AutomationError('CANCELLED', 'The material download was canceled');
    if (deadline.aborted) throw new AutomationError('DOCUMENT_DOWNLOAD_TIMEOUT', 'The material download timed out');
    if (error instanceof AutomationError) throw error;
    // Do not expose source URLs, query parameters or server response bodies in errors.
    throw new AutomationError('DOCUMENT_DOWNLOAD_FAILED', 'Could not download the network material; please check the address and network connection');
  } finally {
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
  }
}

export async function readDocument(source, options = {}) {
  options.signal?.throwIfAborted();
  if (typeof source === 'string') return readLocalDocument(source, options.signal);
  requireValue(source && !(source.path !== undefined && source.url !== undefined), 'Only one material source may be specified');
  if (source.url !== undefined) return readRemoteDocument(source.url, options);
  return readLocalDocument(source.path, options.signal);
}

async function readLocalDocument(filename, signal) {
  requireValue(typeof filename === 'string' && filename.trim().length > 0,
    'Please specify a local material via --file / document.path, or a network material via --url / document.url; the remote verification status has not been modified');
  requireValue(!/^[a-z][a-z\d+.-]*:\/\//i.test(filename), 'document.path only accepts a local file path');
  const path = resolve(filename);
  let file;
  try { file = await open(path, 'r'); } catch (cause) {
    throw new AutomationError('DOCUMENT_UNREADABLE', 'Could not open the specified local proof file', { cause });
  }
  try {
    const stat = await file.stat();
    requireValue(stat.isFile() && stat.size > 0 && stat.size <= MAX_BYTES, 'The proof file must be a non-empty regular file and must not exceed this project\'s 20 MiB limit');
    const bytes = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < bytes.length) {
      signal?.throwIfAborted();
      const read = await file.read(bytes, size, bytes.length - size, null);
      if (read.bytesRead === 0) break;
      size += read.bytesRead;
    }
    requireValue(size === stat.size, 'The size changed while reading the file; please run again after the file has finished saving');
    const data = bytes.subarray(0, size);
    return metadata(data, basename(path));
  } finally {
    await file.close();
  }
}
