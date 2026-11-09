// S-04 회원가입 화면. 관리자여부는 입력받지 않는다 (Q-02).

(async () => {
  await initPage('guest');

  const form = document.getElementById('signup-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    // form.name은 폼 자신의 name 속성이므로 입력칸은 form.elements로 읽는다.
    const fields = form.elements;
    const data = {
      email: fields.email.value.trim(),
      password: fields.password.value,
      name: fields.name.value.trim(),
      phone: fields.phone.value.trim(),
      address: fields.address.value.trim(),
    };

    if (Object.values(data).some((value) => !value)) {
      alert('모든 항목을 입력해 주세요.');
      return;
    }
    if (data.password !== fields.passwordConfirm.value) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await api('/api/auth/signup', { method: 'POST', json: data });
      alert('회원가입이 완료되었습니다. 로그인해 주세요.');
      location.href = '/login';
    } catch (err) {
      handleError(err);
      submit.disabled = false;
    }
  });
})();
