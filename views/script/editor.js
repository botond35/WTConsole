import { db } from "../script/firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

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
let currentImgTarget = null;
let saveTimer = null;

const swatchPalette = ['#2F6FE4','#2F9E52','#D8493D','#C98A12','#7C5CFC','#D6499E','#10A398','#2F2F2F'];

/* ── uid resolution ───────────────────────────────────────────────
   Reuses the same "dataReady" convention as bookings-admin.js / plans.js
   (fired by homepage.js once the signed-in business is known). Falls
   back to a ?uid= query param so this page also works as a standalone
   preview link. If neither is available the page still works, just
   without live Plans / a live booking link. */
function resolveUid(){
  return new Promise(resolve=>{
    if(window.WT?.data?.uid){ resolve(window.WT.data.uid); return; }
    const params = new URLSearchParams(window.location.search);
    const paramUid = params.get('uid');
    let done = false;
    document.addEventListener('dataReady', (e)=>{
      if(done) return; done = true;
      resolve(e.detail?.uid || paramUid || null);
    }, { once:true });
    setTimeout(()=>{ if(!done){ done = true; resolve(paramUid || null); } }, 800);
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
    const card = document.createElement('div');
    card.className = 'svc-card';
    card.innerHTML = `
      <div class="svc-icon"><span class="material-symbols-rounded" style="font-size:18px;">${template.icon}</span></div>
      <div class="svc-name ${editable?'editable':''}" ${editable?'contenteditable="true"':''} data-svc="${i}" data-field="name">${esc(svc.name)}</div>
      <div class="svc-desc ${editable?'editable':''}" ${editable?'contenteditable="true"':''} data-svc="${i}" data-field="desc">${esc(svc.desc||'')}</div>
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
}

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

document.getElementById('publishBtn').addEventListener('click', ()=>{
  try{ localStorage.setItem(STORAGE_CONTENT, JSON.stringify(content)); }catch(e){}
  showToast('Weboldal közzétéve');
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
fillEditableFields();
renderServices();
renderGallery();
renderTeam();
attachImageHandlers();
applyBookingLink();

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