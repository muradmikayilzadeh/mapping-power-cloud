// Tells video files (uploaded for pin popups) apart from images, based on
// the file extension in the URL/name. Firebase Storage download URLs keep
// the original extension before the "?" query string.
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|ogg|ogv|m4v)$/i;

export function isVideoFile(nameOrUrl) {
  if (!nameOrUrl || typeof nameOrUrl !== 'string') return false;
  const clean = nameOrUrl.split('?')[0];
  return VIDEO_EXTENSIONS.test(clean);
}
