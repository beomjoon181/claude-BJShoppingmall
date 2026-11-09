// 모든 화면이 함께 쓰는 코드: API 호출, 로그인 상태, 헤더, 가격 표시

const TOKEN_KEY = 'bj_token';

const Auth = {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // 저장소를 쓸 수 없는 브라우저에서는 이번 화면에서만 로그인 상태가 유지된다.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // 무시
    }
  },
};

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// json: JSON 본문, form: FormData 본문
async function api(path, { method = 'GET', json, form } = {}) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : form,
  });
  if (res.status === 204) return null;

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.message ?? '요청을 처리하지 못했습니다.');
  return body;
}

// API 에러를 알림창으로 보여준다. 로그인이 풀렸으면 로그인 화면으로 보낸다.
function handleError(err) {
  if (err instanceof ApiError && err.status === 401 && Auth.getToken()) {
    Auth.clear();
    alert('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    goToLogin();
    return;
  }
  alert(err instanceof ApiError ? err.message : '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  if (!(err instanceof ApiError)) console.error(err);
}

function goToLogin() {
  location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
}

// 토큰으로 현재 사용자를 확인한다. 비회원이면 null.
async function loadUser() {
  if (!Auth.getToken()) return null;
  try {
    return (await api('/api/auth/me')).user;
  } catch {
    Auth.clear();
    return null;
  }
}

function renderHeader(user) {
  const header = document.getElementById('site-header');
  let actions;
  if (!user) {
    actions = '<a class="btn" href="/login">로그인</a>';
  } else if (user.isAdmin) {
    actions = '<span class="header-user">관리자</span><button class="btn" id="logout-btn">로그아웃</button>';
  } else {
    actions = `<span class="header-user">${escapeHtml(user.name)}님</span>
      <a class="btn" href="/cart">장바구니</a>
      <button class="btn" id="logout-btn">로그아웃</button>`;
  }
  header.innerHTML = `
    <div class="header-inner">
      <a class="logo" href="/">BJShoppingmall</a>
      <nav class="header-actions">${actions}</nav>
    </div>`;

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    Auth.clear();
    location.href = '/';
  });
}

// 화면 시작: 헤더를 그리고 접근 권한을 확인한다.
// access: 'any'(누구나), 'guest'(비회원만), 'member'(회원만), 'admin'(관리자만)
async function initPage(access = 'any') {
  const user = await loadUser();
  renderHeader(user);

  if (access === 'guest' && user) {
    location.replace('/');
    return null;
  }
  if ((access === 'member' || access === 'admin') && !user) {
    alert('로그인 하세요');
    goToLogin();
    return null;
  }
  if ((access === 'member' && user.isAdmin) || (access === 'admin' && !user.isAdmin)) {
    alert('접근할 수 없는 화면입니다.');
    location.replace('/');
    return null;
  }
  return user;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(won) {
  return `${Number(won).toLocaleString('ko-KR')}원`;
}

// 할인 가격: 소수점 반올림. 서버(src/utils/price.js)와 같은 계산 — 수정 화면 미리보기용.
function calcDiscountPrice(price, isDiscount, discountRate) {
  if (!isDiscount || discountRate == null) return null;
  return Math.round(price * (1 - discountRate / 100));
}

// 가격 표시. 할인 중이면 원래 가격에 줄을 긋고 할인율과 할인 가격을 함께 보여준다.
function priceHtml(product) {
  if (product.discountPrice == null) {
    return `<div class="price"><span class="price-final">${formatPrice(product.price)}</span></div>`;
  }
  return `<div class="price">
      <span class="price-original">${formatPrice(product.price)}</span>
      <span class="price-rate">${product.discountRate}%</span>
      <span class="price-final">${formatPrice(product.discountPrice)}</span>
    </div>`;
}

// 장바구니/구매 화면의 제품 한 줄. key는 수량 입력칸을 구분하는 값.
function lineItemHtml({ product, quantity, unitPrice, amount }, key) {
  const image = product.thumbnailUrl
    ? `<img src="${escapeHtml(product.thumbnailUrl)}" alt="" />`
    : '<div class="line-item-image"></div>';
  return `
    <div class="line-item">
      <a href="/products/${product.id}">${image}</a>
      <div>
        <a class="line-item-name" href="/products/${product.id}">${escapeHtml(product.name)}</a>
        <div class="hint">${formatPrice(unitPrice)}</div>
      </div>
      <div class="line-item-qty">
        <input class="quantity-input" type="number" min="1" value="${quantity}" data-key="${escapeHtml(key)}" aria-label="수량" />
      </div>
      <div class="line-item-amount">${formatPrice(amount)}</div>
    </div>`;
}

function setLoading(container, text = '불러오는 중...') {
  container.innerHTML = `<p class="empty">${escapeHtml(text)}</p>`;
}
