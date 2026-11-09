const express = require('express');
const prisma = require('../lib/prisma');
const { requireMember } = require('../middlewares/auth');
const { badRequest, notFound } = require('../utils/httpError');
const { parseInteger } = require('../utils/validate');
const { getUnitPrice } = require('../utils/price');
const { summaryInclude, toProductSummary } = require('../utils/serialize');

const router = express.Router();

router.use(requireMember);

// O-01 구매 페이지 금액 계산. 장바구니 구매와 바로 구매(Q-09) 모두 쓴다. DB에는 저장하지 않는다.
router.post('/preview', async (req, res) => {
  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) throw badRequest('구매할 제품이 없습니다.');

  const requested = items.map((item) => ({
    productId: parseInteger(item?.productId, '제품', { min: 1 }),
    quantity: parseInteger(item?.quantity, '수량', { min: 1 }),
  }));
  const productIds = requested.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) throw badRequest('같은 제품이 중복되어 있습니다.');

  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: summaryInclude });
  const productById = new Map(products.map((product) => [product.id, product]));

  const lines = requested.map(({ productId, quantity }) => {
    const product = productById.get(productId);
    if (!product) throw notFound('제품을 찾을 수 없습니다.');
    const unitPrice = getUnitPrice(product);
    return { product: toProductSummary(product), quantity, unitPrice, amount: unitPrice * quantity };
  });
  const totalPrice = lines.reduce((sum, line) => sum + line.amount, 0);

  res.json({ items: lines, totalPrice });
});

module.exports = router;
