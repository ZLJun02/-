/**
 * 古建数据贡献平台 - 前端应用
 * Ancient Architecture Knowledge Platform - Frontend App
 */
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const API = '/api';

class App {
  constructor() {
    this.currentSection = 'home';
    this.pages = {};
    this.viewer = null;
    this.init();
  }

  async init() {
    this.bindNav();
    this.bindSearchShortcuts();
    await this.seedData();
    await this.loadHome();
  }

  // ═══ Navigation ═════════════════════════════════════════════
  bindNav() {
    document.querySelectorAll('#main-nav a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(a.dataset.section);
      });
    });
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
  }

  navigate(section) {
    this.currentSection = section;
    document.querySelectorAll('#main-nav a').forEach(a => a.classList.toggle('active', a.dataset.section === section));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === 'sec-' + section));
    switch (section) {
      case 'home': this.loadHome(); break;
      case 'papers': this.loadPapers(); break;
      case 'components': this.loadComponents(); break;
      case 'models': this.loadModels(); break;
      case 'images': this.loadImages(); break;
    }
  }

  bindSearchShortcuts() {
    document.getElementById('home-search').addEventListener('keydown', e => { if (e.key === 'Enter') this.search(); });
  }

  // ═══ Seed Data ═══════════════════════════════════════════════
  async seedData() {
    try { await fetch(API + '/seed', { method: 'POST' }); } catch (e) {}
  }

  // ═══ Home ════════════════════════════════════════════════════
  async loadHome() {
    await this.loadStats();
    await this.loadRecent();
  }

  async loadStats() {
    try {
      const r = await fetch(API + '/stats');
      const d = await r.json();
      document.getElementById('stats-row').innerHTML = `
        <div class="stat-card"><div class="num">${d.papers}</div><div class="label">📄 文献论文</div></div>
        <div class="stat-card"><div class="num">${d.components}</div><div class="label">📐 构件参数</div></div>
        <div class="stat-card"><div class="num">${d.models}</div><div class="label">🧊 3D模型</div></div>
        <div class="stat-card"><div class="num">${d.images}</div><div class="label">🖼️ 图片资料</div></div>
        <div class="stat-card"><div class="num">${d.dynasties.length}</div><div class="label">🏯 涵盖朝代</div></div>
      `;
    } catch (e) { console.error(e); }
  }

  async loadRecent() {
    try {
      const r = await fetch(API + '/search?q=');
      const items = await r.json();
      const html = items.slice(0, 6).map(item => this.renderSearchCard(item)).join('');
      document.getElementById('home-recent').innerHTML = html || '<p style="color:var(--muted)">暂无数据，前往「贡献」页面上传第一条数据</p>';
      this.bindCardClicks();
    } catch (e) { console.error(e); }
  }

  async search() {
    const q = document.getElementById('home-search').value;
    const type = document.getElementById('home-search-type').value;
    const r = await fetch(API + '/search?q=' + encodeURIComponent(q) + (type ? '&type=' + type : ''));
    const items = await r.json();
    const html = items.map(item => this.renderSearchCard(item)).join('');
    document.getElementById('home-recent').innerHTML = '<h3 style="margin-bottom:16px">🔍 搜索结果 (' + items.length + ')</h3>' + (html || '<p>未找到结果</p>');
    this.bindCardClicks();
  }

  renderSearchCard(item) {
    const typeLabel = { paper: '📄 文献', component: '📐 构件', model: '🧊 模型', image: '🖼️ 图片' };
    const badgeClass = { '唐代': 'badge-tang', '宋代': 'badge-song', '辽代': 'badge-liao', '明代': 'badge-ming', '清代': 'badge-qing' };
    const dynasty = item.dynasty || '';
    return `<div class="card" data-type="${item._type}" data-id="${item.id}">
      <h3>${this.esc(item.title || item.name)}</h3>
      <div class="meta">
        <span>${typeLabel[item._type] || ''}</span>
        ${dynasty ? `<span class="badge ${badgeClass[dynasty] || ''}">${dynasty}</span>` : ''}
      </div>
      <div class="desc">${this.esc(item.abstract || item.description || '')}</div>
    </div>`;
  }

  bindCardClicks() {
    document.querySelectorAll('#home-recent .card, #paper-list .card, #model-list .card, #img-list .card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        const id = card.dataset.id;
        if (type === 'paper' || type === 'papers') this.showPaperDetail(id);
        else if (type === 'model' || type === 'models') this.showModelDetail(id);
        else if (type === 'image' || type === 'images') this.showImageModal(id);
        else if (type === 'component' || type === 'components') this.showComponentDetail(id);
      });
    });
  }

  // ═══ Papers ══════════════════════════════════════════════════
  async loadPapers(page = 1) {
    const q = document.getElementById('paper-search').value;
    const dynasty = document.getElementById('paper-dynasty').value;
    const params = new URLSearchParams({ page, limit: 20 });
    if (q) params.set('q', q);
    if (dynasty) params.set('dynasty', dynasty);
    // Use search API for text search, or list API for filters
    const url = q ? API + '/search?type=papers&q=' + encodeURIComponent(q) + (dynasty ? '&dynasty=' + dynasty : '') + '&page=' + page
                   : API + '/papers?' + params.toString();
    const r = await fetch(url);
    const data = await r.json();
    const items = q ? data : data.items;
    const total = q ? items.length : data.total;
    const totalPages = q ? 1 : data.totalPages;
    document.getElementById('paper-list').innerHTML = (Array.isArray(items) ? items : []).map(p => `
      <div class="card" data-type="papers" data-id="${p.id}">
        <h3>📄 ${this.esc(p.title)}</h3>
        <div class="meta">
          <span>${this.esc(p.author || '佚名')}</span>
          ${p.dynasty ? `<span>${p.dynasty}</span>` : ''}
          ${p.building_type ? `<span>${p.building_type}</span>` : ''}
        </div>
        <div class="desc">${this.esc(p.abstract || '暂无摘要')}</div>
        ${p.file_name ? `<div class="file-tag">📎 ${p.file_name}</div>` : ''}
      </div>
    `).join('') || '<p style="grid-column:1/-1;color:var(--muted)">暂无文献</p>';
    this.renderPager('paper-pager', page, totalPages, this.loadPapers.bind(this));
    this.bindCardClicks();
  }

  async showPaperDetail(id) {
    const r = await fetch(API + '/papers/' + id);
    if (!r.ok) { alert('文献加载失败'); return; }
    const p = await r.json();
    this.openModal(`
      <span class="modal-close" onclick="app.closeModal()">&times;</span>
      <h2>📄 ${this.esc(p.title)}</h2>
      <div class="meta" style="margin:12px 0"><span>${this.esc(p.author || '佚名')}</span><span>${p.dynasty || ''}</span><span>${p.building_type || ''}</span><span>${p.building_name || ''}</span></div>
      <p style="margin:12px 0;color:var(--muted)"><strong>关键词：</strong>${this.esc(p.keywords || '无')}</p>
      <div style="background:#faf6ed;padding:16px;border-radius:8px;margin:12px 0;line-height:1.8">${this.esc(p.abstract || '暂无摘要')}</div>
      ${p.file_path ? `<a href="${p.file_path}" target="_blank" class="btn btn-primary">📥 下载文件 (${p.file_type})</a>` : '<p class="desc">无附件</p>'}
      <div style="margin-top:16px;font-size:12px;color:var(--muted)">上传时间: ${p.created_at || ''}</div>
    `);
  }

  // ═══ Components ══════════════════════════════════════════════
  async loadComponents(page = 1) {
    const q = document.getElementById('comp-search').value;
    const category = document.getElementById('comp-category').value;
    const dynasty = document.getElementById('comp-dynasty').value;
    const params = new URLSearchParams({ page, limit: 50 });
    if (category) params.set('category', category);
    if (dynasty) params.set('dynasty', dynasty);
    if (q) params.set('q', q);
    const url = q ? API + '/search?type=components&q=' + encodeURIComponent(q) + (dynasty ? '&dynasty=' + dynasty : '') + (category ? '&category=' + category : '')
                  : API + '/components?' + params.toString();
    const r = await fetch(url);
    const data = await r.json();
    const items = q ? data : data.items;
    const total = q ? (Array.isArray(items) ? items.length : 0) : data.total;
    const totalPages = q ? 1 : data.totalPages;
    document.getElementById('comp-tbody').innerHTML = (Array.isArray(items) ? items : []).map(c => `
      <tr style="cursor:pointer" onclick="app.showComponentDetail(${c.id})">
        <td><strong>${this.esc(c.name)}</strong></td>
        <td>${c.category || ''}</td>
        <td>${c.dynasty || ''}</td>
        <td>${this.esc(c.building_name || '')}</td>
        <td>${c.cai != null ? c.cai.toFixed(3) : '-'}</td>
        <td>${c.fen != null ? c.fen.toFixed(4) : '-'}</td>
        <td>${c.length != null ? c.length : '-'}</td>
        <td>${c.width != null ? c.width : '-'}</td>
        <td>${c.height != null ? c.height : '-'}</td>
        <td>${c.diameter != null ? c.diameter : '-'}</td>
        <td>${c.unit || '-'}</td>
        <td style="font-size:12px;color:var(--muted)">${this.esc(c.source || '')}</td>
      </tr>
    `).join('') || '<tr><td colspan="12" style="text-align:center;padding:20px">暂无构件数据</td></tr>';
    this.renderPager('comp-pager', page, totalPages, this.loadComponents.bind(this));
  }

  async showComponentDetail(id) {
    const r = await fetch(API + '/components/' + id);
    if (!r.ok) { alert('构件数据加载失败'); return; }
    const c = await r.json();
    this.openModal(`
      <span class="modal-close" onclick="app.closeModal()">&times;</span>
      <h2>📐 ${this.esc(c.name)}</h2>
      <div class="detail-grid" style="margin-top:16px">
        <div><strong>分类：</strong>${c.category || '-'} / ${c.sub_category || '-'}</div>
        <div><strong>朝代：</strong>${c.dynasty || '-'}</div>
        <div><strong>建筑：</strong>${this.esc(c.building_name || '-')}</div>
        <div><strong>材质：</strong>${c.material || '-'}</div>
        <div><strong>材 (cai)：</strong>${c.cai != null ? c.cai + ' 米' : '-'}</div>
        <div><strong>分 (fen)：</strong>${c.fen != null ? c.fen + ' 米' : '-'}</div>
        <div><strong>长：</strong>${c.length != null ? c.length + ' ' + (c.unit || '') : '-'}</div>
        <div><strong>宽：</strong>${c.width != null ? c.width + ' ' + (c.unit || '') : '-'}</div>
        <div><strong>高：</strong>${c.height != null ? c.height + ' ' + (c.unit || '') : '-'}</div>
        <div><strong>直径：</strong>${c.diameter != null ? c.diameter + ' ' + (c.unit || '') : '-'}</div>
        <div><strong>单位：</strong>${c.unit || '米'}</div>
        <div><strong>数据来源：</strong>${this.esc(c.source || '-')}</div>
        <div class="detail-full"><strong>描述：</strong>${this.esc(c.description || '无')}</div>
      </div>
    `);
  }

  // ═══ Models ══════════════════════════════════════════════════
  async loadModels(page = 1) {
    const q = document.getElementById('model-search').value;
    const dynasty = document.getElementById('model-dynasty').value;
    const params = new URLSearchParams({ page, limit: 20 });
    if (dynasty) params.set('dynasty', dynasty);
    const url = q ? API + '/search?type=models&q=' + encodeURIComponent(q) + (dynasty ? '&dynasty=' + dynasty : '')
                  : API + '/models?' + params.toString();
    const r = await fetch(url);
    const data = await r.json();
    const items = q ? data : data.items;
    const total = q ? (Array.isArray(items) ? items.length : 0) : data.total;
    const totalPages = q ? 1 : data.totalPages;
    document.getElementById('model-list').innerHTML = (Array.isArray(items) ? items : []).map(m => `
      <div class="card" data-type="models" data-id="${m.id}">
        <h3>🧊 ${this.esc(m.name)}</h3>
        <div class="meta">
          ${m.dynasty ? `<span>${m.dynasty}</span>` : ''}
          ${m.component_type ? `<span>${m.component_type}</span>` : ''}
          <span>${m.file_format || '未知格式'}</span>
        </div>
        <div class="desc">${this.esc(m.description || m.building_name || '')}</div>
        ${m.file_path ? `<div class="file-tag">📥 可下载</div>` : ''}
        ${m.thumbnail_path ? `<img src="${m.thumbnail_path}" style="width:100%;height:160px;object-fit:cover;border-radius:6px;margin-top:8px">` : ''}
      </div>
    `).join('') || '<p style="grid-column:1/-1;color:var(--muted)">暂无3D模型</p>';
    this.renderPager('model-pager', page, totalPages, this.loadModels.bind(this));
    this.bindCardClicks();
  }

  async showModelDetail(id) {
    const r = await fetch(API + '/models/' + id);
    if (!r.ok) { alert('模型数据加载失败'); return; }
    const m = await r.json();
    const hasViews = m.front_view || m.side_view || m.top_view || m.iso_view;
    this.openModal(`
      <span class="modal-close" onclick="app.closeModal()">&times;</span>
      <h2>🧊 ${this.esc(m.name)}</h2>
      <div class="meta" style="margin:12px 0"><span>${m.dynasty || ''}</span><span>${m.component_type || ''}</span><span>${m.file_format || ''}</span><span>${(m.file_size/1024).toFixed(1)} KB</span></div>
      <div class="viewer-container" id="model-viewer-3d"></div>
      <div class="viewer-toolbar">
        <button onclick="app.viewerActions.reset()">重置视角</button>
        <button onclick="app.viewerActions.top()">俯视图</button>
        <button onclick="app.viewerActions.front()">正视图</button>
        <button onclick="app.viewerActions.side()">侧视图</button>
      </div>
      <p style="margin:12px 0">${this.esc(m.description || '无描述')}</p>
      ${m.file_path ? `<a href="${m.file_path}" class="btn btn-primary" download>📥 下载模型文件</a>` : ''}
      ${hasViews ? `
        <h4 style="margin:20px 0 12px">📷 多视图</h4>
        <div class="views-row">
          ${m.front_view ? `<div class="view-card"><img src="${m.front_view}" alt="正视图"><div class="cap">正视图</div></div>` : ''}
          ${m.side_view ? `<div class="view-card"><img src="${m.side_view}" alt="侧视图"><div class="cap">侧视图</div></div>` : ''}
          ${m.top_view ? `<div class="view-card"><img src="${m.top_view}" alt="俯视图"><div class="cap">俯视图</div></div>` : ''}
          ${m.iso_view ? `<div class="view-card"><img src="${m.iso_view}" alt="轴测图"><div class="cap">轴测图</div></div>` : ''}
        </div>
      ` : ''}
    `);
    // Init 3D viewer after modal is rendered
    setTimeout(() => this.initModelViewer(m), 300);
  }

  initModelViewer(modelData) {
    const container = document.getElementById('model-viewer-3d');
    if (!container || this.viewer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(6, 5, 8);
    camera.lookAt(0, 1, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x404040, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(10, 20, 10);
    scene.add(dl);

    // Grid
    scene.add(new THREE.GridHelper(10, 10, 0x444466, 0x333355));

    // Model group — will be populated by loader or demo
    const group = new THREE.Group();
    scene.add(group);

    // Attempt to load the actual model file, fallback to demo geometry
    const loadModel = async () => {
      if (modelData && modelData.file_path && modelData.file_format) {
        const ext = modelData.file_format.toLowerCase();
        const url = modelData.file_path;
        try {
          if (ext === '.stl') {
            const geometry = await new Promise((resolve, reject) => {
              new STLLoader().load(url, resolve, undefined, reject);
            });
            const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.75 });
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.castShadow = true;
            group.add(mesh);
            // Fit camera to loaded model
            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3()).length();
            camera.position.set(size * 0.8, size * 0.6, size * 0.8);
            camera.lookAt(0, size * 0.2, 0);
            return;
          } else if (ext === '.obj') {
            const obj = await new Promise((resolve, reject) => {
              new OBJLoader().load(url, resolve, undefined, reject);
            });
            group.add(obj);
            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3()).length();
            camera.position.set(size * 0.8, size * 0.6, size * 0.8);
            camera.lookAt(0, size * 0.2, 0);
            return;
          }
        } catch (e) {
          console.warn('模型文件加载失败，显示预览:', e.message);
        }
      }
      // Fallback: demo Dougong geometry
      this._addDemoGeometry(group);
    };
    loadModel();

    // Controls - simple rotation
    let isDragging = false, prevX = 0, prevY = 0;
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
    canvas.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - prevX, dy = e.clientY - prevY;
      group.rotation.y += dx * 0.01;
      group.rotation.x += dy * 0.01;
      prevX = e.clientX; prevY = e.clientY;
    });
    canvas.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      camera.position.multiplyScalar(1 + e.deltaY * 0.001);
    });

    this.viewer = { scene, camera, renderer, group, canvas };

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Viewer actions
    this.viewerActions = {
      reset: () => { camera.position.set(6, 5, 8); camera.lookAt(0, 1, 0); group.rotation.set(0, 0, 0); },
      top: () => { camera.position.set(0, 8, 0.1); camera.lookAt(0, 1, 0); },
      front: () => { camera.position.set(0, 2, 8); camera.lookAt(0, 1, 0); },
      side: () => { camera.position.set(8, 2, 0); camera.lookAt(0, 1, 0); }
    };
  }

  // ═══ Images ══════════════════════════════════════════════════
  async loadImages(page = 1) {
    const q = document.getElementById('img-search').value;
    const category = document.getElementById('img-category').value;
    const params = new URLSearchParams({ page, limit: 24 });
    if (category) params.set('category', category);
    const url = q ? API + '/search?type=images&q=' + encodeURIComponent(q) + (category ? '&category=' + category : '')
                  : API + '/images?' + params.toString();
    const r = await fetch(url);
    const data = await r.json();
    const items = q ? data : data.items;
    const total = q ? (Array.isArray(items) ? items.length : 0) : data.total;
    const totalPages = q ? 1 : data.totalPages;
    document.getElementById('img-list').innerHTML = (Array.isArray(items) ? items : []).map(img => `
      <div class="card" data-type="images" data-id="${img.id}" style="padding:12px">
        <img src="${img.file_path}" alt="${this.esc(img.title)}" style="width:100%;height:200px;object-fit:cover;border-radius:6px;margin-bottom:8px" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect fill=%22%23e8dcc8%22 width=%22200%22 height=%22150%22/><text x=%22100%22 y=%2280%22 text-anchor=%22middle%22 fill=%22%23999%22>🖼️</text></svg>'">
        <h4 style="font-size:14px">${this.esc(img.title)}</h4>
        <div class="meta"><span>${img.category || ''}</span><span>${img.dynasty || ''}</span></div>
      </div>
    `).join('') || '<p style="grid-column:1/-1;color:var(--muted)">暂无图片</p>';
    this.renderPager('img-pager', page, totalPages, this.loadImages.bind(this));
    this.bindCardClicks();
  }

  async showImageModal(id) {
    const r = await fetch(API + '/images/' + id);
    if (!r.ok) { alert('图片数据加载失败'); return; }
    const img = await r.json();
    this.openModal(`
      <span class="modal-close" onclick="app.closeModal()">&times;</span>
      <h2>🖼️ ${this.esc(img.title)}</h2>
      <div class="meta" style="margin:12px 0"><span>${img.category || ''}</span><span>${img.dynasty || ''}</span><span>${img.building_name || ''}</span></div>
      <img src="${img.file_path}" alt="${this.esc(img.title)}" style="width:100%;max-height:60vh;object-fit:contain;background:#f0ebe0;border-radius:8px">
      <p style="margin-top:12px">${this.esc(img.description || '')}</p>
    `);
  }

  // ═══ Upload Forms ════════════════════════════════════════════
  showUploadForm(type) {
    const container = document.getElementById('upload-form-container');
    const forms = {
      paper: `
        <div class="form-panel">
          <h3>📄 上传文献/论文</h3>
          <form id="upload-form" enctype="multipart/form-data">
            <input type="hidden" name="type" value="paper">
            <div class="form-group"><label>标题 *</label><input name="title" required></div>
            <div class="form-row">
              <div class="form-group"><label>作者</label><input name="author"></div>
              <div class="form-group"><label>朝代</label><select name="dynasty"><option value="">选择</option><option>唐代</option><option>宋代</option><option>辽代</option><option>金代</option><option>元代</option><option>明代</option><option>清代</option></select></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>建筑类型</label><input name="building_type" placeholder="如：殿堂、塔、园林..."></div>
              <div class="form-group"><label>建筑名称</label><input name="building_name" placeholder="如：佛光寺东大殿"></div>
            </div>
            <div class="form-group"><label>关键词</label><input name="keywords" placeholder="用逗号分隔"></div>
            <div class="form-group"><label>摘要</label><textarea name="abstract"></textarea></div>
            <div class="form-group"><label>上传文件 (PDF/DOC)</label><input type="file" name="file"></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">提交</button>
              <button type="button" class="btn btn-cancel" onclick="document.getElementById('upload-form-container').innerHTML=''">取消</button>
            </div>
          </form>
        </div>`,
      component: `
        <div class="form-panel">
          <h3>📐 添加构件参数</h3>
          <form id="upload-form">
            <input type="hidden" name="type" value="component">
            <div class="form-group"><label>构件名称 *</label><input name="name" required placeholder="如：栌斗、柱、阑额..."></div>
            <div class="form-row">
              <div class="form-group"><label>分类</label><select name="category"><option value="">选择</option><option>斗拱</option><option>柱</option><option>梁枋</option><option>屋顶</option><option>台基</option></select></div>
              <div class="form-group"><label>子分类</label><input name="sub_category" placeholder="如：大斗、交互斗"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>朝代</label><select name="dynasty"><option value="">选择</option><option>唐代</option><option>宋代</option><option>辽代</option><option>金代</option><option>元代</option><option>明代</option><option>清代</option></select></div>
              <div class="form-group"><label>建筑名称</label><input name="building_name" placeholder="如：佛光寺东大殿"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>材 (cai) 米</label><input name="cai" type="number" step="0.001" placeholder="如：0.304"></div>
              <div class="form-group"><label>分 (fen) 米</label><input name="fen" type="number" step="0.0001" placeholder="cai/15"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>长</label><input name="length" type="number" step="0.01"></div>
              <div class="form-group"><label>宽</label><input name="width" type="number" step="0.01"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>高</label><input name="height" type="number" step="0.01"></div>
              <div class="form-group"><label>直径</label><input name="diameter" type="number" step="0.01"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>单位</label><select name="unit"><option value="米">米</option><option value="材">材</option><option value="分">分</option><option value="厘米">厘米</option></select></div>
              <div class="form-group"><label>材质</label><input name="material" placeholder="木材、石材..."></div>
            </div>
            <div class="form-group"><label>数据来源</label><input name="source" placeholder="如：佛光寺实测、营造法式..."></div>
            <div class="form-group"><label>描述</label><textarea name="description"></textarea></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">提交</button>
              <button type="button" class="btn btn-cancel" onclick="document.getElementById('upload-form-container').innerHTML=''">取消</button>
            </div>
          </form>
        </div>`,
      model: `
        <div class="form-panel">
          <h3>🧊 上传3D / 参数化模型</h3>
          <form id="upload-form" enctype="multipart/form-data">
            <input type="hidden" name="type" value="model">
            <div class="form-group"><label>模型名称 *</label><input name="name" required></div>
            <div class="form-row">
              <div class="form-group"><label>朝代</label><select name="dynasty"><option value="">选择</option><option>唐代</option><option>宋代</option><option>辽代</option><option>明代</option><option>清代</option></select></div>
              <div class="form-group"><label>构件类型</label><input name="component_type" placeholder="斗拱、柱、梁..."></div>
            </div>
            <div class="form-group"><label>建筑名称</label><input name="building_name"></div>
            <div class="form-group"><label>描述</label><textarea name="description"></textarea></div>
            <div class="form-group"><label>模型文件 * (STL/OBJ/3DM/GH/GHX)</label><input type="file" name="file" accept=".stl,.obj,.3dm,.gh,.ghx" required></div>
            <div class="form-group"><label>缩略图</label><input type="file" name="thumbnail" accept="image/*"></div>
            <div class="form-row">
              <div class="form-group"><label>正视图</label><input type="file" name="front_view" accept="image/*"></div>
              <div class="form-group"><label>侧视图</label><input type="file" name="side_view" accept="image/*"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>俯视图</label><input type="file" name="top_view" accept="image/*"></div>
              <div class="form-group"><label>轴测图</label><input type="file" name="iso_view" accept="image/*"></div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">提交</button>
              <button type="button" class="btn btn-cancel" onclick="document.getElementById('upload-form-container').innerHTML=''">取消</button>
            </div>
          </form>
        </div>`,
      image: `
        <div class="form-panel">
          <h3>🖼️ 上传图片/照片</h3>
          <form id="upload-form" enctype="multipart/form-data">
            <input type="hidden" name="type" value="image">
            <div class="form-group"><label>标题 *</label><input name="title" required></div>
            <div class="form-row">
              <div class="form-group"><label>分类</label><select name="category"><option value="">选择</option><option>照片</option><option>图纸</option><option>拓片</option><option>测绘图</option></select></div>
              <div class="form-group"><label>朝代</label><select name="dynasty"><option value="">选择</option><option>唐代</option><option>宋代</option><option>辽代</option><option>明代</option><option>清代</option></select></div>
            </div>
            <div class="form-group"><label>建筑名称</label><input name="building_name"></div>
            <div class="form-group"><label>描述</label><textarea name="description"></textarea></div>
            <div class="form-group"><label>图片文件 *</label><input type="file" name="file" accept="image/*" required></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">提交</button>
              <button type="button" class="btn btn-cancel" onclick="document.getElementById('upload-form-container').innerHTML=''">取消</button>
            </div>
          </form>
        </div>`
    };
    container.innerHTML = forms[type] || '';
    const form = document.getElementById('upload-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleUpload(e));
    }
    container.scrollIntoView({ behavior: 'smooth' });
  }

  async handleUpload(e) {
    e.preventDefault();
    const form = e.target;
    const type = form.querySelector('[name=type]')?.value || 'paper';
    const formData = new FormData(form);
    formData.delete('type');

    const endpoints = {
      paper: '/api/papers',
      component: '/api/components',
      model: '/api/models',
      image: '/api/images'
    };
    const isJson = type === 'component';
    const url = endpoints[type];

    try {
      let r;
      if (isJson) {
        const obj = {};
        formData.forEach((v, k) => { obj[k] = v; });
        r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
      } else {
        r = await fetch(url, { method: 'POST', body: formData });
      }
      const result = await r.json();
      if (r.ok) {
        alert(result.message || '提交成功！');
        document.getElementById('upload-form-container').innerHTML = '';
        this.loadHome();
      } else {
        alert('提交失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      alert('网络错误: ' + err.message);
    }
  }

  // ═══ Pagination ══════════════════════════════════════════════
  renderPager(containerId, page, totalPages, loadFn) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }
    let html = '';
    html += `<button ${page === 1 ? 'disabled' : ''} onclick="app.goPage(${page - 1}, '${containerId}', arguments[0])">&laquo; 上一页</button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
        html += `<button class="${i === page ? 'active' : ''}" onclick="app.goPage(${i}, '${containerId}', arguments[0])">${i}</button>`;
      } else if (i === page - 3 || i === page + 3) {
        html += `<button disabled>…</button>`;
      }
    }
    html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="app.goPage(${page + 1}, '${containerId}', arguments[0])">下一页 &raquo;</button>`;
    container.innerHTML = html;
    // Store loadFn reference
    container._loadFn = loadFn;
  }

  goPage(page, containerId, evt) {
    const container = document.getElementById(containerId);
    if (container && container._loadFn) {
      container._loadFn(page);
    }
  }

  // ═══ Modal ══════════════════════════════════════════════════
  openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('show');
  }

  closeModal() {
    // Cleanup viewer if exists
    if (this.viewer) {
      this.viewer.renderer.dispose();
      this.viewer = null;
      const container = document.getElementById('model-viewer-3d');
      if (container) container.innerHTML = '';
    }
    document.getElementById('modal-overlay').classList.remove('show');
  }

  // ═══ Demo Geometry ════════════════════════════════════════════
  _addDemoGeometry(group) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.75 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 2), woodMat);
    base.position.y = 0.4;
    group.add(base);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.7 }));
    mid.position.y = 1.1;
    group.add(mid);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0x6B3A2A, roughness: 0.65 }));
    arm.position.y = 1.7;
    group.add(arm);
    const arm2 = arm.clone();
    arm2.rotation.y = Math.PI / 2;
    arm2.position.y = 1.7;
    group.add(arm2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.6 }));
    top.position.y = 2.2;
    group.add(top);
  }

  // ═══ Utility ════════════════════════════════════════════════
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Bootstrap
const app = new App();
window.app = app;
