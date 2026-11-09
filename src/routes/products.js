const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middlewares/auth');
const {
  MAX_PRODUCT_IMAGES,
  MAX_DESCRIPTION_IMAGES,
  upload,
  toUrl,
  getFiles,
  removeFiles,
} = require('../middlewares/upload');
const { badRequest, notFound } = require('../utils/httpError');
const { parseInteger, parseBoolean, parseText, parseIdParam } = require('../utils/validate');
const { summaryInclude, detailInclude, toProductSummary, toProductDetail } = require('../utils/serialize');

const router = express.Router();

const createUpload = upload.fields([
  { name: 'images', maxCount: MAX_PRODUCT_IMAGES },
  { name: 'descriptionImages', maxCount: MAX_DESCRIPTION_IMAGES },
]);
const updateUpload = upload.fields([
  { name: 'newImages', maxCount: MAX_PRODUCT_IMAGES },
  { name: 'newDescriptionImages', maxCount: MAX_DESCRIPTION_IMAGES },
]);

// 제품명, 가격, 할인 필드. discountRate를 보내지 않으면 undefined라 수정 시 기존 값을 유지한다 (Q-11).
function parseProductFields(body, savedDiscountRate = null) {
  const isDiscount = parseBoolean(body.isDiscount, '할인여부');
  const rateGiven = body.discountRate !== undefined && body.discountRate !== '';
  if (isDiscount && !rateGiven && savedDiscountRate == null) throw badRequest('할인율을 입력해 주세요.');

  return {
    name: parseText(body.name, '제품명'),
    price: parseInteger(body.price, '가격'),
    isDiscount,
    discountRate: rateGiven ? parseInteger(body.discountRate, '할인율', { min: 1, max: 100 }) : undefined,
  };
}

function checkProductImageCount(count) {
  if (count < 1 || count > MAX_PRODUCT_IMAGES) {
    throw badRequest(`제품 사진은 1~${MAX_PRODUCT_IMAGES}장이어야 합니다.`);
  }
}

async function findProductDetail(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: detailInclude });
  if (!product) throw notFound('제품을 찾을 수 없습니다.');
  return product;
}

// 수정 화면의 배치표: [{ "id": 기존 사진 id } | { "new": 새 파일 순번 }]를 화면 순서대로 적는다.
// 배치표에 없는 기존 사진은 삭제 대상이 된다.
function parseLayout(raw, label, newFiles, existingImages) {
  let layout;
  try {
    layout = JSON.parse(raw);
  } catch {
    throw badRequest(`${label} 배치표가 올바른 JSON이 아닙니다.`);
  }
  if (!Array.isArray(layout)) throw badRequest(`${label} 배치표는 배열이어야 합니다.`);

  const existingIds = new Set(existingImages.map((image) => image.id));
  const usedIds = new Set();
  const usedNew = new Set();

  const entries = layout.map((entry) => {
    const keys = entry && typeof entry === 'object' ? Object.keys(entry) : [];
    if (keys.length === 1 && keys[0] === 'id' && existingIds.has(entry.id) && !usedIds.has(entry.id)) {
      usedIds.add(entry.id);
      return { id: entry.id };
    }
    if (keys.length === 1 && keys[0] === 'new' && Number.isInteger(entry.new)) {
      const file = newFiles[entry.new];
      if (file && !usedNew.has(entry.new)) {
        usedNew.add(entry.new);
        return { url: toUrl(file) };
      }
    }
    throw badRequest(`${label} 배치표에 잘못된 항목이 있습니다.`);
  });

  if (usedNew.size !== newFiles.length) throw badRequest(`${label} 배치표에 없는 새 사진이 있습니다.`);
  return entries;
}

// P-01 제품 목록
router.get('/', async (req, res) => {
  const products = await prisma.product.findMany({
    include: summaryInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ products: products.map(toProductSummary) });
});

// P-02 제품 상세
router.get('/:id', async (req, res) => {
  const product = await findProductDetail(parseIdParam(req.params.id));
  res.json({ product: toProductDetail(product) });
});

// P-03 제품 등록
router.post('/', requireAdmin, createUpload, async (req, res) => {
  const fields = parseProductFields(req.body ?? {});
  const images = getFiles(req, 'images');
  const descriptionImages = getFiles(req, 'descriptionImages');
  checkProductImageCount(images.length);

  const toImageRows = (files, kind) => files.map((file, index) => ({ kind, url: toUrl(file), sortOrder: index }));

  const product = await prisma.product.create({
    data: {
      ...fields,
      discountRate: fields.discountRate ?? null,
      images: {
        create: [...toImageRows(images, 'PRODUCT'), ...toImageRows(descriptionImages, 'DESCRIPTION')],
      },
    },
    include: detailInclude,
  });
  res.status(201).json({ product: toProductDetail(product) });
});

// P-04 제품 수정: 저장 버튼으로 한꺼번에 반영한다 (Q-10).
router.put('/:id', requireAdmin, updateUpload, async (req, res) => {
  const id = parseIdParam(req.params.id);
  const existing = await findProductDetail(id);
  const body = req.body ?? {};
  const fields = parseProductFields(body, existing.discountRate);

  const layouts = {
    PRODUCT: parseLayout(
      body.imageLayout,
      '제품 사진',
      getFiles(req, 'newImages'),
      existing.images.filter((image) => image.kind === 'PRODUCT'),
    ),
    DESCRIPTION: parseLayout(
      body.descriptionImageLayout,
      '설명 사진',
      getFiles(req, 'newDescriptionImages'),
      existing.images.filter((image) => image.kind === 'DESCRIPTION'),
    ),
  };
  checkProductImageCount(layouts.PRODUCT.length);

  const keptIds = new Set(Object.values(layouts).flat().map((entry) => entry.id).filter(Boolean));
  const removedImages = existing.images.filter((image) => !keptIds.has(image.id));

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: fields });
    await tx.productImage.deleteMany({ where: { id: { in: removedImages.map((image) => image.id) } } });

    for (const [kind, entries] of Object.entries(layouts)) {
      for (const [sortOrder, entry] of entries.entries()) {
        if (entry.id) {
          await tx.productImage.update({ where: { id: entry.id }, data: { sortOrder } });
        } else {
          await tx.productImage.create({ data: { productId: id, kind, url: entry.url, sortOrder } });
        }
      }
    }
    return tx.product.findUnique({ where: { id }, include: detailInclude });
  });

  // 트랜잭션이 성공한 뒤에만 뺀 사진의 파일을 지운다.
  await removeFiles(removedImages.map((image) => image.url));
  res.json({ product: toProductDetail(product) });
});

// P-05 제품 삭제. 사진과 장바구니 항목은 DB에서 CASCADE로 지워진다.
router.delete('/:id', requireAdmin, async (req, res) => {
  const product = await findProductDetail(parseIdParam(req.params.id));
  await prisma.product.delete({ where: { id: product.id } });
  await removeFiles(product.images.map((image) => image.url));
  res.status(204).end();
});

module.exports = router;
