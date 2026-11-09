// S-03 로그인 화면

// 로그인 후 돌아갈 화면. 같은 사이트 경로만 허용한다.
function nextPath() {
  const next = new URLSearchParams(location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

(async () => {
  await initPage('guest');

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const { token, user } = await api('/api/auth/login', { method: 'POST', json: { email, password } });
      Auth.setToken(token);
      // 관리자는 장바구니/구매 화면을 쓰지 않으므로 메인으로 보낸다.
      location.href = user.isAdmin ? '/' : nextPath();
    } catch (err) {
      handleError(err);
      submit.disabled = false;
    }
  });
})();
