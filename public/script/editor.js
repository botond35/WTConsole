import { db } from "../script/firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

/* ── Templates — each has its OWN block order (layout), so every ─────
   business type produces a genuinely different page, not a re-skin. ── */
const TEMPLATES = [
  { id:'clinic', name:'Klinika', icon:'stethoscope', color:'#2F6FE4', bg:'#EAF3FF', hasTeam:true,
    layout:['team','services','about','gallery','contact'],
    services:['Általános vizsgálat','Oltás','Sürgősségi ellátás'] },
  { id:'walker', name:'Sétáltató', icon:'pets', color:'#2F9E52', bg:'#EAF7EE', hasTeam:false,
    layout:['services','gallery','about','contact'],
    services:['Napi séta','Csoportos séta','Hétvégi felügyelet'] },
  { id:'groomer', name:'Szépségszalon', icon:'content_cut', color:'#D8493D', bg:'#FFF1F0', hasTeam:false,
    layout:['gallery','services','about','contact'],
    services:['Fürdetés','Szőrvágás','Teljes kozmetika'] },
  { id:'trainer', name:'Kiképző', icon:'sports', color:'#C98A12', bg:'#FFF7E6', hasTeam:false,
    layout:['services','about','gallery','contact'],
    services:['Alapengedelmesség','Kölyökkiképzés','Viselkedésterápia'] },
  { id:'boarding', name:'Panzió', icon:'cottage', color:'#7C5CFC', bg:'#F3EEFF', hasTeam:false,
    layout:['gallery','about','services','contact'],
    services:['Éjszakai szállás','Hétvégi csomag','Hosszabb tartózkodás'] },
  { id:'photographer', name:'Fotós', icon:'photo_camera', color:'#D6499E', bg:'#FDF0F8', hasTeam:false,
    layout:['gallery','services','about','contact'],
    services:['Stúdiós fotózás','Kültéri fotózás','Digitális csomag'] },
  { id:'shop', name:'Bolt', icon:'storefront', color:'#10A398', bg:'#EFFCFB', hasTeam:false,
    layout:['services','gallery','about','contact'],
    services:['Táplálás','Felszerelés','Ápolás'] },
];

const BLOCK_META = {
  hero:     { label:'Fejléc',       icon:'view_agenda' },
  team:     { label:'Csapatunk',    icon:'groups' },
  about:    { label:'Bemutatkozás', icon:'info' },
  services: { label:'Szolgáltatások', icon:'view_module' },
  gallery:  { label:'Galéria',      icon:'grid_view' },
  contact:  { label:'Elérhetőség',  icon:'contact_page' },
  footer:   { label:'Lábléc',       icon:'space_bar' },
};

/* ── Category → icon + color, IDENTICAL to the Plans admin page and
   the public booking page — a service should look the same everywhere. ── */
const CATEGORY_META = {
  checkup:  { label:"Health",      icon:"medical_services", color:"#2F6FE4", bg:"#EAF3FF" },
  vaccine:  { label:"Vaccination", icon:"vaccines",         color:"#2F9E52", bg:"#EAF7EE" },
  dental:   { label:"Dental",      icon:"dental_services",  color:"#D6499E", bg:"#FDF0F8" },
  grooming: { label:"Grooming",    icon:"content_cut",      color:"#D8493D", bg:"#FFF1F0" },
  walking:  { label:"Walking",     icon:"directions_walk",  color:"#10A398", bg:"#EFFCFB" },
  training: { label:"Training",    icon:"school",           color:"#C98A12", bg:"#FFF7E6" },
  surgery:  { label:"Surgery",     icon:"local_hospital",   color:"#7C5CFC", bg:"#F3EEFF" },
  other:    { label:"Other",       icon:"list_alt",         color:"#6B7280", bg:"#F3F4F6" },
};
function categoryMeta(c){ return CATEGORY_META[c] || CATEGORY_META.other; }

const STORAGE_CONTENT = 'wt_site_content';
const STORAGE_TEMPLATE = 'wt_template';

function loadTemplate(){
  try{
    const raw = localStorage.getItem(STORAGE_TEMPLATE);
    if(raw){
      const parsed = JSON.parse(raw);
      const match = TEMPLATES.find(t=>t.id===parsed.id);
      if(match) return match;
    }
  }catch(e){}
  return TEMPLATES[1]; // walker default
}

function defaultContent(t){
  const c = {
    templateId: t.id,
    accent: t.color,
    font: 'sans',
    textStyles: {},
    bookingUrl: 'booking.html',
    hero: {
      eyebrow: t.name,
      title: `Üdvözlünk — ${t.name} szolgáltatás`,
      subtitle: 'Rövid, barátságos leírás arról, mit kínálsz és kiknek szól.',
      cta: 'Foglalj időpontot',
      image: ''
    },
    about: { eyebrow:'Rólunk', title:'Bemutatkozás', text:'Mesélj pár mondatban a vállalkozásodról, a tapasztalatodról és arról, miért érdemes nálad foglalni.' },
    services: {
      eyebrow:'Kínálat', title:'Szolgáltatások', real:false,
      items: t.services.map(name=>({name, desc:'Rövid leírás a szolgáltatásról.', price:'—'}))
    },
    gallery: { eyebrow:'Galéria', title:'Néhány pillanat', images:['', '', '', ''] },
    contact: { eyebrow:'Elérhetőség', title:'Vegyük fel a kapcsolatot', phone:'+36 20 000 0000', email:'info@vallalkozas.hu', address:'Budapest, Fő utca 1.' },
    footer: { left:'© 2026 Vállalkozás', right:'Készítve a WT Console-lal' }
  };
  if(t.hasTeam){
    c.team = {
      eyebrow: 'Csapatunk',
      title: 'A legjobb állatorvosaink',
      members: [
        { name:'Dr. Kovács Anna', role:'Belgyógyász szakállatorvos', bio:'12 év tapasztalat kis- és nagytestű kutyák, macskák ellátásában.', image:'' },
        { name:'Dr. Nagy Péter', role:'Sebész szakállatorvos', bio:'Lágyrész- és ortopéd sebészet, sürgősségi ellátás.', image:'' },
        { name:'Dr. Szabó Eszter', role:'Belgyógyász és bőrgyógyász', bio:'Allergológia és krónikus betegségek kezelése.', image:'' },
      ]
    };
  }
  return c;
}

function loadContent(template){
  try{
    const raw = localStorage.getItem(STORAGE_CONTENT);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed.templateId === template.id) return parsed;
    }
  }catch(e){}
  return defaultContent(template);
}

function getPath(obj, path){
  return path.split('.').reduce((o,k)=> (o||{})[k], obj);
}
function setPath(obj, path, val){
  const keys = path.split('.');
  let o = obj;
  for(let i=0;i<keys.length-1;i++) o = o[keys[i]];
  o[keys[keys.length-1]] = val;
}
function esc(s){ return (s ?? '').toString().replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

let template = loadTemplate();
let content = loadContent(template);
content.font = content.font || 'sans';
content.textStyles = content.textStyles || {};
let currentImgTarget = null;
let saveTimer = null;
let activeTextEl = null;

const swatchPalette = ['#2F6FE4','#2F9E52','#D8493D','#C98A12','#7C5CFC','#D6499E','#10A398','#2F2F2F'];

/* ── Fonts ─────────────────────────────────────────────────────────
   One global site font (rail) plus an optional per-text override,
   set from the floating toolbar that appears while editing a field. */
const FONT_OPTIONS = [
  { id:'sans',    label:'DM Sans (alap)',   family:"'DM Sans', sans-serif" },
  { id:'grotesk', label:'Space Grotesk',    family:"'Space Grotesk', sans-serif" },
  { id:'poppins', label:'Poppins',          family:"'Poppins', sans-serif" },
  { id:'serif',   label:'Playfair Display', family:"'Playfair Display', serif" },
  { id:'mono',    label:'DM Mono',          family:"'DM Mono', monospace" },
];
function fontFamilyById(id){
  const f = FONT_OPTIONS.find(x=>x.id===id);
  return f ? f.family : FONT_OPTIONS[0].family;
}
const TEXT_COLORS = ['#1a1a18','#5b5b56','#2F6FE4','#2F9E52','#D8493D','#C98A12','#7C5CFC','#D6499E','#ffffff'];

/* ── uid resolution ───────────────────────────────────────────────
   The signed-in Firebase Auth user IS the business — that's the same
   uid every plan/booking/client doc is already keyed on (userId).
   Ask Auth directly first (most reliable), then fall back to the
   "dataReady" convention used by bookings-admin.js/plans.js, then to
   a ?uid= query param for standalone preview links. */
function resolveUid(){
  return new Promise(resolve=>{
    const params = new URLSearchParams(window.location.search);
    const paramUid = params.get('uid');
    let done = false;
    const finish = (uid)=>{ if(done) return; done = true; resolve(uid); };

    if(window.WT?.data?.uid){ finish(window.WT.data.uid); return; }

    try{
      const auth = getAuth();
      if(auth.currentUser){ finish(auth.currentUser.uid); return; }
      const unsubscribe = onAuthStateChanged(auth, (user)=>{
        unsubscribe();
        finish(user ? user.uid : (paramUid || null));
      });
    }catch(e){
      console.warn('Firebase Auth nem érhető el ezen az oldalon:', e);
    }

    document.addEventListener('dataReady', (e)=> finish(e.detail?.uid || paramUid || null), { once:true });

    // Safety net in case auth/dataReady never resolve (e.g. logged out, standalone preview)
    setTimeout(()=> finish(paramUid || null), 2000);
  });
}

async function loadRealPlans(uid){
  if(!uid) return [];
  try{
    const snap = await getDocs(query(collection(db,'plans'), where('userId','==',uid)));
    return snap.docs.map(d=>({ id:d.id, ...d.data() }));
  }catch(e){
    console.warn('Nem sikerült betölteni a szolgáltatásokat:', e);
    return [];
  }
}

/* ── Block HTML builders ──────────────────────────────────────────── */
function renderHeroHTML(){
  return `
    <section class="hero" id="block-hero">
      <p class="hero-eyebrow editable" contenteditable="true" data-key="hero.eyebrow"></p>
      <h1 class="hero-title editable" contenteditable="true" data-key="hero.title"></h1>
      <p class="hero-subtitle editable" contenteditable="true" data-key="hero.subtitle"></p>
      <div class="cta-row">
        <span class="hero-cta editable" contenteditable="true" data-key="hero.cta"></span>
        <a class="hero-book-link" id="heroBookLink" href="#" target="_blank" rel="noopener">
          <span class="material-symbols-rounded" style="font-size:16px;">calendar_month</span>
          Foglalási oldal megnyitása
        </a>
      </div>
    </section>
    <div class="img-block hero-img" data-imgkey="hero.image">
      <img src="" alt="Borítókép" data-imgtarget>
      <div class="img-hover"><span class="material-symbols-rounded">add_photo_alternate</span>Kép cseréje</div>
    </div>`;
}

function renderTeamHTML(){
  return `
    <section class="section team-section" id="block-team">
      <div class="section-head-row">
        <div>
          <p class="section-eyebrow editable" contenteditable="true" data-key="team.eyebrow"></p>
          <h2 class="section-title editable" contenteditable="true" data-key="team.title"></h2>
        </div>
        <button class="add-member-btn" id="addTeamMemberBtn" type="button">
          <span class="material-symbols-rounded" style="font-size:16px;">add</span>Új tag
        </button>
      </div>
      <div class="team-grid" id="teamGrid"></div>
    </section>`;
}

function renderAboutHTML(){
  return `
    <section class="section" id="block-about">
      <p class="section-eyebrow editable" contenteditable="true" data-key="about.eyebrow"></p>
      <h2 class="section-title editable" contenteditable="true" data-key="about.title"></h2>
      <p class="section-text editable" contenteditable="true" data-key="about.text"></p>
    </section>`;
}

function renderServicesHTML(){
  return `
    <section class="section" id="block-services">
      <p class="section-eyebrow editable" contenteditable="true" data-key="services.eyebrow"></p>
      <h2 class="section-title editable" contenteditable="true" data-key="services.title"></h2>
      <p class="manage-note" id="servicesManageNote" style="display:none;">
        <span class="material-symbols-rounded" style="font-size:14px;">sync</span>
        Élő adat a Szolgáltatások (Plans) oldalról — a szerkesztéshez oda navigálj.
      </p>
      <div class="grid3" id="servicesGrid"></div>
    </section>`;
}

function renderGalleryHTML(){
  return `
    <section class="section" id="block-gallery">
      <p class="section-eyebrow editable" contenteditable="true" data-key="gallery.eyebrow"></p>
      <h2 class="section-title editable" contenteditable="true" data-key="gallery.title"></h2>
      <div class="gallery-grid" id="galleryGrid"></div>
    </section>`;
}

function renderContactHTML(){
  return `
    <section class="section" id="block-contact">
      <p class="section-eyebrow editable" contenteditable="true" data-key="contact.eyebrow"></p>
      <h2 class="section-title editable" contenteditable="true" data-key="contact.title"></h2>
      <div class="contact-row">
        <div class="contact-item"><span class="material-symbols-rounded">call</span><span class="editable" contenteditable="true" data-key="contact.phone"></span></div>
        <div class="contact-item"><span class="material-symbols-rounded">mail</span><span class="editable" contenteditable="true" data-key="contact.email"></span></div>
        <div class="contact-item"><span class="material-symbols-rounded">location_on</span><span class="editable" contenteditable="true" data-key="contact.address"></span></div>
      </div>
    </section>`;
}

function renderFooterHTML(){
  return `
    <footer class="footer" id="block-footer">
      <span class="editable" contenteditable="true" data-key="footer.left"></span>
      <span class="editable" contenteditable="true" data-key="footer.right"></span>
    </footer>`;
}

const BLOCK_RENDERERS = {
  team: renderTeamHTML, about: renderAboutHTML, services: renderServicesHTML,
  gallery: renderGalleryHTML, contact: renderContactHTML,
};

function currentLayout(){
  // hero first, footer last, always; the middle order is what makes each template distinct
  const middle = template.layout.filter(id => id !== 'team' || template.hasTeam);
  return ['hero', ...middle, 'footer'];
}

function renderSite(){
  const parts = [renderHeroHTML()];
  template.layout.forEach(id=>{
    if(id === 'team' && !template.hasTeam) return;
    const fn = BLOCK_RENDERERS[id];
    if(fn) parts.push(fn());
  });
  parts.push(renderFooterHTML());
  document.getElementById('site').innerHTML = parts.join('');
}

function renderTopMeta(){
  document.getElementById('topName').textContent = template.name + ' — weboldal';
  document.getElementById('topSub').textContent = 'Szerkesztés élőben, mint egy Notion oldal';
  document.getElementById('templateName').textContent = template.name;
  const chip = document.getElementById('templateIcon');
  chip.style.background = template.bg;
  chip.style.color = template.color;
  chip.innerHTML = `<span class="material-symbols-rounded">${template.icon}</span>`;
}

function renderBlockList(){
  const wrap = document.getElementById('blockList');
  wrap.innerHTML = '';
  currentLayout().forEach(id=>{
    const meta = BLOCK_META[id];
    if(!meta) return;
    const el = document.createElement('div');
    el.className = 'block-item';
    el.innerHTML = `<span class="material-symbols-rounded">${meta.icon}</span>${meta.label}`;
    el.addEventListener('click', ()=>{
      document.getElementById('block-'+id)?.scrollIntoView({behavior:'smooth', block:'start'});
    });
    wrap.appendChild(el);
  });
}

function renderSwatches(){
  const wrap = document.getElementById('swatchRow');
  wrap.innerHTML = '';
  swatchPalette.forEach(c=>{
    const s = document.createElement('div');
    s.className = 'swatch' + (c.toLowerCase()===content.accent.toLowerCase() ? ' active' : '');
    s.style.background = c;
    s.addEventListener('click', ()=> setAccent(c));
    wrap.appendChild(s);
  });
  const custom = document.createElement('div');
  custom.className = 'swatch swatch-custom';
  custom.innerHTML = `<span class="material-symbols-rounded">colorize</span><input type="color" id="customColor" value="${content.accent}">`;
  wrap.appendChild(custom);
  document.getElementById('customColor').addEventListener('input', e=> setAccent(e.target.value));
}

function setAccent(color){
  content.accent = color;
  applyAccent();
  renderSwatches();
  scheduleSave();
}
function applyAccent(){
  const site = document.getElementById('site');
  site.style.setProperty('--site-accent', content.accent);
  site.style.setProperty('--site-accent-soft', content.accent + '14');
}

function renderFontList(){
  const wrap = document.getElementById('fontList');
  wrap.innerHTML = '';
  FONT_OPTIONS.forEach(f=>{
    const row = document.createElement('div');
    row.className = 'font-option' + (content.font === f.id ? ' active' : '');
    row.style.fontFamily = f.family;
    row.innerHTML = `<span>${f.label}</span><span class="material-symbols-rounded">check</span>`;
    row.addEventListener('click', ()=>{
      content.font = f.id;
      applyFont();
      renderFontList();
      scheduleSave();
    });
    wrap.appendChild(row);
  });
}
function applyFont(){
  document.getElementById('site').style.setProperty('--site-font', fontFamilyById(content.font));
}

/* ── Per-text font & color overrides ──────────────────────────────
   Each editable field maps to a stable key so its override survives
   re-renders and reloads: fixed fields use data-key, repeatable ones
   (services / team members) use their index + field name. */
function styleKeyFor(el){
  if(el.dataset.key) return 'key:' + el.dataset.key;
  if(el.dataset.svc !== undefined) return `svc:${el.dataset.svc}:${el.dataset.field}`;
  if(el.dataset.team !== undefined) return `team:${el.dataset.team}:${el.dataset.field}`;
  return null;
}
function applyTextStyles(){
  document.querySelectorAll('.editable').forEach(el=>{
    const key = styleKeyFor(el);
    const saved = key ? content.textStyles[key] : null;
    if(saved?.font){ el.style.fontFamily = fontFamilyById(saved.font); el.dataset.fontId = saved.font; }
    else { el.style.fontFamily = ''; delete el.dataset.fontId; }
    el.style.color = saved?.color || '';
  });
}
function setElementFont(el, fontId){
  const key = styleKeyFor(el);
  if(!key) return;
  content.textStyles[key] = content.textStyles[key] || {};
  if(fontId){
    content.textStyles[key].font = fontId;
    el.style.fontFamily = fontFamilyById(fontId);
    el.dataset.fontId = fontId;
  } else {
    delete content.textStyles[key].font;
    el.style.fontFamily = '';
    delete el.dataset.fontId;
  }
  if(!Object.keys(content.textStyles[key]).length) delete content.textStyles[key];
  scheduleSave();
}
function setElementColor(el, color){
  const key = styleKeyFor(el);
  if(!key) return;
  content.textStyles[key] = content.textStyles[key] || {};
  content.textStyles[key].color = color;
  el.style.color = color;
  scheduleSave();
  syncToolbarState(el);
}
function resetElementStyle(el){
  const key = styleKeyFor(el);
  if(key) delete content.textStyles[key];
  el.style.fontFamily = '';
  el.style.color = '';
  delete el.dataset.fontId;
  scheduleSave();
  syncToolbarState(el);
}

/* ── Floating toolbar (font + color for the field currently being edited) ── */
function buildToolbar(){
  const select = document.getElementById('ttFontSelect');
  select.innerHTML = `<option value="">Alapértelmezett betűtípus</option>` +
    FONT_OPTIONS.map(f=>`<option value="${f.id}">${f.label}</option>`).join('');
  select.addEventListener('mousedown', e=> e.stopPropagation());
  select.addEventListener('change', ()=>{
    if(activeTextEl) setElementFont(activeTextEl, select.value);
  });

  const colorsWrap = document.getElementById('ttColors');
  colorsWrap.innerHTML = '';
  TEXT_COLORS.forEach(c=>{
    const dot = document.createElement('div');
    dot.className = 'tt-color';
    dot.style.background = c;
    dot.dataset.color = c;
    dot.addEventListener('mousedown', e=> e.preventDefault());
    dot.addEventListener('click', ()=>{
      if(activeTextEl) setElementColor(activeTextEl, c);
    });
    colorsWrap.appendChild(dot);
  });

  const resetBtn = document.getElementById('ttReset');
  resetBtn.addEventListener('mousedown', e=> e.preventDefault());
  resetBtn.addEventListener('click', ()=>{
    if(activeTextEl) resetElementStyle(activeTextEl);
  });
}
function syncToolbarState(el){
  document.getElementById('ttFontSelect').value = el.dataset.fontId || '';
  const key = styleKeyFor(el);
  const activeColor = (key && content.textStyles[key]?.color) || '';
  document.querySelectorAll('.tt-color').forEach(dot=>{
    dot.classList.toggle('active', !!activeColor && dot.dataset.color.toLowerCase() === activeColor.toLowerCase());
  });
}
function positionToolbar(el){
  const toolbar = document.getElementById('textToolbar');
  const r = el.getBoundingClientRect();
  const tw = toolbar.offsetWidth || 240;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = r.top - 46;
  if(top < 8) top = r.bottom + 8;
  toolbar.style.left = left + 'px';
  toolbar.style.top = top + 'px';
}
function showToolbar(el){
  activeTextEl = el;
  positionToolbar(el);
  document.getElementById('textToolbar').classList.add('show');
  syncToolbarState(el);
}
function hideToolbar(){
  activeTextEl = null;
  document.getElementById('textToolbar').classList.remove('show');
}

function fillEditableFields(){
  document.querySelectorAll('.editable[data-key]').forEach(el=>{
    const val = getPath(content, el.dataset.key);
    if(val !== undefined) el.textContent = val;
    el.addEventListener('input', ()=>{
      setPath(content, el.dataset.key, el.textContent);
      scheduleSave();
    });
  });
}

function applyBookingLink(){
  const link = document.getElementById('heroBookLink');
  if(link) link.href = content.bookingUrl;
  document.querySelectorAll('.svc-book-btn').forEach(a => a.href = content.bookingUrl);
}

function renderServices(){
  const grid = document.getElementById('servicesGrid');
  if(!grid) return;
  const note = document.getElementById('servicesManageNote');
  if(note) note.style.display = content.services.real ? 'flex' : 'none';

  grid.innerHTML = '';
  content.services.items.forEach((svc, i)=>{
    const editable = !content.services.real;
    const meta = categoryMeta(svc.category);
    const card = document.createElement('div');
    card.className = 'svc-card';
    card.innerHTML = `
      <div class="svc-icon" style="background:${meta.bg};color:${meta.color};"><span class="material-symbols-rounded">${meta.icon}</span></div>
      <div class="svc-name ${editable?'editable':''}" ${editable?'contenteditable="true"':''} data-svc="${i}" data-field="name">${esc(svc.name)}</div>
      <p class="svc-desc ${!editable?'svc-desc-clamp':''} ${editable?'editable':''}" ${editable?'contenteditable="true"':''} data-svc="${i}" data-field="desc">${esc(svc.desc||'')}</p>
      ${(!editable && svc.desc) ? `<button class="svc-info-btn" type="button" data-svc-info="${i}">
        <span class="material-symbols-rounded">info</span>Teljes leírás
      </button>` : ''}
      <div class="svc-price ${editable?'editable':''}" ${editable?'contenteditable="true"':''} data-svc="${i}" data-field="price">${esc(svc.price||'')}</div>
      <a class="svc-book-btn" href="${content.bookingUrl}" target="_blank" rel="noopener">
        <span class="material-symbols-rounded" style="font-size:15px;">event_available</span>Foglalás
      </a>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('[data-svc]').forEach(el=>{
    if(!el.isContentEditable) return;
    el.addEventListener('input', ()=>{
      content.services.items[el.dataset.svc][el.dataset.field] = el.textContent;
      scheduleSave();
    });
  });
  grid.querySelectorAll('[data-svc-info]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const svc = content.services.items[btn.dataset.svcInfo];
      if(svc) toggleServiceDescPopover(btn, svc);
    });
  });
  applyTextStyles();
}

/* ── Full-description popover for service cards — same pattern as
   the Plans admin page and the public booking page. ── */
function toggleServiceDescPopover(anchorEl, svc){
  const pop = document.getElementById('editorDescPopover');
  if(!pop) return;
  if(pop.classList.contains('show') && pop.dataset.for === anchorEl.dataset.svcInfo){
    hideServiceDescPopover();
    return;
  }
  document.getElementById('editorDescPopoverTitle').textContent = svc.name || '';
  document.getElementById('editorDescPopoverText').textContent = svc.desc || '';
  pop.dataset.for = anchorEl.dataset.svcInfo;
  pop.classList.add('show');
  positionServiceDescPopover(anchorEl);
}
function positionServiceDescPopover(anchorEl){
  const pop = document.getElementById('editorDescPopover');
  const r = anchorEl.getBoundingClientRect();
  const pw = pop.offsetWidth || 260;
  let left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
  let top = r.bottom + 8;
  if(top + 90 > window.innerHeight) top = r.top - pop.offsetHeight - 8;
  pop.style.left = left + 'px';
  pop.style.top = Math.max(8, top) + 'px';
}
function hideServiceDescPopover(){
  const pop = document.getElementById('editorDescPopover');
  if(!pop) return;
  pop.classList.remove('show');
  delete pop.dataset.for;
}
document.addEventListener('click', (e)=>{
  const pop = document.getElementById('editorDescPopover');
  if(!pop || !pop.classList.contains('show')) return;
  if(pop.contains(e.target)) return;
  hideServiceDescPopover();
});
window.addEventListener('resize', hideServiceDescPopover);
document.querySelector('.canvas-area')?.addEventListener('scroll', hideServiceDescPopover);

function renderGallery(){
  const grid = document.getElementById('galleryGrid');
  if(!grid) return;
  grid.innerHTML = '';
  content.gallery.images.forEach((src, i)=>{
    const box = document.createElement('div');
    box.className = 'img-block';
    box.dataset.imgkey = `gallery.images.${i}`;
    box.innerHTML = `
      <img src="${src}" alt="Galéria kép ${i+1}" ${src?'':'style="display:none;"'}>
      <div class="img-hover"><span class="material-symbols-rounded">add_photo_alternate</span>Kép cseréje</div>
    `;
    grid.appendChild(box);
  });
  attachImageHandlers();
}

function renderTeam(){
  if(!template.hasTeam) return;
  const grid = document.getElementById('teamGrid');
  if(!grid) return;
  grid.innerHTML = '';
  content.team.members.forEach((m,i)=>{
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="img-block team-photo" data-imgkey="team.members.${i}.image">
        <img src="${m.image||''}" alt="${esc(m.name)}" ${m.image?'':'style="display:none;"'}>
        <div class="img-hover"><span class="material-symbols-rounded">add_photo_alternate</span>Fotó</div>
      </div>
      <div class="team-name editable" contenteditable="true" data-team="${i}" data-field="name">${esc(m.name)}</div>
      <div class="team-role editable" contenteditable="true" data-team="${i}" data-field="role">${esc(m.role)}</div>
      <div class="team-bio editable" contenteditable="true" data-team="${i}" data-field="bio">${esc(m.bio)}</div>
      <button class="team-remove-btn" type="button" data-remove-team="${i}" title="Tag eltávolítása">
        <span class="material-symbols-rounded" style="font-size:15px;">close</span>
      </button>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('[data-team]').forEach(el=>{
    el.addEventListener('input', ()=>{
      content.team.members[el.dataset.team][el.dataset.field] = el.textContent;
      scheduleSave();
    });
  });
  grid.querySelectorAll('[data-remove-team]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      content.team.members.splice(parseInt(btn.dataset.removeTeam,10), 1);
      renderTeam();
      scheduleSave();
    });
  });
  attachImageHandlers();
  applyTextStyles();
}

function attachImageHandlers(){
  document.querySelectorAll('.img-block').forEach(box=>{
    box.onclick = ()=> openImageModal(box);
  });
  const heroBox = document.querySelector('[data-imgkey="hero.image"]');
  if(heroBox){
    const heroImg = heroBox.querySelector('img');
    if(content.hero.image){ heroImg.src = content.hero.image; heroImg.style.display='block'; }
    else { heroImg.style.display='none'; heroBox.style.background = 'linear-gradient(135deg,#f3f3f1,#e7e7e3)'; }
  }
}

function openImageModal(box){
  currentImgTarget = box;
  document.getElementById('imgUrlInput').value = '';
  document.getElementById('imgModal').classList.remove('hidden');
}

function applyImageToTarget(box, dataUrl){
  const key = box.dataset.imgkey;
  setPath(content, key, dataUrl);
  const img = box.querySelector('img');
  img.src = dataUrl;
  img.style.display = 'block';
  box.style.background = 'transparent';
  scheduleSave();
}

document.getElementById('imgCancel').onclick = ()=> document.getElementById('imgModal').classList.add('hidden');
document.getElementById('imgApply').onclick = ()=>{
  const url = document.getElementById('imgUrlInput').value.trim();
  if(url && currentImgTarget){ applyImageToTarget(currentImgTarget, url); }
  document.getElementById('imgModal').classList.add('hidden');
};
document.getElementById('imgFileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file || !currentImgTarget) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    applyImageToTarget(currentImgTarget, reader.result);
    document.getElementById('imgModal').classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

/* ── Floating toolbar activation ──────────────────────── */
document.addEventListener('focusin', (e)=>{
  if(e.target.classList?.contains('editable')) showToolbar(e.target);
});
document.addEventListener('focusout', (e)=>{
  if(!e.target.classList?.contains('editable')) return;
  const toolbar = document.getElementById('textToolbar');
  const next = e.relatedTarget;
  if(next && toolbar.contains(next)) return;
  requestAnimationFrame(()=>{
    const active = document.activeElement;
    if(active && toolbar.contains(active)) return;
    if(active && active.classList?.contains('editable')) return;
    hideToolbar();
  });
});
document.querySelector('.canvas-area').addEventListener('scroll', ()=>{
  if(activeTextEl) positionToolbar(activeTextEl);
});
/* Phone / tablet frames scroll their own content */
document.getElementById('site').addEventListener('scroll', ()=>{
  if(activeTextEl) positionToolbar(activeTextEl);
});
window.addEventListener('resize', ()=>{
  if(activeTextEl) positionToolbar(activeTextEl);
});

/* ── Device switch ───────────────────────────────────── */
document.querySelectorAll('.device-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.device-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const frame = document.getElementById('deviceFrame');
    frame.classList.remove('tablet','mobile');
    const d = btn.dataset.device;
    if(d==='tablet') frame.classList.add('tablet');
    if(d==='mobile') frame.classList.add('mobile');
  });
});

/* ── Save / toast ────────────────────────────────────── */
function scheduleSave(){
  document.getElementById('saveState').textContent = 'Mentés…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{ localStorage.setItem(STORAGE_CONTENT, JSON.stringify(content)); }catch(e){}
    document.getElementById('saveState').textContent = 'Minden változás mentve';
  }, 500);
}
function showToast(text){
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = text;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 1800);
}

/* ── Kapcsolat a Beállítások cím-generátorával ────────── */
function renderDomainChip(){
  const chip = document.getElementById('wtDomainChip');
  const txt  = document.getElementById('wtDomainChipText');
  if(!chip || !txt) return;
  const d = window.WTDomain?.get();
  if(d){
    txt.textContent = d.url;
    chip.classList.remove('unclaimed');
    chip.title = d.published
      ? 'Élő cím – kattints a Beállításokhoz'
      : 'Igényelt cím – tedd közzé az oldalt';
  }else{
    txt.textContent = 'Cím igénylése…';
    chip.classList.add('unclaimed');
    chip.title = 'Még nincs címed – igényelj egyet a Beállításokban';
  }
}
renderDomainChip();
document.addEventListener('wt:domainchange', renderDomainChip);
window.addEventListener('storage', e=>{ if(e.key === 'wt_page_domain') renderDomainChip(); });

document.getElementById('publishBtn').addEventListener('click', ()=>{
  try{ localStorage.setItem(STORAGE_CONTENT, JSON.stringify(content)); }catch(e){}
  const d = window.WTDomain?.get();
  if(!d){
    showToast('Előbb igényelj címet a Beállításokban');
    setTimeout(()=>{ window.location.href = 'settings.html#domain'; }, 1200);
    return;
  }
  window.WTDomain.setPublished(true);
  renderDomainChip();
  showToast('Közzétéve: ' + d.url);
});
document.getElementById('previewBtn').addEventListener('click', ()=>{
  window.open(content.bookingUrl, '_blank', 'noopener');
});
document.getElementById('backBtn').addEventListener('click', ()=>{
  window.history.length > 1 ? window.history.back() : (window.location.href = 'creat.html');
});
document.getElementById('templateMini').addEventListener('click', ()=>{
  window.location.href = 'creat.html';
});

/* ── Init ────────────────────────────────────────────── */
renderTopMeta();
renderSite();
renderBlockList();
renderSwatches();
applyAccent();
renderFontList();
applyFont();
buildToolbar();
fillEditableFields();
renderServices();
renderGallery();
renderTeam();
attachImageHandlers();
applyBookingLink();
applyTextStyles();

document.getElementById('addTeamMemberBtn')?.addEventListener('click', ()=>{
  content.team.members.push({ name:'Új munkatárs', role:'Beosztás', bio:'Rövid bemutatkozás.', image:'' });
  renderTeam();
  scheduleSave();
});

(async function connectLiveData(){
  const statusEl = document.getElementById('bookingStatus');
  const uid = await resolveUid();

  content.bookingUrl = uid ? `booking.html?uid=${uid}` : 'booking.html';
  applyBookingLink();

  if(!uid){
    statusEl.textContent = 'Nincs bejelentkezett fiók — a foglalási gombok az általános booking.html-re mutatnak, a szolgáltatások helyőrző adatok.';
    return;
  }

  const realPlans = await loadRealPlans(uid);
  if(realPlans.length){
    content.services.items = realPlans.map(p=>({
      id: p.id,
      name: p.name,
      desc: p.desc || '',
      price: p.price ? `${Number(p.price).toLocaleString('hu-HU')} Ft` : 'Ár egyeztetés alapján',
      category: p.category || 'other',
    }));
    content.services.real = true;
    renderServices();
    applyBookingLink();
    statusEl.classList.add('live');
    statusEl.innerHTML = `<strong>Élő adat csatlakoztatva.</strong> A Szolgáltatások szekció a valós Plans adataidat mutatja, a Foglalás gombok a saját booking oldaladra mutatnak.`;
  } else {
    content.services.real = false;
    statusEl.innerHTML = `Bejelentkezve, de még nincs felvett szolgáltatás a <strong>Plans</strong> oldalon. Addig helyőrző szolgáltatások jelennek meg — a Foglalás gombok már a saját booking oldaladra mutatnak.`;
  }
  scheduleSave();
})();