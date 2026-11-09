// S-01 메인 화면

const grid = document.getElementById('product-grid');

function productCardHtml(product, isAdmin) {
  const image = product.thumbnailUrl
    ? `<img class="product-card-image" src="${escapeHtml(product.thumbnailUrl)}" alt="${escapeHtml(product.name)}" />`
    : '<div class="product-card-image"></div>';
  // 관리자: 오른쪽 구석에 수정/삭제 버튼 (FR-M-04)
  const actions = isAdmin
    ? `<div class="card-actions">
        <a class="btn btn-small" href="/admin/products/${product.id}/edit" data-action="edit">수정</a>
        <button class="btn btn-small btn-danger" data-action="delete" data-id="${product.id}">삭제</button>
      </div>`
    : '';
  return `
    <article class="product-card" data-id="${product.id}">
      ${image}
      ${actions}
      <div class="product-card-body">
        <h2 class="product-card-name">${escapeHtml(product.name)}</h2>
        ${priceHtml(product)}
      </div>
    </article>`;
}

// 관리자: 맨 첫 칸에 '+' 추가하기 카드 (FR-M-03)
const ADD_CARD_HTML = `
  <a class="product-card add-card" href="/admin/products/new" aria-label="제품 추가하기">
    <span class="plus-icon">+</span>
    <span>제품 추가하기</span>
  </a>`;

async function renderProducts(isAdmin) {
  setLoading(grid);
  const { products } = await api('/api/products');

  const cards = products.map((product) => productCardHtml(product, isAdmin));
  if (isAdmin) cards.unshift(ADD_CARD_HTML);
  grid.innerHTML = cards.length ? cards.join('') : '<p class="empty">등록된 제품이 없습니다.</p>';
}

(async () => {
  const user = await initPage('any');
  const isAdmin = Boolean(user?.isAdmin);

  grid.addEventListener('click', async (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl?.dataset.action === 'edit') return; // 링크로 이동

    if (actionEl?.dataset.action === 'delete') {
      event.stopPropagation();
      if (!confirm('삭제하시겠습니까?')) return;
      try {
        await api(`/api/products/${actionEl.dataset.id}`, { method: 'DELETE' });
        await renderProducts(isAdmin);
      } catch (err) {
        handleError(err);
      }
      return;
    }

    const card = event.target.closest('.product-card[data-id]');
    if (card) location.href = `/products/${card.dataset.id}`;
  });

  try {
    await renderProducts(isAdmin);
  } catch (err) {
    grid.innerHTML = '<p class="empty">제품을 불러오지 못했습니다.</p>';
    handleError(err);
  }
})();
