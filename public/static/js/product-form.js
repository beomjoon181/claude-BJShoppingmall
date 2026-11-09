// S-07 제품 수정 / S-08 제품 등록 (관리자만)
// 화면에서 바꾼 내용은 저장 버튼을 눌렀을 때 한꺼번에 서버로 보낸다 (Q-10).

const editMatch = location.pathname.match(/^\/admin\/products\/(\d+)\/edit$/);
const productId = editMatch ? Number(editMatch[1]) : null;
const isEdit = productId !== null;

const MAX_PRODUCT_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const INT_MAX = 2147483647;

// 사진 항목: 기존 사진 { id, url } / 새 사진 { file, url(미리보기) }
const state = {
  name: '',
  price: null,
  isDiscount: false,
  discountRate: null,
  images: [],
  descriptionImages: [],
};

const IMAGE_LISTS = {
  images: { el: document.getElementById('product-images'), max: MAX_PRODUCT_IMAGES, min: 1 },
  descriptionImages: { el: document.getElementById('description-images'), max: Infinity, min: 0 },
};

// 제품명, 가격, 할인율 줄: 값 표시 + 변경 버튼 + 아래에 나타나는 입력 폼
const FIELDS = {
  name: {
    format: (value) => value || '미입력',
    parse(raw) {
      const value = raw.trim();
      if (!value) throw new Error('제품명을 입력해 주세요.');
      return value;
    },
  },
  price: {
    format: (value) => (value == null ? '미입력' : formatPrice(value)),
    parse(raw) {
      const value = Number(raw);
      if (raw.trim() === '' || !Number.isInteger(value) || value < 0 || value > INT_MAX) {
        throw new Error('가격은 0 이상의 정수로 입력해 주세요.');
      }
      return value;
    },
  },
  discountRate: {
    format: (value) => (value == null ? '미입력' : `${value}%`),
    parse(raw) {
      const value = Number(raw);
      if (raw.trim() === '' || !Number.isInteger(value) || value < 1 || value > 100) {
        throw new Error('할인율은 1~100 사이의 정수로 입력해 주세요.');
      }
      return value;
    },
  },
};

const fieldRow = (key) => document.querySelector(`.edit-row[data-field="${key}"]`);

function renderField(key) {
  fieldRow(key).querySelector('[data-display]').textContent = FIELDS[key].format(state[key]);
}

// 할인 체크를 꺼도 할인율 값은 지우지 않고, 할인 가격만 보여주지 않는다 (Q-11).
function renderPricePreview() {
  const el = document.getElementById('price-preview');
  if (state.price == null) {
    el.textContent = '가격을 입력해 주세요';
    return;
  }
  const discountPrice = calcDiscountPrice(state.price, state.isDiscount, state.discountRate);
  el.innerHTML = priceHtml({ price: state.price, discountRate: state.discountRate, discountPrice });
}

function renderFields() {
  Object.keys(FIELDS).forEach(renderField);
  document.getElementById('is-discount').checked = state.isDiscount;
  renderPricePreview();
}

function setFormOpen(key, open) {
  const row = fieldRow(key);
  const form = row.querySelector('[data-form]');
  form.hidden = !open;
  if (open) {
    const input = form.querySelector('input');
    input.value = state[key] ?? '';
    input.focus();
  }
}

// 열려 있는 입력 폼의 값을 state에 반영한다. 잘못된 값이면 알림 후 false.
function applyField(key) {
  const input = fieldRow(key).querySelector('[data-form] input');
  try {
    state[key] = FIELDS[key].parse(input.value);
  } catch (err) {
    alert(err.message);
    input.focus();
    return false;
  }
  setFormOpen(key, false);
  renderField(key);
  renderPricePreview();
  return true;
}

function bindFields() {
  for (const key of Object.keys(FIELDS)) {
    const row = fieldRow(key);
    const form = row.querySelector('[data-form]');
    row.querySelector('[data-toggle]').addEventListener('click', () => setFormOpen(key, form.hidden));
    row.querySelector('[data-apply]').addEventListener('click', () => applyField(key));
    // 올바른 값이면 입력하는 동안 바로 반영해 판매 가격 미리보기가 따라온다.
    form.querySelector('input').addEventListener('input', (event) => {
      try {
        state[key] = FIELDS[key].parse(event.target.value);
      } catch {
        return;
      }
      renderField(key);
      renderPricePreview();
    });
    form.querySelector('input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyField(key);
      }
    });
  }

  document.getElementById('is-discount').addEventListener('change', (event) => {
    state.isDiscount = event.target.checked;
    if (state.isDiscount && state.discountRate == null) setFormOpen('discountRate', true);
    renderPricePreview();
  });
}

// 사진 칸: 맨 첫 칸은 '+' 추가하기, 그 뒤 사진마다 오른쪽 위 '-' 삭제 버튼
function renderImages(listKey) {
  const { el, max } = IMAGE_LISTS[listKey];
  const list = state[listKey];
  const full = list.length >= max;

  const addTile = `
    <label class="image-tile add-tile${full ? ' disabled' : ''}" title="${full ? `최대 ${max}장까지 올릴 수 있습니다` : '사진 추가하기'}">
      <span class="plus-icon">+</span>
      <input type="file" accept="${ALLOWED_TYPES.join(',')}" multiple ${full ? 'disabled' : ''} />
    </label>`;
  const tiles = list
    .map(
      (image, index) => `
      <div class="image-tile">
        <img src="${escapeHtml(image.url)}" alt="" />
        <span class="image-tile-order">${listKey === 'images' && index === 0 ? '대표' : index + 1}</span>
        <button class="remove-btn" type="button" data-index="${index}" aria-label="사진 삭제">−</button>
      </div>`,
    )
    .join('');
  el.innerHTML = addTile + tiles;
}

function addFiles(listKey, files) {
  const { max } = IMAGE_LISTS[listKey];
  const list = state[listKey];

  const invalid = files.find((file) => !ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE);
  if (invalid) {
    alert('jpg, png, webp, gif 이미지만, 한 장에 5MB까지 올릴 수 있습니다.');
    return;
  }
  if (list.length + files.length > max) {
    alert(`제품 사진은 최대 ${max}장까지 올릴 수 있습니다.`);
    return;
  }
  list.push(...files.map((file) => ({ file, url: URL.createObjectURL(file) })));
  renderImages(listKey);
}

function removeImage(listKey, index) {
  const { min } = IMAGE_LISTS[listKey];
  const list = state[listKey];
  if (list.length <= min) {
    alert(`제품 사진은 최소 ${min}장이 필요합니다.`);
    return;
  }
  if (!confirm('삭제하시겠습니까?')) return;
  const [removed] = list.splice(index, 1);
  if (removed.file) URL.revokeObjectURL(removed.url);
  renderImages(listKey);
}

function bindImages() {
  for (const [listKey, { el }] of Object.entries(IMAGE_LISTS)) {
    el.addEventListener('change', (event) => {
      if (event.target.type !== 'file') return;
      addFiles(listKey, [...event.target.files]);
      event.target.value = '';
    });
    el.addEventListener('click', (event) => {
      const button = event.target.closest('.remove-btn');
      if (button) removeImage(listKey, Number(button.dataset.index));
    });
  }
}

// 저장 전: 입력 폼에 쳐 두고 확인을 누르지 않은 값도 반영한다.
function applyOpenForms() {
  return Object.keys(FIELDS).every((key) => {
    const form = fieldRow(key).querySelector('[data-form]');
    if (form.hidden || form.querySelector('input').value.trim() === '') return true;
    return applyField(key);
  });
}

function validate() {
  if (!state.name) return '제품명을 입력해 주세요.';
  if (state.price == null) return '가격을 입력해 주세요.';
  if (state.isDiscount && state.discountRate == null) return '할인율을 입력해 주세요.';
  if (state.images.length < 1) return '제품 사진을 1장 이상 올려 주세요.';
  return null;
}

function buildFormData() {
  const form = new FormData();
  form.append('name', state.name);
  form.append('price', String(state.price));
  form.append('isDiscount', String(state.isDiscount));
  if (state.discountRate != null) form.append('discountRate', String(state.discountRate));

  if (!isEdit) {
    state.images.forEach(({ file }) => form.append('images', file));
    state.descriptionImages.forEach(({ file }) => form.append('descriptionImages', file));
    return form;
  }

  // 수정: 화면 순서대로 배치표를 만든다. 기존 사진은 id, 새 사진은 new(파일 순번). 빠진 기존 사진은 서버가 지운다.
  const layoutFor = (list, fileField) => {
    let next = 0;
    return JSON.stringify(
      list.map((image) => {
        if (image.id) return { id: image.id };
        form.append(fileField, image.file);
        return { new: next++ };
      }),
    );
  };
  form.append('imageLayout', layoutFor(state.images, 'newImages'));
  form.append('descriptionImageLayout', layoutFor(state.descriptionImages, 'newDescriptionImages'));
  return form;
}

async function save(button) {
  if (!applyOpenForms()) return;
  const error = validate();
  if (error) {
    alert(error);
    return;
  }

  button.disabled = true;
  try {
    const form = buildFormData();
    if (isEdit) {
      await api(`/api/products/${productId}`, { method: 'PUT', form });
      alert('저장되었습니다.');
      location.href = `/products/${productId}`;
    } else {
      await api('/api/products', { method: 'POST', form });
      alert('등록되었습니다.');
      location.href = '/';
    }
  } catch (err) {
    handleError(err);
    button.disabled = false;
  }
}

async function loadProduct() {
  const { product } = await api(`/api/products/${productId}`);
  Object.assign(state, {
    name: product.name,
    price: product.price,
    isDiscount: product.isDiscount,
    discountRate: product.discountRate,
    images: product.images.map(({ id, url }) => ({ id, url })),
    descriptionImages: product.descriptionImages.map(({ id, url }) => ({ id, url })),
  });
}

(async () => {
  if (!(await initPage('admin'))) return;

  const message = document.getElementById('form-message');
  document.getElementById('form-title').textContent = isEdit ? '제품 수정' : '제품 등록';
  document.title = `${isEdit ? '제품 수정' : '제품 등록'} - BJShoppingmall`;

  if (isEdit) {
    try {
      await loadProduct();
    } catch (err) {
      message.textContent = err.status === 404 ? '제품을 찾을 수 없습니다.' : '제품을 불러오지 못했습니다.';
      if (err.status !== 404) handleError(err);
      return;
    }
  }

  bindFields();
  bindImages();
  renderFields();
  renderImages('images');
  renderImages('descriptionImages');

  const saveBtn = document.getElementById('save-btn');
  saveBtn.addEventListener('click', () => save(saveBtn));
  document.getElementById('cancel-btn').addEventListener('click', () => {
    location.href = isEdit ? `/products/${productId}` : '/';
  });

  message.hidden = true;
  document.getElementById('form-root').hidden = false;

  // 등록 화면은 값이 비어 있으니 제품명, 가격 입력 폼을 처음부터 열어 둔다.
  if (!isEdit) {
    setFormOpen('price', true);
    setFormOpen('name', true);
  }
})();
