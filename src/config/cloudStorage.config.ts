import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import dayjs from 'dayjs';
import path from 'path';

const SPACES_REGION = process.env.SPACES_REGION || 'sgp1';
const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT || `https://${SPACES_REGION}.digitaloceanspaces.com`;
const SPACES_KEY = process.env.SPACES_KEY;
const SPACES_SECRET = process.env.SPACES_SECRET;

if (!SPACES_KEY || !SPACES_SECRET) {
  throw new Error('SPACES_KEY and SPACES_SECRET environment variables are required');
}

export const storage = new S3Client({
  region: SPACES_REGION,
  endpoint: SPACES_ENDPOINT,
  credentials: {
    accessKeyId: SPACES_KEY,
    secretAccessKey: SPACES_SECRET,
  },
  forcePathStyle: false,
});

const getPublicUrl = (bucketName: string, key: string): string => {
  return `https://${bucketName}.${SPACES_REGION}.cdn.digitaloceanspaces.com/${key}`;
};

export interface UploadMetadata {
  username?: string;
  email?: string;
  [key: string]: string | undefined;
}

const sanitizeMetadata = (metadata: UploadMetadata = {}, baseFields: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = { ...baseFields };
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const cleanValue = String(value).replace(/[\r\n]/g, ' ').trim().substring(0, 256);
    if (cleanKey && cleanValue) result[cleanKey] = cleanValue;
  }
  return result;
};

export const uploadProfileImage = async (
  buffer: Buffer,
  userId: string,
  originalName: string,
  mimetype: string,
  metadata?: UploadMetadata
): Promise<string> => {
  try {
    const bucketName = process.env.BUCKET_NAME as string;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const fileExtension = path.extname(originalName) || '.jpg';
    const fileName = `profile-${userId}-${timestamp}${fileExtension}`;
    const destination = `profile-pictures/${fileName}`;

    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = mimetype || contentTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';

    await storage.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: destination,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000',
        Metadata: sanitizeMetadata(metadata, {
          userid: userId,
          uploadedat: timestamp,
          uploadtype: 'profile-picture',
        }),
      })
    );

    return getPublicUrl(bucketName, destination);
  } catch (err: unknown) {
    console.error('Error uploading profile image:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Error uploading profile image: ${errorMessage}`);
  }
};

const MIME_TO_EXTENSION: { [key: string]: string } = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

export const uploadBugScreenshot = async (
  buffer: Buffer,
  bugReportId: string,
  _originalName: string,
  mimetype: string,
  metadata?: UploadMetadata
): Promise<{ imageUrl: string; thumbnailUrl: string }> => {
  try {
    const bucketName = process.env.BUCKET_NAME as string;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    const safeExtension = MIME_TO_EXTENSION[mimetype] || '.png';

    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const fileName = `bug-${bugReportId}-${timestamp}-${Math.random().toString(36).substring(7)}${safeExtension}`;
    const destination = `bug-screenshots/${fileName}`;

    const contentType = mimetype || 'image/png';

    await storage.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: destination,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000',
        Metadata: sanitizeMetadata(metadata, {
          bugreportid: bugReportId,
          uploadedat: timestamp,
          uploadtype: 'bug-screenshot',
        }),
      })
    );

    const publicUrl = getPublicUrl(bucketName, destination);
    return {
      imageUrl: publicUrl,
      thumbnailUrl: publicUrl,
    };
  } catch (err: unknown) {
    console.error('Error uploading bug screenshot:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Error uploading bug screenshot: ${errorMessage}`);
  }
};

export const deleteProfileImage = async (imageUrl: string): Promise<void> => {
  try {
    const bucketName = process.env.BUCKET_NAME as string;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    const cdnPattern = new RegExp(`https://${bucketName}\\.${SPACES_REGION}\\.(cdn\\.)?digitaloceanspaces\\.com/(.+)`);
    const gcsPattern = new RegExp(`https://storage\\.googleapis\\.com/[^/]+/(.+)`);

    let filePath: string | undefined;
    const cdnMatch = imageUrl.match(cdnPattern);
    if (cdnMatch) {
      filePath = cdnMatch[2];
    } else {
      const gcsMatch = imageUrl.match(gcsPattern);
      if (gcsMatch) {
        filePath = gcsMatch[1];
      }
    }

    if (!filePath) {
      throw new Error('Invalid image URL format');
    }

    try {
      await storage.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: filePath })
      );
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
        return;
      }
      throw err;
    }

    await storage.send(
      new DeleteObjectCommand({ Bucket: bucketName, Key: filePath })
    );
    console.log(`Profile image deleted: ${filePath}`);
  } catch (err: unknown) {
    console.error('Error deleting profile image:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Error deleting profile image: ${errorMessage}`);
  }
};
