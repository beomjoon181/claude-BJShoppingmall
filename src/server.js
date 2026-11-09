require('dotenv').config({ quiet: true });

if (!process.env.JWT_SECRET) {
  console.error('.env에 JWT_SECRET이 없습니다.');
  process.exit(1);
}

const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`BJShoppingmall API: http://localhost:${PORT}`);
});
