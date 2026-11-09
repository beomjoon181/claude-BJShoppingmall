class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message) => new HttpError(400, 'VALIDATION_ERROR', message);
const unauthorized = (message = '로그인이 필요합니다.') => new HttpError(401, 'UNAUTHORIZED', message);
const forbidden = (message = '권한이 없습니다.') => new HttpError(403, 'FORBIDDEN', message);
const notFound = (message = '찾을 수 없습니다.') => new HttpError(404, 'NOT_FOUND', message);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound };
