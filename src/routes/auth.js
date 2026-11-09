const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { signToken, authenticate } = require('../middlewares/auth');
const { HttpError, badRequest, unauthorized } = require('../utils/httpError');
const { parseText } = require('../utils/validate');
const { toUser } = require('../utils/serialize');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^01[016789]-?\d{3,4}-?\d{4}$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

const duplicateEmail = () => new HttpError(409, 'DUPLICATE_EMAIL', '이미 가입된 이메일입니다.');

// A-01 회원가입. 요청에 isAdmin이 있어도 무시한다 (Q-02).
router.post('/signup', async (req, res) => {
  const body = req.body ?? {};
  const email = parseText(body.email, '이메일').toLowerCase();
  const { password } = body;
  const name = parseText(body.name, '이름');
  const phone = parseText(body.phone, '전화번호');
  const address = parseText(body.address, '주소');

  if (!EMAIL_PATTERN.test(email)) throw badRequest('이메일 형식이 올바르지 않습니다.');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  if (!PHONE_PATTERN.test(phone)) throw badRequest('전화번호 형식이 올바르지 않습니다.');

  if (await prisma.user.findUnique({ where: { email } })) throw duplicateEmail();

  try {
    const user = await prisma.user.create({
      data: { email, password: await bcrypt.hash(password, BCRYPT_ROUNDS), name, phone, address },
    });
    res.status(201).json({ user: toUser(user) });
  } catch (err) {
    // 동시에 같은 이메일로 가입한 경우
    if (err.code === 'P2002') throw duplicateEmail();
    throw err;
  }
});

// A-02 로그인
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const invalid = () => unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  if (typeof email !== 'string' || typeof password !== 'string') throw invalid();

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.password))) throw invalid();

  res.json({ token: signToken(user), user: toUser(user) });
});

// A-03 내 정보
router.get('/me', authenticate, (req, res) => {
  res.json({ user: toUser(req.user) });
});

module.exports = router;
