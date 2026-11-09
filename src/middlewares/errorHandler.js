const fs = require('fs');
const multer = require('multer');
const { HttpError } = require('../utils/httpError');
const { getAllFiles } = require('./upload');

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: '사진은 한 장에 5MB까지 올릴 수 있습니다.',
  LIMIT_UNEXPECTED_FILE: '사진 개수가 너무 많거나 잘못된 필드입니다.',
};

function toHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err instanceof multer.MulterError) {
    return new HttpError(400, 'VALIDATION_ERROR', MULTER_MESSAGES[err.code] ?? '사진 업로드에 실패했습니다.');
  }
  if (err.type === 'entity.parse.failed') {
    return new HttpError(400, 'VALIDATION_ERROR', '요청 본문이 올바른 JSON이 아닙니다.');
  }
  return null;
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '없는 API입니다.' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 실패한 요청에서 올라온 사진은 지운다.
  for (const file of getAllFiles(req)) fs.rm(file.path, { force: true }, () => {});

  const httpError = toHttpError(err);
  if (!httpError) {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } });
    return;
  }
  res.status(httpError.status).json({ error: { code: httpError.code, message: httpError.message } });
}

module.exports = { notFoundHandler, errorHandler };
