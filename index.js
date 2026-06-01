require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nisan2026';

app.use(cors({ origin: '*' }));
app.use(express.json());

// Admin auth middleware
function adminAuth(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Yetkisiz erişim.' });
  next();
}

// --- DİLEKLER ---
app.get('/api/wishes', async (req, res) => {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/wishes', async (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'İsim ve mesaj zorunlu.' });
  const { data, error } = await supabase
    .from('wishes')
    .insert([{ name: name.trim(), message: message.trim() }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/wishes/:id', adminAuth, async (req, res) => {
  const { error } = await supabase.from('wishes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- FOTOĞRAFLAR ---
app.get('/api/photos', async (req, res) => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fotoğraf bulunamadı.' });

  const { uploader_name, note } = req.body;
  const ext = req.file.mimetype.split('/')[1];
  const filename = `photo_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filename, req.file.buffer, { contentType: req.file.mimetype });
  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filename);

  const { data, error } = await supabase
    .from('photos')
    .insert([{ url: urlData.publicUrl, filename, uploader_name: uploader_name || 'Misafir', note: note || '' }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/photos/:id', adminAuth, async (req, res) => {
  const { data: photo } = await supabase.from('photos').select('filename').eq('id', req.params.id).single();
  if (photo) await supabase.storage.from('photos').remove([photo.filename]);
  const { error } = await supabase.from('photos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server çalışıyor: port ${PORT}`));
