const path = require('path');
const express = require('express');

const router = express.Router();

const PAGES_DIR = path.join(__dirname, '..', '..', 'public', 'pages');

const page = (file) => (req, res) => res.sendFile(path.join(PAGES_DIR, file));

// 화면 목록 (요구사항 3장). 권한 확인과 데이터 조회는 각 화면의 JS가 API로 한다.
router.get('/', page('index.html')); // S-01 메인
router.get('/products/:id', page('product.html')); // S-02 상세
router.get('/login', page('login.html')); // S-03 로그인
router.get('/signup', page('signup.html')); // S-04 회원가입
router.get('/cart', page('cart.html')); // S-05 장바구니
router.get('/checkout', page('checkout.html')); // S-06 구매
router.get('/admin/products/new', page('product-form.html')); // S-08 제품 등록
router.get('/admin/products/:id/edit', page('product-form.html')); // S-07 제품 수정

module.exports = router;
