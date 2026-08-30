const TEMPLATES = [
    {
      id: 'clinic',
      name: 'Clinic',
      tagline: 'Veterinary practice',
      icon: 'stethoscope',
      color: '#2F6FE4',
      bg: '#EAF3FF',
      terms: {
        clientLabel: 'Patients',
        bookingLabel: 'Appointments',
        planLabel: 'Care Plans',
        nav: ['Patients', 'Appointments', 'Care Plans', 'Invoices'],
      }
    },
    {
      id: 'walker',
      name: 'Walker',
      tagline: 'Dog walking',
      icon: 'pets',
      color: '#2F9E52',
      bg: '#EAF7EE',
      terms: {
        clientLabel: 'Clients',
        bookingLabel: 'Bookings',
        planLabel: 'Plans',
        nav: ['Clients', 'Bookings', 'Plans', 'Invoices'],
      }
    },
    {
      id: 'groomer',
      name: 'Groomer',
      tagline: 'Pet grooming',
      icon: 'content_cut',
      color: '#D8493D',
      bg: '#FFF1F0',
      terms: {
        clientLabel: 'Clients',
        bookingLabel: 'Appointments',
        planLabel: 'Packages',
        nav: ['Clients', 'Appointments', 'Packages', 'Invoices'],
      }
    },
    {
      id: 'trainer',
      name: 'Trainer',
      tagline: 'Obedience & training',
      icon: 'sports',
      color: '#C98A12',
      bg: '#FFF7E6',
      terms: {
        clientLabel: 'Clients',
        bookingLabel: 'Sessions',
        planLabel: 'Programs',
        nav: ['Clients', 'Sessions', 'Programs', 'Invoices'],
      }
    },
    {
      id: 'boarding',
      name: 'Boarding',
      tagline: 'Overnight stays & kennel',
      icon: 'cottage',
      color: '#7C5CFC',
      bg: '#F3EEFF',
      terms: {
        clientLabel: 'Guests',
        bookingLabel: 'Stays',
        planLabel: 'Packages',
        nav: ['Guests', 'Stays', 'Packages', 'Invoices'],
      }
    },
    {
      id: 'photographer',
      name: 'Photographer',
      tagline: 'Pet photography',
      icon: 'photo_camera',
      color: '#D6499E',
      bg: '#FDF0F8',
      terms: {
        clientLabel: 'Clients',
        bookingLabel: 'Sessions',
        planLabel: 'Packages',
        nav: ['Clients', 'Sessions', 'Packages', 'Invoices'],
      }
    },
    {
      id: 'shop',
      name: 'Shop',
      tagline: 'Pet retail',
      icon: 'storefront',
      color: '#10A398',
      bg: '#EFFCFB',
      terms: {
        clientLabel: 'Customers',
        bookingLabel: 'Orders',
        planLabel: 'Products',
        nav: ['Customers', 'Orders', 'Products', 'Invoices'],
      }
    },
  ];

  const grid = document.getElementById('grid');
  const footerBar = document.getElementById('footerBar');
  const footerIcon = document.getElementById('footerIcon');
  const footerName = document.getElementById('footerName');
  const continueBtn = document.getElementById('continueBtn');
  const continueLabel = document.getElementById('continueLabel');

  let selectedId = null;

  function render() {
    grid.innerHTML = '';
    TEMPLATES.forEach(t => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card' + (t.id === selectedId ? ' selected' : '');
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', t.id === selectedId ? 'true' : 'false');
      card.dataset.id = t.id;

      card.innerHTML = `
        <div class="card-top">
          <div class="icon-chip" style="background:${t.bg};color:${t.color};">
            <span class="material-symbols-rounded">${t.icon}</span>
          </div>
          <div class="check"><span class="material-symbols-rounded">check</span></div>
        </div>
        <div>
          <p class="card-name">${t.name}</p>
          <p class="card-tag">${t.tagline}</p>
        </div>
        <div class="chips">
          ${t.terms.nav.map(n => `<span class="chip">${n}</span>`).join('')}
        </div>
      `;

      card.addEventListener('click', () => select(t.id));
      grid.appendChild(card);
    });
  }

  function select(id) {
    selectedId = id;
    render();
    const t = TEMPLATES.find(x => x.id === id);
    footerIcon.style.background = t.bg;
    footerIcon.style.color = t.color;
    footerIcon.innerHTML = `<span class="material-symbols-rounded">${t.icon}</span>`;
    footerName.textContent = t.name + ' workspace';
    footerBar.classList.add('show');
  }

  continueBtn.addEventListener('click', () => {
    if (!selectedId) return;
    const t = TEMPLATES.find(x => x.id === selectedId);

    continueBtn.disabled = true;
    continueLabel.textContent = 'Setting up…';

    // Persist the chosen template so the rest of the console can read
    // renamed labels, icons and quick actions from it.
    try {
      localStorage.setItem('wt_template', JSON.stringify(t));
    } catch (e) {}

    setTimeout(() => {
      window.location.href = 'editor.html';
    }, 350);
  });

  render();