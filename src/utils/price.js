// 할인 가격: 소수점 반올림 (요구사항 Q-12). 할인 체크가 꺼져 있으면 null (Q-11).
function getDiscountPrice(product) {
  if (!product.isDiscount || product.discountRate == null) return null;
  return Math.round(product.price * (1 - product.discountRate / 100));
}

// 장바구니/구매 금액에 쓰는 판매가
function getUnitPrice(product) {
  return getDiscountPrice(product) ?? product.price;
}

module.exports = { getDiscountPrice, getUnitPrice };
