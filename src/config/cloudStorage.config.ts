import { Storage } from '@google-cloud/storage';
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';

const pathToJSONKey = path.join(__dirname, 'test-cs.json');

export const storage = new Storage({
  keyFilename: pathToJSONKey,
});

export const uploadProfileImage = async (tempFilePath: string, userId: string): Promise<string> => {
  try {
    const bucketName = process.env.BUCKET_NAME as string;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }

    // Generate unique filename with timestamp
    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const fileExtension = path.extname(tempFilePath);
    const fileName = `profile-${userId}-${timestamp}${fileExtension}`;
    const destination = `profile-pictures/${fileName}`;

    // Determine content type based on file extension
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = contentTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';

    const bucket = storage.bucket(bucketName);

    // Upload the file with correct content type
    await bucket.upload(tempFilePath, {
      destination: destination,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        contentType: contentType,
      },
    });

    // Make the file public
    const file = bucket.file(destination);
    await file.makePublic();

    // Return the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
    return publicUrl;
  } catch (err: any) {
    console.error('Error uploading profile image:', err);
    throw new Error(`Error uploading profile image: ${err.message}`);
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
    
    if (!match) {
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
  } catch (err: any) {
    console.error('Error deleting profile image:', err);
    throw new Error(`Error deleting profile image: ${err.message}`);
  }
};
