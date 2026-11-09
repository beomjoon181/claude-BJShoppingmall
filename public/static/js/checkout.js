// S-06 구매 페이지 (회원만)
// /checkout?from=cart                    장바구니 전체
// /checkout?productId=3&quantity=2       상세 화면에서 바로 구매 (Q-09)

const list = document.getElementById('checkout-items');
const totalEl = document.getElementById('total-price');
const purchaseBtn = document.getElementById('purchase-btn');

// 구매할 제품과 수량. 여기서 수량을 바꿔도 장바구니는 바뀌지 않는다.
let items = [];

async function loadItems() {
  const params = new URLSearchParams(location.search);
  if (params.get('from') === 'cart') {
    const cart = await api('/api/cart');
    return cart.items.map(({ product, quantity }) => ({ productId: product.id, quantity }));
  }
  const productId = Number(params.get('productId'));
  const quantity = Number(params.get('quantity') ?? 1);
  if (!Number.isInteger(productId) || productId < 1) return [];
  return [{ productId, quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1 }];
}

async function renderPreview() {
  if (items.length === 0) {
    list.innerHTML = '<p class="empty">구매할 제품이 없습니다.</p>';
    totalEl.textContent = formatPrice(0);
    purchaseBtn.disabled = true;
    return;
  }
  const preview = await api('/api/checkout/preview', { method: 'POST', json: { items } });
  list.innerHTML = preview.items.map((line) => lineItemHtml(line, line.product.id)).join('');
  totalEl.textContent = formatPrice(preview.totalPrice);
  purchaseBtn.disabled = false;
}

(async () => {
  if (!(await initPage('member'))) return;

  list.addEventListener('change', async (event) => {
    const input = event.target.closest('.quantity-input');
    if (!input) return;
    const quantity = Number(input.value);
    if (!Number.isInteger(quantity) || quantity < 1) {
      alert('수량은 1 이상이어야 합니다.');
    } else {
      const item = items.find((entry) => entry.productId === Number(input.dataset.key));
      if (item) item.quantity = quantity;
    }
    try {
      await renderPreview();
    } catch (err) {
      handleError(err);
    }
  });

  // 구매 완료 처리는 이번 범위에서 만들지 않는다 (Q-08).
  purchaseBtn.addEventListener('click', () => {
    alert('구매 기능은 준비 중입니다.');
  });

  setLoading(list);
  try {
    items = await loadItems();
    await renderPreview();
  } catch (err) {
    list.innerHTML = '<p class="empty">구매 정보를 불러오지 못했습니다.</p>';
    handleError(err);
  }
})();
