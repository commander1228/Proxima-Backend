export function validateImageUrl(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;

  // Allow our own S3 bucket
  const s3Prefix = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
  if (imageUrl.startsWith(s3Prefix)) return imageUrl;

  // Allow Giphy CDN URLs (used by the in-app GIF picker)
  const ALLOWED_GIF_PATTERNS = [
    /^https:\/\/media\d?\.giphy\.com\//,
    /^https:\/\/i\.giphy\.com\//,
  ];
  for (const pattern of ALLOWED_GIF_PATTERNS) {
    if (pattern.test(imageUrl)) return imageUrl;
  }

  // Log for debugging but don't fail the whole post — just drop the image
  console.warn(`[validateImageUrl] Rejected non-allowed URL: ${imageUrl.slice(0, 60)}`);
  return undefined;
}