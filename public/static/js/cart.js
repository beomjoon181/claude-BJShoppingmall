// S-05 장바구니 페이지 (회원만)

const list = document.getElementById('cart-items');
const totalEl = document.getElementById('total-price');
const buyBtn = document.getElementById('buy-btn');
const cancelBtn = document.getElementById('cancel-btn');

async function renderCart() {
  const { items, totalPrice } = await api('/api/cart');
  list.innerHTML = items.length
    ? items.map((item) => lineItemHtml(item, item.id)).join('')
    : '<p class="empty">장바구니가 비어 있습니다.</p>';
  totalEl.textContent = formatPrice(totalPrice);
  buyBtn.disabled = items.length === 0;
  cancelBtn.disabled = items.length === 0;
}

(async () => {
  if (!(await initPage('member'))) return;

  // 수량 변경 (Q-06)
  list.addEventListener('change', async (event) => {
    const input = event.target.closest('.quantity-input');
    if (!input) return;
    const quantity = Number(input.value);
    try {
      if (!Number.isInteger(quantity) || quantity < 1) {
        alert('수량은 1 이상이어야 합니다.');
      } else {
        await api(`/api/cart/items/${input.dataset.key}`, { method: 'PATCH', json: { quantity } });
      }
      await renderCart();
    } catch (err) {
      handleError(err);
    }
  });

  buyBtn.addEventListener('click', () => {
    location.href = '/checkout?from=cart';
  });

  // 취소하기: 장바구니 전체 삭제 후 메인으로 (FR-U-11)
  cancelBtn.addEventListener('click', async () => {
    try {
      await api('/api/cart', { method: 'DELETE' });
      location.href = '/';
    } catch (err) {
      handleError(err);
    }
  });

  setLoading(list);
  try {
    await renderCart();
  } catch (err) {
    list.innerHTML = '<p class="empty">장바구니를 불러오지 못했습니다.</p>';
    handleError(err);
  }
})();
