// S-02 상세 화면

const content = document.getElementById('content');
const productId = location.pathname.split('/')[2];

function galleryHtml(images, name) {
  if (images.length === 0) return '<div class="gallery-main"></div>';
  const thumbs = images
    .map(
      (image, index) => `
      <button class="gallery-thumb${index === 0 ? ' active' : ''}" data-url="${escapeHtml(image.url)}" aria-label="사진 ${index + 1}">
        <img src="${escapeHtml(image.url)}" alt="" />
      </button>`,
    )
    .join('');
  return `
    <img class="gallery-main" id="gallery-main" src="${escapeHtml(images[0].url)}" alt="${escapeHtml(name)}" />
    ${images.length > 1 ? `<div class="gallery-thumbs">${thumbs}</div>` : ''}`;
}

// 관리자는 구매/장바구니 버튼이 없다 (FR-M-07)
function buyAreaHtml(user) {
  if (user?.isAdmin) return '';
  return `
    <div class="quantity-row">
      <label for="quantity">수량</label>
      <input class="quantity-input" id="quantity" type="number" min="1" value="1" />
    </div>
    <div class="button-row">
      <button class="btn btn-primary btn-large" id="buy-btn">구매</button>
      <button class="btn btn-large" id="cart-btn">장바구니</button>
    </div>`;
}

function render(product, user) {
  document.title = `${product.name} - BJShoppingmall`;
  const descriptions = product.descriptionImages
    .map((image) => `<img src="${escapeHtml(image.url)}" alt="" />`)
    .join('');

  content.innerHTML = `
    <section class="detail">
      <div>${galleryHtml(product.images, product.name)}</div>
      <div class="detail-info">
        <h1 class="detail-name">${escapeHtml(product.name)}</h1>
        ${priceHtml(product)}
        ${buyAreaHtml(user)}
      </div>
    </section>
    ${descriptions ? `<h2 class="section-title">제품 설명</h2><div class="description-images">${descriptions}</div>` : ''}`;
}

function readQuantity() {
  const quantity = Number(document.getElementById('quantity').value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    alert('수량은 1 이상이어야 합니다.');
    return null;
  }
  return quantity;
}

function bindEvents(user) {
  content.querySelector('.gallery-thumbs')?.addEventListener('click', (event) => {
    const thumb = event.target.closest('.gallery-thumb');
    if (!thumb) return;
    document.getElementById('gallery-main').src = thumb.dataset.url;
    content.querySelectorAll('.gallery-thumb').forEach((el) => el.classList.toggle('active', el === thumb));
  });

  // 비회원: '로그인 하세요' 알림 후 로그인 화면으로 (FR-G-08)
  const requireLogin = () => {
    if (user) return true;
    alert('로그인 하세요');
    goToLogin();
    return false;
  };

  // 바로 구매: 장바구니와 상관없이 이 제품만 (Q-09)
  document.getElementById('buy-btn')?.addEventListener('click', () => {
    if (!requireLogin()) return;
    const quantity = readQuantity();
    if (quantity) location.href = `/checkout?productId=${productId}&quantity=${quantity}`;
  });

  document.getElementById('cart-btn')?.addEventListener('click', async () => {
    if (!requireLogin()) return;
    const quantity = readQuantity();
    if (!quantity) return;
    try {
      await api('/api/cart/items', { method: 'POST', json: { productId: Number(productId), quantity } });
      location.href = '/cart';
    } catch (err) {
      handleError(err);
    }
  });
}

(async () => {
  const user = await initPage('any');
  setLoading(content);
  try {
    const { product } = await api(`/api/products/${productId}`);
    render(product, user);
    bindEvents(user);
  } catch (err) {
    content.innerHTML = `<p class="empty">${err.status === 404 ? '제품을 찾을 수 없습니다.' : '제품을 불러오지 못했습니다.'}</p>`;
    if (err.status !== 404) handleError(err);
  }
})();
