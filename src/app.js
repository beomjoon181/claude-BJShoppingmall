const path = require('path');
const express = require('express');
const cors = require('cors');
const { UPLOAD_ROOT } = require('./middlewares/upload');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_ROOT));
app.use('/static', express.static(path.join(__dirname, '..', 'public', 'static')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/checkout', require('./routes/checkout'));
app.use('/api', notFoundHandler);

app.use(require('./routes/pages'));
app.use((req, res) => res.status(404).type('text').send('페이지를 찾을 수 없습니다.'));
app.use(errorHandler);

module.exports = app;
