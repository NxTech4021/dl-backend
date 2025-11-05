import { Storage } from '@google-cloud/storage';
import dayjs from 'dayjs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathToJSONKey = path.join(__dirname, 'test-cs.json');

export const storage = new Storage({
  keyFilename: pathToJSONKey,
});

export const uploadProfileImage = async (
  buffer: Buffer,
  userId: string,
  originalName: string,
  mimetype: string
): Promise<string> => {
  try {
    const bucketName = process.env.BUCKET_NAME as string;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    // Generate unique filename with timestamp
    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const fileExtension = path.extname(originalName) || '.jpg';
    const fileName = `profile-${userId}-${timestamp}${fileExtension}`;
    const destination = `profile-pictures/${fileName}`;

    // Determine content type from mimetype or file extension
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = mimetype || contentTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destination);

    // Upload the buffer directly to Google Cloud Storage
    await file.save(buffer, {
      metadata: {
        cacheControl: 'public, max-age=31536000',
        contentType: contentType,
      },
    });

    // Make the file public
    await file.makePublic();

    // Return the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
    return publicUrl;
  } catch (err: unknown) {
    console.error('Error uploading profile image:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Error uploading profile image: ${errorMessage}`);
  }
};

export const deleteProfileImage = async (imageUrl: string): Promise<void> => {
  try {
    const bucketName = process.env.BUCKET_NAME as string;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    // Extract the file path from the URL
    const urlPattern = new RegExp(`https://storage\\.googleapis\\.com/${bucketName}/(.+)`);
    const match = imageUrl.match(urlPattern);
    
    if (!match || !match[1]) {
      throw new Error('Invalid image URL format');
    }

    const filePath = match[1];
    const file = storage.bucket(bucketName).file(filePath);
    
    // Check if file exists before deleting
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`Profile image deleted: ${filePath}`);
    }
  } catch (err: unknown) {
    console.error('Error deleting profile image:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Error deleting profile image: ${errorMessage}`);
  }
};
