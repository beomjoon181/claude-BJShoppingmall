# BJShoppingmall API 설계

> 기준 문서: `요구사항.md` v1.1, `DB설계.md`, `prisma/schema.prisma` (마이그레이션 `20261109073552_init`)
> 서버: Express 5 + Prisma 6 / DB: MySQL
> 원본과 앞 문서에 없지만 구현에 필요해 정한 부분은 **[추정]**으로 표시한다.

---

## 1. 공통 규칙

### 1.1 기본

| 항목 | 내용 |
| --- | --- |
| Base URL | `/api` |
| 데이터 형식 | JSON (`Content-Type: application/json`). 사진을 올리는 API만 `multipart/form-data` |
| 업로드 파일 | `/uploads/...` 경로로 정적 제공 (`express.static`) |
| 날짜 | ISO 8601 문자열 (예: `2026-11-09T07:35:52.000Z`) |
| 금액 | 정수(원) |

### 1.2 인증 [추정]

| 항목 | 내용 |
| --- | --- |
| 방식 | JWT. 로그인 응답으로 토큰을 받고, 이후 요청 헤더에 `Authorization: Bearer <토큰>`을 넣는다 |
| 토큰 내용 | `{ userId, isAdmin }` |
| 유효 기간 | 1일 |
| 로그아웃 | 서버 API 없음. 클라이언트가 저장한 토큰을 지우고 일반 모드 메인 화면으로 이동한다 |
| 관리자 판단 | 토큰의 `isAdmin`을 믿지 않고, 요청마다 DB의 `User.isAdmin`을 다시 조회한다. DB에서 관리자를 지정하거나 해제하면 바로 반영된다 |

### 1.3 권한 구분

| 표기 | 의미 | 실패 시 |
| --- | --- | --- |
| 공개 | 누구나 | — |
| 회원 | 로그인 + `isAdmin = false` | 미로그인 `401`, 관리자 `403` |
| 관리자 | 로그인 + `isAdmin = true` | 미로그인 `401`, 회원 `403` |
| 로그인 | 회원 또는 관리자 | 미로그인 `401` |

> 비회원이 상세 화면에서 구매/장바구니를 누를 때의 '로그인 하세요' 알림은 프런트에서 처리한다. API를 잘못 호출해도 서버는 `401`로 막는다.

### 1.4 에러 응답

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "할인율은 1~100 사이여야 합니다."
  }
}
```

| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 입력값 오류 (형식, 범위, 사진 개수 등) |
| 401 | `UNAUTHORIZED` | 토큰 없음/만료/잘못됨, 로그인 실패 |
| 403 | `FORBIDDEN` | 권한 없음 (회원이 관리자 API, 관리자가 장바구니 API 호출) |
| 404 | `NOT_FOUND` | 제품, 장바구니 항목 없음 |
| 409 | `DUPLICATE_EMAIL` | 회원가입 이메일 중복 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

### 1.5 공통 응답 객체

**User**
```json
{ "id": 1, "email": "a@b.com", "name": "홍길동", "phone": "010-1234-5678", "address": "서울시 ...", "isAdmin": false }
```
- `password`는 어떤 응답에도 넣지 않는다.

**ProductSummary** (메인 화면 카드)
```json
{
  "id": 3,
  "name": "니트 가디건",
  "price": 39000,
  "isDiscount": true,
  "discountRate": 15,
  "discountPrice": 33150,
  "thumbnailUrl": "/uploads/products/a1b2.jpg"
}
```

**ProductDetail** (상세, 수정 화면)
```json
{
  "id": 3,
  "name": "니트 가디건",
  "price": 39000,
  "isDiscount": false,
  "discountRate": 15,
  "discountPrice": null,
  "images": [
    { "id": 10, "url": "/uploads/products/a1b2.jpg", "sortOrder": 0 },
    { "id": 11, "url": "/uploads/products/c3d4.jpg", "sortOrder": 1 }
  ],
  "descriptionImages": [
    { "id": 20, "url": "/uploads/products/e5f6.jpg", "sortOrder": 0 }
  ],
  "createdAt": "2026-11-09T07:35:52.000Z",
  "updatedAt": "2026-11-09T07:35:52.000Z"
}
```

**가격 필드 규칙**
- `discountPrice` = `Math.round(price * (1 - discountRate / 100))` (Q-12). 서버에서 계산해서 내려준다.
- `isDiscount = false`이면 `discountPrice`는 `null`이다. 이때 `discountRate`는 저장된 값을 그대로 내려준다 (Q-11, 수정 화면에서 다시 켤 때 사용).
- 장바구니/구매 금액에 쓰는 **판매가** = `discountPrice ?? price`.

---

## 2. API 목록

| No | Method | URL | 권한 | 설명 | 화면 |
| --- | --- | --- | --- | --- | --- |
| A-01 | POST | `/api/auth/signup` | 공개 | 회원가입 | S-04 |
| A-02 | POST | `/api/auth/login` | 공개 | 로그인 | S-03 |
| A-03 | GET | `/api/auth/me` | 로그인 | 내 정보 (새로고침 후 모드 복원) | 헤더 |
| P-01 | GET | `/api/products` | 공개 | 제품 목록 | S-01 |
| P-02 | GET | `/api/products/:id` | 공개 | 제품 상세 | S-02, S-07 |
| P-03 | POST | `/api/products` | 관리자 | 제품 등록 | S-08 |
| P-04 | PUT | `/api/products/:id` | 관리자 | 제품 수정 (한꺼번에 저장) | S-07 |
| P-05 | DELETE | `/api/products/:id` | 관리자 | 제품 삭제 | S-01 |
| C-01 | GET | `/api/cart` | 회원 | 장바구니 조회 | S-05 |
| C-02 | POST | `/api/cart/items` | 회원 | 장바구니 담기 | S-02 |
| C-03 | PATCH | `/api/cart/items/:id` | 회원 | 장바구니 수량 변경 | S-05 |
| C-04 | DELETE | `/api/cart` | 회원 | 장바구니 전체 삭제 (취소하기) | S-05 |
| O-01 | POST | `/api/checkout/preview` | 회원 | 구매 페이지 금액 계산 | S-06 |

- 장바구니 개별 삭제(Q-07), 구매 완료(Q-08), 마이페이지(Q-03) API는 만들지 않는다.

---

## 3. 인증 API

### A-01 회원가입 `POST /api/auth/signup`

**요청**
```json
{
  "email": "a@b.com",
  "password": "password123",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "address": "서울시 ..."
}
```

| 필드 | 필수 | 검증 |
| --- | :---: | --- |
| email | O | 이메일 형식, 중복 불가 |
| password | O | 8자 이상 [추정] |
| name | O | 빈 문자열 불가 |
| phone | O | `010-1234-5678` 또는 `01012345678` 형식 [추정] |
| address | O | 빈 문자열 불가 |

- 요청에 `isAdmin`이 있어도 **무시**한다. 항상 `isAdmin = false`로 만든다 (Q-02, NFR-02).
- 비밀번호는 bcrypt로 해시해서 저장한다.

**응답** `201 Created`
```json
{ "user": { "id": 1, "email": "a@b.com", "name": "홍길동", "phone": "010-1234-5678", "address": "서울시 ...", "isAdmin": false } }
```

**에러**: `400` 입력값 오류, `409 DUPLICATE_EMAIL`

### A-02 로그인 `POST /api/auth/login`

**요청**
```json
{ "email": "a@b.com", "password": "password123" }
```

**응답** `200 OK`
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "email": "a@b.com", "name": "홍길동", "phone": "010-1234-5678", "address": "서울시 ...", "isAdmin": false }
}
```
- 프런트는 `user.isAdmin`으로 로그인 모드 / 관리자 모드를 정한다.

**에러**: `401` — 이메일이 없을 때와 비밀번호가 틀릴 때 **같은 메시지**("이메일 또는 비밀번호가 올바르지 않습니다.")를 준다.

### A-03 내 정보 `GET /api/auth/me`

**응답** `200 OK`
```json
{ "user": { "id": 1, "email": "a@b.com", "name": "홍길동", "phone": "010-1234-5678", "address": "서울시 ...", "isAdmin": false } }
```
- 새로고침했을 때 저장된 토큰으로 모드를 다시 정하는 데 쓴다.

**에러**: `401` (토큰 만료 시 프런트는 토큰을 지우고 일반 모드로 전환)

---

## 4. 제품 API

### P-01 제품 목록 `GET /api/products`

**응답** `200 OK`
```json
{ "products": [ /* ProductSummary */ ] }
```
- `createdAt` 내림차순(최신순).
- `thumbnailUrl`은 `kind = PRODUCT` 사진 중 `sortOrder`가 가장 작은 것.
- 페이지네이션은 두지 않는다 [추정].

### P-02 제품 상세 `GET /api/products/:id`

**응답** `200 OK`
```json
{ "product": { /* ProductDetail */ } }
```
- `images`, `descriptionImages`는 각각 `sortOrder` 오름차순.

**에러**: `404`

### P-03 제품 등록 `POST /api/products`

`multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | :---: | --- |
| name | 텍스트 | O | 제품명 |
| price | 텍스트(정수) | O | 0 이상 |
| isDiscount | 텍스트 `true`/`false` | O | 할인여부 |
| discountRate | 텍스트(정수) | 조건부 | `isDiscount = true`이면 필수, 1~100. `false`여도 보내면 저장 |
| images | 파일 (여러 개) | O | 제품 사진. **1~10장**. 보낸 순서가 `sortOrder` |
| descriptionImages | 파일 (여러 개) | - | 제품 설명 사진. 보낸 순서가 `sortOrder` |

**응답** `201 Created`
```json
{ "product": { /* ProductDetail */ } }
```
- 프런트는 성공하면 메인 화면으로 이동한다.

**에러**: `400` (필수값 누락, 사진 개수, 파일 형식/용량), `401`, `403`

### P-04 제품 수정 `PUT /api/products/:id`

수정 화면에서 바꾼 내용을 **저장 버튼으로 한꺼번에** 보낸다 (Q-10). 사진의 추가·삭제·순서를 한 요청에 담기 위해, 최종 사진 목록을 순서대로 적은 **배치표(layout)**를 함께 보낸다.

`multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | :---: | --- |
| name | 텍스트 | O | 제품명 |
| price | 텍스트(정수) | O | 0 이상 |
| isDiscount | 텍스트 `true`/`false` | O | 할인여부 |
| discountRate | 텍스트(정수) | 조건부 | P-03과 같음. 보내지 않으면 저장된 값을 유지하고, `isDiscount = true`인데 저장된 값도 없을 때만 `400` |
| imageLayout | 텍스트(JSON) | O | 제품 사진의 최종 목록 (아래 참고) |
| descriptionImageLayout | 텍스트(JSON) | O | 설명 사진의 최종 목록 |
| newImages | 파일 (여러 개) | - | 새로 추가한 제품 사진 |
| newDescriptionImages | 파일 (여러 개) | - | 새로 추가한 설명 사진 |

**배치표 형식**

화면에 보이는 순서대로, 기존 사진은 `id`로, 새 사진은 `new`(같은 요청의 파일 순번, 0부터)로 적는다.

```json
[ { "id": 11 }, { "new": 0 }, { "id": 10 }, { "new": 1 } ]
```

위 예시의 의미:
- 기존 사진 11 → 0번째, 새 파일 `newImages[0]` → 1번째, 기존 사진 10 → 2번째, 새 파일 `newImages[1]` → 3번째
- 이 제품의 기존 제품 사진 중 **배치표에 없는 것은 삭제**한다 ('-' 버튼으로 뺀 사진)

**처리 순서** (하나의 트랜잭션, NFR-06)
1. 배치표 검증: `id`가 이 제품의 같은 종류 사진인지, `new` 순번이 실제 파일과 맞는지, 제품 사진 최종 개수가 **1~10장**인지
2. `Product` 수정
3. 배치표에 없는 기존 사진 삭제
4. 새 사진 생성, 모든 사진의 `sortOrder`를 배치표 순서로 갱신
5. 트랜잭션이 성공하면 삭제된 사진의 파일을 지운다. 실패하면 이번 요청에서 올라온 파일을 지운다

**응답** `200 OK`
```json
{ "product": { /* ProductDetail */ } }
```

**에러**: `400` (배치표 오류, 사진 개수 등), `401`, `403`, `404`

### P-05 제품 삭제 `DELETE /api/products/:id`

- '삭제하시겠습니까?' 확인은 프런트에서 처리한다.
- `ProductImage`, `CartItem`은 DB에서 CASCADE로 함께 삭제된다. 삭제가 끝나면 사진 파일을 지운다.

**응답** `204 No Content`

**에러**: `401`, `403`, `404`

### 4.1 파일 업로드 규칙 [추정]

| 항목 | 값 |
| --- | --- |
| 허용 형식 | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| 파일당 최대 용량 | 5MB |
| 설명 사진 최대 개수 | 개수 제한 없음 (Q-16 가정). 다만 한 요청에 30장까지 |
| 저장 위치 | `uploads/products/` |
| 파일명 | 원래 이름 대신 서버가 만든 무작위 이름 + 확장자 |
| 라이브러리 | `multer` |

---

## 5. 장바구니 API

모두 **회원**만 쓸 수 있다. 관리자가 호출하면 `403` (Q-15).

### C-01 장바구니 조회 `GET /api/cart`

**응답** `200 OK`
```json
{
  "items": [
    {
      "id": 7,
      "quantity": 2,
      "product": { /* ProductSummary */ },
      "unitPrice": 33150,
      "amount": 66300
    }
  ],
  "totalPrice": 66300
}
```
- `unitPrice` = 판매가(`discountPrice ?? price`), `amount` = `unitPrice × quantity`.
- 담은 순서(`createdAt` 오름차순).

### C-02 장바구니 담기 `POST /api/cart/items`

**요청**
```json
{ "productId": 3, "quantity": 2 }
```
- `quantity`: 1 이상 정수.
- 이미 담긴 제품이면 기존 수량에 **더한다** (Q-19 가정). `upsert`로 처리.

**응답** `201 Created`
```json
{ "item": { "id": 7, "productId": 3, "quantity": 4 } }
```
- 프런트는 성공하면 장바구니 페이지로 이동한다.

**에러**: `400`, `401`, `403`, `404` (제품 없음)

### C-03 장바구니 수량 변경 `PATCH /api/cart/items/:id`

**요청**
```json
{ "quantity": 3 }
```
- 수량을 **이 값으로 바꾼다** (더하지 않음). 1 이상.
- 다른 회원의 장바구니 항목이면 `404`.

**응답** `200 OK`
```json
{ "item": { "id": 7, "productId": 3, "quantity": 3 } }
```

### C-04 장바구니 전체 삭제 `DELETE /api/cart`

- 취소하기 버튼. 내 장바구니 항목을 모두 지운다.
- 프런트는 성공하면 메인 화면으로 이동한다.

**응답** `204 No Content`

---

## 6. 구매 API

### O-01 구매 금액 계산 `POST /api/checkout/preview`

구매 페이지(S-06)에 보여줄 제품과 금액을 서버에서 계산한다. 장바구니에서 올 때와 바로 구매로 올 때 모두 이 API를 쓴다. **DB에는 아무것도 저장하지 않는다.**

**요청**
```json
{ "items": [ { "productId": 3, "quantity": 2 }, { "productId": 5, "quantity": 1 } ] }
```

| 진입 경로 | 프런트가 보내는 `items` |
| --- | --- |
| 장바구니 → 구매하기 | 장바구니(C-01)의 제품과 수량 전체 |
| 상세 → 구매 (바로 구매) | 그 제품 하나와 선택한 수량 (Q-09). 장바구니는 건드리지 않는다 |
| 구매 페이지에서 수량 변경 | 바뀐 수량으로 다시 호출. 장바구니 수량은 바뀌지 않는다 [추정] |

**응답** `200 OK`
```json
{
  "items": [
    { "product": { /* ProductSummary */ }, "quantity": 2, "unitPrice": 33150, "amount": 66300 },
    { "product": { /* ProductSummary */ }, "quantity": 1, "unitPrice": 12000, "amount": 12000 }
  ],
  "totalPrice": 78300
}
```

**에러**: `400` (빈 목록, 수량 오류), `401`, `403`, `404` (없는 제품)

> 구매 페이지의 **구매하기 버튼**은 이번 범위에서 API를 만들지 않는다 (Q-08). 추후 `POST /api/orders`로 `DB설계.md` 7장의 `Order`, `OrderItem`을 만든다.

---

## 7. 화면별 API 호출

| 화면 | 동작 | API |
| --- | --- | --- |
| 공통 헤더 | 앱 시작 시 토큰이 있으면 모드 확인 | A-03 |
| 공통 헤더 | 로그아웃 | (토큰 삭제만) |
| S-01 메인 | 목록 표시 | P-01 |
| S-01 메인 (관리자) | 삭제 버튼 → 확인창 '예' | P-05 → P-01 다시 조회 |
| S-02 상세 | 표시 | P-02 |
| S-02 상세 (회원) | 장바구니 버튼 | C-02 → S-05 이동 |
| S-02 상세 (회원) | 구매 버튼 | S-06으로 이동 (`productId`, `quantity` 전달) → O-01 |
| S-03 로그인 | 로그인 | A-02 |
| S-04 회원가입 | 가입 | A-01 → S-03 이동 |
| S-05 장바구니 | 표시 | C-01 |
| S-05 장바구니 | 수량 변경 | C-03 → C-01 다시 조회 |
| S-05 장바구니 | 구매하기 | S-06 이동 → O-01 |
| S-05 장바구니 | 취소하기 | C-04 → S-01 이동 |
| S-06 구매 | 표시 / 수량 변경 | O-01 |
| S-07 수정 | 기존 값 불러오기 | P-02 |
| S-07 수정 | 저장 | P-04 |
| S-08 등록 | 저장 | P-03 → S-01 이동 |

---

## 8. 서버 구성 [추정]

### 8.1 추가할 패키지

| 패키지 | 용도 |
| --- | --- |
| `bcrypt` | 비밀번호 해시 |
| `jsonwebtoken` | JWT 발급/검증 |
| `multer` | 사진 업로드 |
| `dotenv` | `.env` 읽기 (`DATABASE_URL`, `JWT_SECRET`) |

### 8.2 미들웨어

| 이름 | 역할 |
| --- | --- |
| `authenticate` | 토큰을 검증하고 DB에서 사용자를 조회해 `req.user`에 넣는다. 실패하면 `401` |
| `requireMember` | `authenticate` + `req.user.isAdmin === false`가 아니면 `403` |
| `requireAdmin` | `authenticate` + `req.user.isAdmin === true`가 아니면 `403` |
| `errorHandler` | 모든 에러를 1.4 형식으로 응답. multer 에러(용량 초과 등)는 `400` |

### 8.3 폴더 구조

```
BJShoppingmall/
├─ prisma/
│  └─ schema.prisma
├─ uploads/products/        # 업로드 사진 (git 제외)
├─ src/
│  ├─ app.js                # express 설정, 라우터 연결, 정적 파일
│  ├─ server.js             # listen
│  ├─ lib/prisma.js         # PrismaClient 1개
│  ├─ middlewares/          # auth.js, upload.js, errorHandler.js
│  ├─ routes/               # auth.js, products.js, cart.js, checkout.js
│  └─ utils/price.js        # discountPrice, 판매가 계산
└─ .env                     # DATABASE_URL, JWT_SECRET
```
