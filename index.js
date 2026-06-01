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

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- DİLEKLER ---

// Tüm dilekleri getir
app.get('/api/wishes', async (req, res) => {
  const { data, error } = await supabase
    .from('wishes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Yeni dilek ekle
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

// --- FOTOĞRAFLAR ---

// Tüm fotoğrafları getir
app.get('/api/photos', async (req, res) => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Fotoğraf yükle
app.post('/api/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fotoğraf bulunamadı.' });

  const ext = req.file.mimetype.split('/')[1];
  const filename = `photo_${Date.now()}.${ext}`;

  // Supabase Storage'a yükle
  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  // Public URL al
  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filename);
  const publicUrl = urlData.publicUrl;

  // DB'ye kaydet
  const { data, error } = await supabase
    .from('photos')
    .insert([{ url: publicUrl, filename }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server çalışıyor: port ${PORT}`));
