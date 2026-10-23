const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 2 * 1024 * 1024); // 2 MB

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only JPEG, PNG, WEBP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

module.exports = upload;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
module.exports.ALLOWED_TYPES = ALLOWED_TYPES;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
