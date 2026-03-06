const crypto = require('node:crypto');
const multer = require('multer');
const { uploadObject, removeObjectIfPresent } = require('./objectStorageService');

const mimeToExtension = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!mimeToExtension[file.mimetype]) {
      callback(new Error('Only JPG, PNG, WEBP, and GIF images are allowed.'));
      return;
    }

    callback(null, true);
  },
});

const validateImageSignature = (fileBuffer, mimeType) => {
  if (!Buffer.isBuffer(fileBuffer)) {
    return false;
  }

  const header = fileBuffer.subarray(0, 16);

  if (mimeType === 'image/jpeg') {
    return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    );
  }

  if (mimeType === 'image/gif') {
    if (header.length < 6) {
      return false;
    }

    const signature = header.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }

  if (mimeType === 'image/webp') {
    if (header.length < 12) {
      return false;
    }

    const riff = header.subarray(0, 4).toString('ascii');
    const webp = header.subarray(8, 12).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP';
  }

  return false;
};

const buildCoverObjectKey = ({ userId, mimeType }) => {
  const extension = mimeToExtension[mimeType] || '.bin';
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const randomSegment = crypto.randomBytes(16).toString('hex');
  return `covers/${datePrefix}/${userId}-${randomSegment}${extension}`;
};

const uploadCoverImage = async ({ file, userId }) => {
  if (!file) {
    return null;
  }

  if (!validateImageSignature(file.buffer, file.mimetype)) {
    throw new Error('Uploaded file content does not match a valid image format.');
  }

  const key = buildCoverObjectKey({ userId, mimeType: file.mimetype });
  const uploaded = await uploadObject({
    key,
    body: file.buffer,
    contentType: file.mimetype,
  });

  return {
    coverPath: uploaded.publicPath,
    coverStorageKey: uploaded.storageKey,
    storageProvider: uploaded.provider,
  };
};

const removeCoverIfPresent = async (storageKey) => {
  await removeObjectIfPresent(storageKey);
};

module.exports = {
  coverUpload,
  validateImageSignature,
  uploadCoverImage,
  removeCoverIfPresent,
};
