const { getDiscountPrice } = require('./price');

// 메인 카드 썸네일: 제품 사진 중 첫 장
const summaryInclude = {
  images: { where: { kind: 'PRODUCT' }, orderBy: { sortOrder: 'asc' }, take: 1 },
};

const detailInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
};

function toUser(user) {
  const { id, email, name, phone, address, isAdmin } = user;
  return { id, email, name, phone, address, isAdmin };
}

function toPriceFields(product) {
  return {
    price: product.price,
    isDiscount: product.isDiscount,
    discountRate: product.discountRate,
    discountPrice: getDiscountPrice(product),
  };
}

function toProductSummary(product) {
  return {
    id: product.id,
    name: product.name,
    ...toPriceFields(product),
    thumbnailUrl: product.images[0]?.url ?? null,
  };
}

function toImage({ id, url, sortOrder }) {
  return { id, url, sortOrder };
}

function toProductDetail(product) {
  return {
    id: product.id,
    name: product.name,
    ...toPriceFields(product),
    images: product.images.filter((image) => image.kind === 'PRODUCT').map(toImage),
    descriptionImages: product.images.filter((image) => image.kind === 'DESCRIPTION').map(toImage),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

module.exports = { summaryInclude, detailInclude, toUser, toProductSummary, toProductDetail };
