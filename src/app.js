const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files as static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/game',  require('./routes/game.routes'));
app.use('/api/cards', require('./routes/card.routes'));
app.use('/api/codes', require('./routes/code.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// Health check
app.get('/', (req, res) => res.json({ status: 'T3LALY API running ✅' }));
// Privacy Policy page
app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>سياسة الخصوصية - تعلالي T3LALY</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.8; color: #222; }
        h1 { color: #0E5685; }
        h2 { color: #0E5685; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h1>سياسة الخصوصية - تعلالي (T3LALY)</h1>
      <p>آخر تحديث: يوليو 2026</p>

      <h2>مقدمة</h2>
      <p>نحن في تعلالي نحترم خصوصيتك. هذه الصفحة توضح البيانات اللي بنجمعها من خلال استخدامك للتطبيق وإزاي بنستخدمها.</p>

      <h2>البيانات اللي بنجمعها</h2>
      <p>التطبيق مش بيطلب حساب أو تسجيل دخول. البيانات اللي ممكن تتجمع تشمل:</p>
      <ul>
        <li>أسماء اللاعبين اللي بتدخلها وقت اللعب (بتتخزن على جهازك بس)</li>
        <li>معرف الجهاز (Device ID) المستخدم لتفعيل أكواد اللعب وربطها بجهازك</li>
      </ul>

      <h2>إزاي بنستخدم البيانات</h2>
      <p>البيانات دي بتُستخدم فقط عشان تشغيل اللعبة بشكل صحيح، زي حفظ تقدمك وتفعيل الأكواد. احنا مش بنبيع أو نشارك بياناتك مع أي جهات تالتة.</p>

      <h2>التواصل</h2>
      <p>لو عندك أي استفسار عن سياسة الخصوصية، تقدر تتواصل معانا على: t3alaly.0@gmail.com</p>
    </body>
    </html>
  `);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));