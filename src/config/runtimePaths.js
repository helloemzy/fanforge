const path = require('node:path');

const isVercelRuntime = Boolean(process.env.VERCEL);
const isCloudflareRuntime =
  process.env.CLOUDFLARE_RUNTIME === '1' ||
  Boolean(process.env.CF_PAGES || process.env.WORKERS_CI);

const projectRoot = isCloudflareRuntime ? '/bundle' : process.cwd();

const defaultWritableRoot = isVercelRuntime || isCloudflareRuntime
  ? path.join('/tmp', 'fanforge')
  : projectRoot;

const writableRoot = process.env.FANFORGE_STORAGE_DIR || defaultWritableRoot;

const dataDirectory = path.join(writableRoot, 'data');
const uploadsDirectory = path.join(writableRoot, 'uploads');
const uploadsCoversDirectory = path.join(uploadsDirectory, 'covers');

const publicDirectory = path.join(projectRoot, 'public');
const viewsDirectory = path.join(projectRoot, 'views');

module.exports = {
  isVercelRuntime,
  isCloudflareRuntime,
  projectRoot,
  writableRoot,
  dataDirectory,
  uploadsDirectory,
  uploadsCoversDirectory,
  publicDirectory,
  viewsDirectory,
};
