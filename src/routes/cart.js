const express = require('express');
const prisma = require('../lib/prisma');
const { requireMember } = require('../middlewares/auth');
const { notFound } = require('../utils/httpError');
const { parseInteger, parseIdParam } = require('../utils/validate');
const { getUnitPrice } = require('../utils/price');
const { summaryInclude, toProductSummary } = require('../utils/serialize');

const router = express.Router();

// 장바구니는 회원만 쓴다. 관리자는 403 (Q-15).
router.use(requireMember);

const toItem = ({ id, productId, quantity }) => ({ id, productId, quantity });

// C-01 장바구니 조회
router.get('/', async (req, res) => {
  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: { include: summaryInclude } },
    orderBy: { createdAt: 'asc' },
  });

  const items = cartItems.map(({ id, quantity, product }) => {
    const unitPrice = getUnitPrice(product);
    return { id, quantity, product: toProductSummary(product), unitPrice, amount: unitPrice * quantity };
  });
  const totalPrice = items.reduce((sum, item) => sum + item.amount, 0);

  res.json({ items, totalPrice });
});

// C-02 장바구니 담기. 이미 담긴 제품이면 수량을 더한다 (Q-19).
router.post('/items', async (req, res) => {
  const body = req.body ?? {};
  const productId = parseInteger(body.productId, '제품', { min: 1 });
  const quantity = parseInteger(body.quantity, '수량', { min: 1 });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound('제품을 찾을 수 없습니다.');

  const item = await prisma.cartItem.upsert({
    where: { userId_productId: { userId: req.user.id, productId } },
    create: { userId: req.user.id, productId, quantity },
    update: { quantity: { increment: quantity } },
  });
  res.status(201).json({ item: toItem(item) });
});

// C-03 장바구니 수량 변경
router.patch('/items/:id', async (req, res) => {
  const id = parseIdParam(req.params.id);
  const quantity = parseInteger((req.body ?? {}).quantity, '수량', { min: 1 });

  const { count } = await prisma.cartItem.updateMany({ where: { id, userId: req.user.id }, data: { quantity } });
  if (count === 0) throw notFound('장바구니 항목을 찾을 수 없습니다.');

  const item = await prisma.cartItem.findUnique({ where: { id } });
  res.json({ item: toItem(item) });
});

// C-04 장바구니 전체 삭제 (취소하기)
router.delete('/', async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
  res.status(204).end();
});

module.exports = router;
