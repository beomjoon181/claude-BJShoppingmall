const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { unauthorized, forbidden } = require('../utils/httpError');

const TOKEN_EXPIRES_IN = '1d';

function signToken(user) {
  return jwt.sign({ userId: user.id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN,
  });
}

// 토큰의 isAdmin은 믿지 않고 DB에서 사용자를 다시 읽는다. DB에서 관리자를 바꾸면 바로 반영된다.
async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw unauthorized('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw unauthorized();

  req.user = user;
  next();
}

function requireRole(isAdmin) {
  return [
    authenticate,
    (req, res, next) => {
      if (req.user.isAdmin !== isAdmin) throw forbidden();
      next();
    },
  ];
}

const requireMember = requireRole(false);
const requireAdmin = requireRole(true);

module.exports = { signToken, authenticate, requireMember, requireAdmin };
