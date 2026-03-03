const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export function cloudinaryAssetUrl(assetId: string | null | undefined, type: "image" | "gif") {
  if (!assetId || !CLOUDINARY_CLOUD_NAME) return null;
  const resourceType = type === "gif" ? "image" : "image";
  const format = type === "gif" ? "gif" : "webp";
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/f_auto,q_auto/${assetId}.${format}`;
}
