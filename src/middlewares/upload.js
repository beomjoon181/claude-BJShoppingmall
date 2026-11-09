const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { badRequest } = require('../utils/httpError');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const PRODUCT_DIR = path.join(UPLOAD_ROOT, 'products');
const PRODUCT_URL_PREFIX = '/uploads/products/';

const MAX_PRODUCT_IMAGES = 10;
const MAX_DESCRIPTION_IMAGES = 30;
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

fs.mkdirSync(PRODUCT_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: PRODUCT_DIR,
    filename: (req, file, cb) => {
      cb(null, crypto.randomUUID() + ALLOWED_TYPES[file.mimetype]);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      cb(badRequest('jpg, png, webp, gif 이미지만 올릴 수 있습니다.'));
      return;
    }
    cb(null, true);
  },
});

const toUrl = (file) => PRODUCT_URL_PREFIX + file.filename;

// req.files({ 필드명: [파일] })에서 파일 목록을 꺼낸다.
const getFiles = (req, field) => req.files?.[field] ?? [];
const getAllFiles = (req) => Object.values(req.files ?? {}).flat();

async function removeFiles(urls) {
  await Promise.all(
    urls
      .filter((url) => url.startsWith(PRODUCT_URL_PREFIX))
      .map((url) => fs.promises.rm(path.join(PRODUCT_DIR, path.basename(url)), { force: true })),
  );
}

module.exports = {
  UPLOAD_ROOT,
  MAX_PRODUCT_IMAGES,
  MAX_DESCRIPTION_IMAGES,
  upload,
  toUrl,
  getFiles,
  getAllFiles,
  removeFiles,
};
