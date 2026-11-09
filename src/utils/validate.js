const { badRequest, notFound } = require('./httpError');

const INT_MAX = 2147483647;

// JSON 숫자와 multipart 문자열을 모두 받아 정수로 바꾼다.
function parseInteger(value, label, { min = 0, max = INT_MAX } = {}) {
  const text = typeof value === 'string' ? value.trim() : value;
  if (text === undefined || text === null || text === '') {
    throw badRequest(`${label}을(를) 입력해 주세요.`);
  }
  const number = Number(text);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw badRequest(`${label}은(는) ${min}~${max} 사이의 정수여야 합니다.`);
  }
  return number;
}

function parseBoolean(value, label) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw badRequest(`${label}은(는) true 또는 false여야 합니다.`);
}

function parseText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${label}을(를) 입력해 주세요.`);
  }
  return value.trim();
}

// URL 파라미터의 id. 잘못된 값은 없는 리소스로 본다.
function parseIdParam(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > INT_MAX) throw notFound();
  return id;
}

module.exports = { parseInteger, parseBoolean, parseText, parseIdParam };
