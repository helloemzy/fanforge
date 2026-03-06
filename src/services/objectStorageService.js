const fs = require('node:fs');
const path = require('node:path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { uploadsDirectory, isVercelRuntime, isCloudflareRuntime } = require('../config/runtimePaths');

const storageConfig = {
  bucket: process.env.STORAGE_BUCKET || '',
  region: process.env.STORAGE_REGION || 'auto',
  endpoint: process.env.STORAGE_ENDPOINT || '',
  accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
  publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || '',
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === '1',
};

const hasObjectStorageConfig = () => {
  return Boolean(
    storageConfig.bucket &&
      storageConfig.accessKeyId &&
      storageConfig.secretAccessKey &&
      (storageConfig.endpoint || storageConfig.region)
  );
};

const canUseLocalFallback = () => {
  return !isVercelRuntime && !isCloudflareRuntime;
};

let s3Client;

const getS3Client = () => {
  if (!hasObjectStorageConfig()) {
    return null;
  }

  if (s3Client) {
    return s3Client;
  }

  s3Client = new S3Client({
    region: storageConfig.region,
    endpoint: storageConfig.endpoint || undefined,
    forcePathStyle: storageConfig.forcePathStyle,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
  });

  return s3Client;
};

const toUrlPath = (key) => {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
};

const buildPublicUrl = (key) => {
  const encodedKey = toUrlPath(key);

  if (storageConfig.publicBaseUrl) {
    return `${storageConfig.publicBaseUrl.replace(/\/$/, '')}/${encodedKey}`;
  }

  if (storageConfig.endpoint) {
    const normalizedEndpoint = storageConfig.endpoint.replace(/\/$/, '');

    if (storageConfig.forcePathStyle) {
      return `${normalizedEndpoint}/${storageConfig.bucket}/${encodedKey}`;
    }

    const endpointWithoutProtocol = normalizedEndpoint.replace(/^https?:\/\//, '');
    return `https://${storageConfig.bucket}.${endpointWithoutProtocol}/${encodedKey}`;
  }

  return `https://${storageConfig.bucket}.s3.${storageConfig.region}.amazonaws.com/${encodedKey}`;
};

const uploadLocalObject = async ({ key, body, contentType }) => {
  const fullPath = path.join(uploadsDirectory, key);
  const directory = path.dirname(fullPath);

  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(fullPath, body);

  return {
    storageKey: `local:${key}`,
    publicPath: `/uploads/${key}`,
    contentType,
    provider: 'local',
  };
};

const deleteLocalObject = async (storageKey) => {
  if (!storageKey.startsWith('local:')) {
    return;
  }

  const key = storageKey.slice('local:'.length);
  const fullPath = path.join(uploadsDirectory, key);

  try {
    await fs.promises.unlink(fullPath);
  } catch (_error) {
    // Ignore missing file and cleanup failures.
  }
};

const uploadObject = async ({ key, body, contentType }) => {
  const client = getS3Client();

  if (!client) {
    if (!canUseLocalFallback()) {
      throw new Error(
        'Object storage is required in this environment. Configure STORAGE_BUCKET, STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, and STORAGE_SECRET_ACCESS_KEY.'
      );
    }

    return uploadLocalObject({ key, body, contentType });
  }

  await client.send(
    new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    storageKey: key,
    publicPath: buildPublicUrl(key),
    contentType,
    provider: 'object-storage',
  };
};

const removeObjectIfPresent = async (storageKey) => {
  if (!storageKey) {
    return;
  }

  if (storageKey.startsWith('local:')) {
    await deleteLocalObject(storageKey);
    return;
  }

  const client = getS3Client();

  if (!client) {
    return;
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: storageConfig.bucket,
        Key: storageKey,
      })
    );
  } catch (_error) {
    // Ignore delete failures to avoid blocking user flows.
  }
};

module.exports = {
  hasObjectStorageConfig,
  uploadObject,
  removeObjectIfPresent,
};
