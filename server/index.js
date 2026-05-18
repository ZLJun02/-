/**
 * 古建数据贡献平台 - 后端服务器
 * Ancient Architecture Knowledge Platform - Backend Server
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

// ─── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '16mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Database ──────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'knowledge.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      abstract TEXT DEFAULT '',
      keywords TEXT DEFAULT '',
      dynasty TEXT DEFAULT '',
      building_type TEXT DEFAULT '',
      building_name TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      sub_category TEXT DEFAULT '',
      dynasty TEXT DEFAULT '',
      building_name TEXT DEFAULT '',
      cai REAL,
      fen REAL,
      length REAL,
      width REAL,
      height REAL,
      diameter REAL,
      unit TEXT DEFAULT '米',
      description TEXT DEFAULT '',
      source TEXT DEFAULT '',
      material TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS models_3d (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      building_name TEXT DEFAULT '',
      component_type TEXT DEFAULT '',
      dynasty TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      file_format TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      thumbnail_path TEXT DEFAULT '',
      front_view TEXT DEFAULT '',
      side_view TEXT DEFAULT '',
      top_view TEXT DEFAULT '',
      iso_view TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      building_name TEXT DEFAULT '',
      category TEXT DEFAULT '',
      dynasty TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
initDB();

// ─── File Upload Config ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// ═══════════════════════════════════════════════════════════════
//  API Routes
// ═══════════════════════════════════════════════════════════════

// ─── Dashboard Stats ───────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const papers = db.prepare('SELECT COUNT(*) as count FROM papers').get();
  const components = db.prepare('SELECT COUNT(*) as count FROM components').get();
  const models = db.prepare('SELECT COUNT(*) as count FROM models_3d').get();
  const images = db.prepare('SELECT COUNT(*) as count FROM images').get();
  const allDynasties = new Set();
  db.prepare("SELECT DISTINCT dynasty FROM papers WHERE dynasty != ''").all().forEach(r => allDynasties.add(r.dynasty));
  db.prepare("SELECT DISTINCT dynasty FROM components WHERE dynasty != ''").all().forEach(r => allDynasties.add(r.dynasty));
  db.prepare("SELECT DISTINCT dynasty FROM models_3d WHERE dynasty != ''").all().forEach(r => allDynasties.add(r.dynasty));
  db.prepare("SELECT DISTINCT dynasty FROM images WHERE dynasty != ''").all().forEach(r => allDynasties.add(r.dynasty));
  res.json({ papers: papers.count, components: components.count, models: models.count, images: images.count, dynasties: [...allDynasties] });
});

// ─── Search (unified) ──────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const { q, type, dynasty, category } = req.query;
  const term = `%${q || ''}%`;
  const results = [];

  if (!type || type === 'papers') {
    let sql = `SELECT id, title, author, abstract, dynasty, building_type, building_name, file_type, created_at FROM papers WHERE (title LIKE ? OR abstract LIKE ? OR keywords LIKE ? OR author LIKE ?)`;
    let params = [term, term, term, term];
    if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
    sql += ' ORDER BY created_at DESC LIMIT 30';
    results.push(...db.prepare(sql).all(...params).map(r => ({ ...r, _type: 'paper' })));
  }
  if (!type || type === 'components') {
    let sql = `SELECT * FROM components WHERE (name LIKE ? OR description LIKE ? OR building_name LIKE ?)`;
    let params = [term, term, term];
    if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY created_at DESC LIMIT 30';
    results.push(...db.prepare(sql).all(...params).map(r => ({ ...r, _type: 'component' })));
  }
  if (!type || type === 'models') {
    let sql = `SELECT * FROM models_3d WHERE (name LIKE ? OR description LIKE ?)`;
    let params = [term, term];
    if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
    sql += ' ORDER BY created_at DESC LIMIT 20';
    results.push(...db.prepare(sql).all(...params).map(r => ({ ...r, _type: 'model' })));
  }
  if (!type || type === 'images') {
    let sql = `SELECT * FROM images WHERE (title LIKE ? OR description LIKE ?)`;
    let params = [term, term];
    if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
    sql += ' ORDER BY created_at DESC LIMIT 20';
    results.push(...db.prepare(sql).all(...params).map(r => ({ ...r, _type: 'image' })));
  }
  res.json(results);
});

// ═══════════════════════════════════════════════════════════════
//  Papers API
// ═══════════════════════════════════════════════════════════════
app.get('/api/papers', (req, res) => {
  const { dynasty, building_type, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT * FROM papers WHERE 1=1';
  const params = [];
  if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
  if (building_type) { sql += ' AND building_type = ?'; params.push(building_type); }
  const total = db.prepare(sql.replace('*', 'COUNT(*) as count')).get(...params).count;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  const items = db.prepare(sql).all(...params);
  res.json({ items, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

app.get('/api/papers/:id', (req, res) => {
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(req.params.id);
  if (!paper) return res.status(404).json({ error: 'Not found' });
  res.json(paper);
});

app.post('/api/papers', upload.single('file'), (req, res) => {
  const { title, author, abstract, keywords, dynasty, building_type, building_name } = req.body;
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  const file = req.file;
  const result = db.prepare(`INSERT INTO papers (title, author, abstract, keywords, dynasty, building_type, building_name, file_name, file_path, file_type, file_size)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    title, author || '', abstract || '', keywords || '', dynasty || '', building_type || '', building_name || '',
    file ? file.originalname : '', file ? '/uploads/' + file.filename : '', file ? file.mimetype : '', file ? file.size : 0
  );
  res.json({ id: result.lastInsertRowid, message: '论文上传成功' });
});

app.delete('/api/papers/:id', (req, res) => {
  const paper = db.prepare('SELECT file_path FROM papers WHERE id = ?').get(req.params.id);
  if (!paper) return res.status(404).json({ error: 'Not found' });
  if (paper.file_path) {
    try { require('fs').unlinkSync(path.join(__dirname, paper.file_path)); } catch(e) {}
  }
  db.prepare('DELETE FROM papers WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ═══════════════════════════════════════════════════════════════
//  Components API
// ═══════════════════════════════════════════════════════════════
app.get('/api/components', (req, res) => {
  const { dynasty, category, building_name, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT * FROM components WHERE 1=1';
  const params = [];
  if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (building_name) { sql += ' AND building_name = ?'; params.push(building_name); }
  const total = db.prepare(sql.replace('*', 'COUNT(*) as count')).get(...params).count;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  const items = db.prepare(sql).all(...params);
  res.json({ items, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

app.get('/api/components/categories', (req, res) => {
  const cats = db.prepare("SELECT DISTINCT category FROM components WHERE category != ''").all();
  res.json(cats.map(c => c.category));
});

app.get('/api/components/:id', (req, res) => {
  try {
    const comp = db.prepare('SELECT * FROM components WHERE id = ?').get(req.params.id);
    if (!comp) return res.status(404).json({ error: '构件未找到' });
    res.json(comp);
  } catch (err) {
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

app.post('/api/components', (req, res) => {
  const { name, category, sub_category, dynasty, building_name, cai, fen, length, width, height, diameter, unit, description, source, material } = req.body;
  if (!name) return res.status(400).json({ error: '构件名称不能为空' });
  const result = db.prepare(`INSERT INTO components (name, category, sub_category, dynasty, building_name, cai, fen, length, width, height, diameter, unit, description, source, material)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    name, category || '', sub_category || '', dynasty || '', building_name || '', cai || null, fen || null,
    length || null, width || null, height || null, diameter || null, unit || '米', description || '', source || '', material || ''
  );
  res.json({ id: result.lastInsertRowid, message: '构件参数添加成功' });
});

app.delete('/api/components/:id', (req, res) => {
  db.prepare('DELETE FROM components WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ═══════════════════════════════════════════════════════════════
//  3D Models API
// ═══════════════════════════════════════════════════════════════
app.get('/api/models', (req, res) => {
  const { dynasty, component_type, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT * FROM models_3d WHERE 1=1';
  const params = [];
  if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
  if (component_type) { sql += ' AND component_type = ?'; params.push(component_type); }
  const total = db.prepare(sql.replace('*', 'COUNT(*) as count')).get(...params).count;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  const items = db.prepare(sql).all(...params);
  res.json({ items, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

app.get('/api/models/:id', (req, res) => {
  const model = db.prepare('SELECT * FROM models_3d WHERE id = ?').get(req.params.id);
  if (!model) return res.status(404).json({ error: 'Not found' });
  res.json(model);
});

app.post('/api/models', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'front_view', maxCount: 1 },
  { name: 'side_view', maxCount: 1 },
  { name: 'top_view', maxCount: 1 },
  { name: 'iso_view', maxCount: 1 }
]), (req, res) => {
  const { name, description, building_name, component_type, dynasty } = req.body;
  if (!name) return res.status(400).json({ error: '模型名称不能为空' });
  const files = req.files || {};
  const mainFile = files.file ? files.file[0] : null;
  const result = db.prepare(`INSERT INTO models_3d (name, description, building_name, component_type, dynasty, file_path, file_format, file_size, thumbnail_path, front_view, side_view, top_view, iso_view)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    name, description || '', building_name || '', component_type || '', dynasty || '',
    mainFile ? '/uploads/' + mainFile.filename : '',
    mainFile ? path.extname(mainFile.originalname) : '',
    mainFile ? mainFile.size : 0,
    files.thumbnail ? '/uploads/' + files.thumbnail[0].filename : '',
    files.front_view ? '/uploads/' + files.front_view[0].filename : '',
    files.side_view ? '/uploads/' + files.side_view[0].filename : '',
    files.top_view ? '/uploads/' + files.top_view[0].filename : '',
    files.iso_view ? '/uploads/' + files.iso_view[0].filename : ''
  );
  res.json({ id: result.lastInsertRowid, message: '模型上传成功' });
});

app.delete('/api/models/:id', (req, res) => {
  const model = db.prepare('SELECT file_path, thumbnail_path, front_view, side_view, top_view, iso_view FROM models_3d WHERE id = ?').get(req.params.id);
  if (model) {
    [model.file_path, model.thumbnail_path, model.front_view, model.side_view, model.top_view, model.iso_view].forEach(p => {
      if (p) try { require('fs').unlinkSync(path.join(__dirname, p)); } catch(e) {}
    });
  }
  db.prepare('DELETE FROM models_3d WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ═══════════════════════════════════════════════════════════════
//  Images API
// ═══════════════════════════════════════════════════════════════
app.get('/api/images', (req, res) => {
  const { dynasty, category, page = 1, limit = 24 } = req.query;
  let sql = 'SELECT * FROM images WHERE 1=1';
  const params = [];
  if (dynasty) { sql += ' AND dynasty = ?'; params.push(dynasty); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  const total = db.prepare(sql.replace('*', 'COUNT(*) as count')).get(...params).count;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  const items = db.prepare(sql).all(...params);
  res.json({ items, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
});

app.get('/api/images/:id', (req, res) => {
  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: 'Not found' });
  res.json(img);
});

app.post('/api/images', upload.single('file'), (req, res) => {
  const { title, description, building_name, category, dynasty } = req.body;
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  if (!req.file) return res.status(400).json({ error: '请上传图片文件' });
  const result = db.prepare(`INSERT INTO images (title, description, building_name, category, dynasty, file_path, file_size)
    VALUES (?,?,?,?,?,?,?)`).run(
    title, description || '', building_name || '', category || '', dynasty || '', '/uploads/' + req.file.filename, req.file.size
  );
  res.json({ id: result.lastInsertRowid, message: '图片上传成功' });
});

app.delete('/api/images/:id', (req, res) => {
  const img = db.prepare('SELECT file_path FROM images WHERE id = ?').get(req.params.id);
  if (img && img.file_path) try { require('fs').unlinkSync(path.join(__dirname, img.file_path)); } catch(e) {}
  db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

// ═══════════════════════════════════════════════════════════════
//  Seed Data (initial reference data)
// ═══════════════════════════════════════════════════════════════
app.post('/api/seed', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM components').get();
  if (count.c > 0) return res.json({ message: '数据库已有数据，跳过初始化' });
  const seed = [
    ['栌斗','斗拱','大斗','唐代','佛光寺东大殿',0.304,0.0203,1.4,1.4,1.0,null,'材','柱顶承托大斗','佛光寺实测','木材'],
    ['华栌斗','斗拱','交互斗','唐代','佛光寺东大殿',0.304,0.0203,1.0,1.0,0.8,null,'材','柱头铺作斗','佛光寺实测','木材'],
    ['耍头','斗拱','端部构件','唐代','佛光寺东大殿',0.304,0.0203,1.2,0.8,0.6,null,'材','外跳端部','佛光寺实测','木材'],
    ['昂','斗拱','斜向构件','唐代','佛光寺东大殿',0.304,0.0203,2.0,0.4,0.3,null,'材','双下昂','佛光寺实测','木材'],
    ['交互枪','斗拱','横向构件','唐代','佛光寺东大殿',0.304,0.0203,2.0,0.5,0.4,null,'材','横向出跳','佛光寺实测','木材'],
    ['柱','柱','外檐柱','唐代','佛光寺东大殿',0.304,0.0203,null,null,4.15,0.68,'米','圆柱，有侧脚收分','佛光寺实测','木材'],
    ['阑额','梁枋','额枋','唐代','佛光寺东大殿',0.304,0.0203,5.2,0.6,0.8,null,'米','柱间横向连接','佛光寺实测','木材'],
    ['栌斗','斗拱','大斗','辽代','应县木塔',0.21,0.014,1.4,1.4,1.0,null,'材','底层外檐斗拱','应县木塔实测','木材'],
    ['柱','柱','外檐柱','辽代','应县木塔',0.21,0.014,null,null,null,1.88,'米','底层外檐圆柱','应县木塔实测','木材'],
    ['栌斗','斗拱','大斗','北宋','晋祠圣母殿',0.335,0.0223,1.4,1.4,1.0,null,'材','《营造法式》标准','营造法式','木材'],
    ['柱','柱','檐柱','清代','故宫太和殿',0.32,0.0213,null,null,12.7,1.06,'米','清工部做法','清工部工程做法','木材'],
  ];
  const stmt = db.prepare('INSERT INTO components (name,category,sub_category,dynasty,building_name,cai,fen,length,width,height,diameter,unit,description,source,material) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const tx = db.transaction(() => { for (const s of seed) stmt.run(...s); });
  tx();
  res.json({ message: '已初始化 ' + seed.length + ' 条古建构件参数数据', count: seed.length });
});

// ─── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// ─── Fallback: serve index.html for SPA navigation ─────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ─── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏛️  古建数据贡献平台已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api\n`);
});
