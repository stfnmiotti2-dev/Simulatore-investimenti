/* Simulatore investimenti — interfaccia. Dati salvati nel dispositivo (localStorage) + backup Excel. */
(function () {
  'use strict';
  const { TIPI, num, costoAnnuo, calcolaTitolo, mostra } = window.Calc;
  const $ = (s) => document.querySelector(s);
  const KEY = 'simulatore.v1';
  const PALETTE = ['#2a78b8', '#e07b39', '#3a9e5c', '#b5487c', '#7b62c9', '#c4a227', '#2aa3a3', '#8c6d4f'];
  const FILE_BACKUP = 'Simulatore_investimenti_backup.xlsx';

  const IMPOSTAZIONI_DEFAULT = {
    anni: 20, inflazione: 2, aliquota: 26, aliquotaStato: 12.5, bollo: 0.2,
    netto: true, realeOggi: false, fascia: true, tema: 'auto', autoBackup: false,
  };

  // Campi del titolo: chiave interna, etichetta (usata anche come intestazione Excel), default.
  const CAMPI = [
    ['nome', 'Nome', ''], ['isin', 'ISIN', ''], ['tipo', 'Tipo', 'az_mondo'], ['sri', 'Rischio SRI', ''],
    ['colore', 'Colore', '#2a78b8'], ['sigla', 'Sigla', ''], ['capitale', 'Capitale iniziale €', 0], ['pac', 'Versamento mensile €', 0],
    ['quotaStato', 'Quota titoli di Stato %', 0], ['ingresso', 'Ingresso %', 0], ['fissoRata', 'Costo fisso per rata €', 0],
    ['correnti', 'Spese correnti %', 0], ['transazione', 'Transazione %', 0], ['performance', 'Performance %', 0],
    ['uscita', 'Uscita %', 0], ['rPess', 'Rend. pessimista %', 2], ['rMed', 'Rend. medio %', 6], ['rOtt', 'Rend. ottimista %', 9],
    ['note', 'Note', ''], ['visibile', 'Visibile', true], ['riferimento', 'Solo riferimento', false],
  ];
  const NUMERICI = new Set(['sri', 'capitale', 'pac', 'quotaStato', 'ingresso', 'fissoRata', 'correnti', 'transazione', 'performance', 'uscita', 'rPess', 'rMed', 'rOtt']);
  const ETICHETTE_IMP = {
    anni: 'Anni grafico', inflazione: 'Inflazione %', aliquota: 'Tasse guadagni %', aliquotaStato: 'Tasse titoli di Stato %',
    bollo: 'Bollo %', netto: 'Mostra netto tasse', realeOggi: 'In euro di oggi', fascia: 'Fascia scenari', tema: 'Tema',
    autoBackup: 'Backup automatico', mostraTotale: 'Mostra totale', mostraVersato: 'Mostra versato',
  };

  const nuovoId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const titoloVuoto = () => Object.fromEntries(CAMPI.map(([k, , d]) => [k, d]));

  function esempi() {
    return [
      Object.assign(titoloVuoto(), { id: nuovoId(), nome: 'Esempio: fondo azionario di banca', tipo: 'az_mondo', sri: 4, colore: '#e07b39',
        capitale: 30000, pac: 500, ingresso: 3, fissoRata: 0, correnti: 2.0, transazione: 0.2, performance: 0,
        rPess: 2, rMed: 6, rOtt: 9, note: 'Costi simili ai fondi Eurizon proposti. Modificalo o cancellalo.' }),
      Object.assign(titoloVuoto(), { id: nuovoId(), nome: 'Esempio: ETF MSCI World', isin: 'IE00B4L5Y983', tipo: 'az_mondo', sri: 4, colore: '#2a78b8',
        capitale: 0, pac: 0, ingresso: 0, fissoRata: 0, correnti: 0.2, transazione: 0, performance: 0, riferimento: true,
        rPess: 2, rMed: 6, rOtt: 9, note: 'Riferimento: stesso mercato con costi da ETF, fuori dal totale. Modificalo o cancellalo.' }),
    ];
  }

  // ---------------- Stato e salvataggio locale ----------------
  let stato = carica();
  function carica() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return { impostazioni: Object.assign({}, IMPOSTAZIONI_DEFAULT, d.impostazioni), titoli: d.titoli || [],
          mostraTotale: d.mostraTotale !== false, mostraVersato: d.mostraVersato !== false };
      }
    } catch (e) { /* dati non leggibili: si riparte dagli esempi */ }
    return { impostazioni: Object.assign({}, IMPOSTAZIONI_DEFAULT), titoli: esempi(), mostraTotale: true, mostraVersato: true };
  }
  let timerBackup = null;
  function salva() {
    try { localStorage.setItem(KEY, JSON.stringify(stato)); } catch (e) { toast('Impossibile salvare nel dispositivo'); }
    if (stato.impostazioni.autoBackup && dirHandle) {
      clearTimeout(timerBackup);
      timerBackup = setTimeout(() => salvaExcel(true), 1500);
    }
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const euro = (v) => (v == null || !isFinite(v)) ? '–' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
  const pct = (v) => (v == null || !isFinite(v)) ? '–' : v.toLocaleString('it-IT', { maximumFractionDigits: 2 }) + '%';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------- Tema ----------------
  function applicaTema() {
    const t = stato.impostazioni.tema;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  // ---------------- Navigazione ----------------
  function vai() {
    const p = (location.hash || '#home').slice(1);
    const pagina = ['home', 'titoli', 'impostazioni'].includes(p) ? p : 'home';
    document.querySelectorAll('.page').forEach((el) => { el.hidden = el.id !== 'page-' + pagina; });
    document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === pagina));
    if (pagina === 'home') disegnaHome();
    if (pagina === 'titoli') disegnaTitoli();
    if (pagina === 'impostazioni') disegnaImpostazioni();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', vai);

  // ---------------- Pagina principale ----------------
  let grafico = null;
  // I titoli "di riferimento" (es. un ETF indice) non entrano nel totale: vengono simulati con gli stessi soldi
  // dei titoli reali accesi, così la loro linea si confronta direttamente con il Totale.
  const isRif = (f) => f.riferimento === true;
  function soldiReali() {
    const reali = stato.titoli.filter((f) => !isRif(f));
    const accesi = reali.filter((f) => f.visibile !== false);
    const base = accesi.length ? accesi : reali;
    return { capitale: base.reduce((a, f) => a + num(f.capitale), 0), pac: base.reduce((a, f) => a + num(f.pac), 0) };
  }
  function calcoli() {
    const s = stato.impostazioni;
    const soldi = soldiReali();
    return stato.titoli.map((f) => ({ f, r: calcolaTitolo(isRif(f) ? Object.assign({}, f, soldi) : f, s) }));
  }

  function sommaSerie(lista, scen) {
    if (!lista.length) return [];
    const n = lista[0].r[scen].length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = { anno: i, versato: 0, valore: 0, netto: 0, tasse: 0, voci: {} };
      lista.forEach(({ r }) => {
        const q = r[scen][i]; p.versato += q.versato; p.valore += q.valore; p.netto += q.netto; p.tasse += q.tasse;
        Object.entries(q.voci || {}).forEach(([k, x]) => { p.voci[k] = (p.voci[k] || 0) + x; });
      });
      out.push(p);
    }
    return out;
  }

  function alpha(hex, a) {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // Scenario medio a fine periodo: confronto con lo stesso titolo senza costi del prodotto (stesso mercato, bollo e tasse).
  function riepilogo(lista) {
    const R = { versato: 0, senzaCosti: 0, costi: 0, ritiro: 0, tasse: 0, inTasca: 0, bollo: 0, perTitolo: [] };
    lista.forEach((x) => {
      const p = x.r.med[x.r.med.length - 1], z = x.r.senzaCosti[x.r.senzaCosti.length - 1];
      const ritiro = p.valore - p.voci.uscita;
      const t = { f: x.f, p, versato: p.versato, senzaCosti: z.valore, ritiro, costi: z.valore - ritiro, tasse: p.tasse, inTasca: p.netto, bollo: p.voci.bollo };
      ['versato', 'senzaCosti', 'costi', 'ritiro', 'tasse', 'inTasca', 'bollo'].forEach((k) => { R[k] += t[k]; });
      R.perTitolo.push(t);
    });
    return R;
  }

  function disegnaHome() {
    const s = stato.impostazioni;
    $('#ctl-anni').value = s.anni;
    $('#ctl-netto').checked = !!s.netto;
    $('#ctl-reale').checked = !!s.realeOggi;
    $('#ctl-fascia').checked = !!s.fascia;
    $('#lbl-anni').textContent = s.anni;
    $('#lbl-modo').textContent = '· ' + (s.netto ? 'netto tasse' : 'lordo tasse') + (s.realeOggi ? ', in euro di oggi' : ', in euro nominali');

    const tutti = calcoli();
    const attivi = tutti.filter((x) => x.f.visibile !== false && !isRif(x.f));
    const rifAccesi = tutti.filter((x) => x.f.visibile !== false && isRif(x.f));
    const tot = { pess: sommaSerie(attivi, 'pess'), med: sommaSerie(attivi, 'med'), ott: sommaSerie(attivi, 'ott') };

    // Riquadri a catena: versato -> senza costi sarebbe -> - costi -> valore al ritiro -> - tasse -> in tasca
    const capTot = attivi.reduce((a, x) => a + num(x.f.capitale), 0);
    const pacTot = attivi.reduce((a, x) => a + num(x.f.pac), 0);
    const R = riepilogo(attivi);
    const def = s.realeOggi ? Math.pow(1 + num(s.inflazione) / 100, num(s.anni)) : 1; // "in euro di oggi"
    const e = (x) => euro(x / def);
    const ult = (arr) => arr[arr.length - 1];
    const fine = (sc) => tot[sc].length ? ult(tot[sc]) : null;
    const rit = (p) => p ? (p.valore - p.voci.uscita) / def : null;
    const freccia = '<div class="t-op">→</div>';
    const tile = (k, val, sub, cls, id) => `<div class="tile ${cls || ''}"${id ? ` id="${id}" role="button" tabindex="0"` : ''}><div class="k">${k}</div><div class="v">${val}</div><div class="s">${sub}</div></div>`;
    $('#tiles').innerHTML = attivi.length ? [
      tile('Versato in ' + s.anni + ' anni', euro(R.versato), euro(capTot) + ' iniziali + ' + euro(pacTot) + '/mese'),
      tile('Senza costi sarebbero', e(R.senzaCosti), 'prima delle tasse'),
      tile('− Costi', e(R.costi), 'ⓘ tocca per il dettaglio', 'cliccabile costi', 'tile-costi'),
      tile('= Valore al ritiro', e(R.ritiro), 'prima delle tasse · da ' + euro(rit(fine('pess'))) + ' a ' + euro(rit(fine('ott')))),
      tile('− Tasse al ritiro', e(R.tasse), pct(num(s.aliquota)) + ' sul guadagno (bollo già pagato: ' + e(R.bollo) + ')', 'tasse'),
      tile('= In tasca', e(R.inTasca), 'guadagno netto ' + euro(R.inTasca / def - R.versato) , 'forte'),
    ].join('') : '<div class="tile"><div class="k">Nessun titolo acceso</div><div class="s">Accendine uno dalla lista "Mostra nel grafico".</div></div>';
    $('#tiles').classList.toggle('catena', !!attivi.length);
    if (s.realeOggi) $('#tiles').insertAdjacentHTML('beforeend', '<p class="hint tiles-nota">Valori in euro di oggi (inflazione ' + pct(num(s.inflazione)) + '); il versato è in euro nominali.</p>');

    // Lista delle linee a sinistra
    const li = [];
    const voce = (id, acceso, dot, nome, cls) => `<li data-id="${id}" class="${cls || ''} ${acceso ? '' : 'off'}" role="checkbox" aria-checked="${acceso}">` +
      `<input type="checkbox" tabindex="-1" ${acceso ? 'checked' : ''}>${dot}<span class="nome">${nome}</span></li>`;
    tutti.filter((x) => !isRif(x.f)).forEach(({ f }) => li.push(voce(f.id, f.visibile !== false, `<span class="dot" style="background:${esc(f.colore)}"></span>`, esc(f.nome))));
    if (!tutti.length) li.push('<li class="hint">Nessun titolo: aggiungilo dalla pagina Titoli.</li>');
    li.push(voce('__tot', stato.mostraTotale, '<span class="dot" style="background:var(--text)"></span>', '<b>Totale</b>', 'sep'));
    li.push(voce('__ver', stato.mostraVersato, '<span class="dot dash"></span>', 'Soldi versati'));
    const rif = tutti.filter((x) => isRif(x.f));
    if (rif.length) {
      li.push('<li class="sep gruppo">Riferimenti (fuori dal totale)</li>');
      rif.forEach(({ f }) => li.push(voce(f.id, f.visibile !== false, `<span class="dot dot-rif" style="border-color:${esc(f.colore)}"></span>`, '<i>' + esc(f.nome) + '</i>')));
    }
    $('#lista-serie').innerHTML = li.join('');

    disegnaGrafico(attivi, rifAccesi, tot);
    disegnaTabella(attivi, rifAccesi, tot);
  }

  function disegnaGrafico(attivi, rifAccesi, tot) {
    const s = stato.impostazioni;
    const css = getComputedStyle(document.documentElement);
    const cText = css.getPropertyValue('--text').trim(), cMuted = css.getPropertyValue('--muted').trim(), cGrid = css.getPropertyValue('--grid').trim();
    const anni = Array.from({ length: Math.round(num(s.anni)) + 1 }, (_, i) => i);
    const ds = [];
    const serie = (nome, colore, r, larghezza, tratteggio) => {
      if (s.fascia) {
        ds.push({ label: nome + ' (pess.)', data: r.pess.map((p) => mostra(p, s)), borderWidth: 0, pointRadius: 0, fill: false, _banda: true });
        ds.push({ label: nome + ' (ott.)', data: r.ott.map((p) => mostra(p, s)), borderWidth: 0, pointRadius: 0, fill: '-1', backgroundColor: alpha(colore, 0.13), _banda: true });
      }
      ds.push({ label: nome, data: r.med.map((p) => mostra(p, s)), borderColor: colore, backgroundColor: colore, borderWidth: larghezza, pointRadius: 0, pointHitRadius: 6, tension: 0.15, borderDash: tratteggio || [] });
    };
    attivi.forEach(({ f, r }) => serie(f.nome, f.colore, r, 2.2));
    if (stato.mostraTotale && attivi.length > 1) serie('Totale', cText, tot, 3.2);
    rifAccesi.forEach(({ f, r }) => serie(f.nome + ' (rif.)', f.colore, r, 2.2, [2, 4]));
    if (stato.mostraVersato && tot.med.length) {
      ds.push({ label: 'Soldi versati', data: tot.med.map((p) => mostra(p, s, 'versato')), borderColor: cMuted, borderDash: [6, 4], borderWidth: 1.8, pointRadius: 0, stepped: false });
    }
    const cfg = {
      type: 'line',
      data: { labels: anni, datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (it) => !it.dataset._banda,
            itemSort: (a, b) => b.parsed.y - a.parsed.y,
            callbacks: { title: (it) => 'Anno ' + it[0].label, label: (it) => ' ' + it.dataset.label + ': ' + euro(it.parsed.y) },
          },
        },
        scales: {
          x: { title: { display: true, text: 'Anni', color: cMuted }, ticks: { color: cMuted, maxTicksLimit: 12 }, grid: { color: cGrid } },
          y: { title: { display: true, text: s.realeOggi ? 'Valore (euro di oggi)' : 'Valore (€)', color: cMuted }, beginAtZero: true,
            ticks: { color: cMuted, callback: (v) => v >= 1000 ? (v / 1000).toLocaleString('it-IT') + 'k' : v }, grid: { color: cGrid } },
        },
      },
    };
    if (grafico) grafico.destroy();
    grafico = new Chart($('#grafico'), cfg);
  }

  function disegnaTabella(attivi, rifAccesi, tot) {
    const s = stato.impostazioni;
    const ult = (a) => a[a.length - 1];
    const riga = (nome, colore, r, costi, rend, cls) => {
      const pm = ult(r.med), pp = ult(r.pess), po = ult(r.ott);
      const ver = mostra(pm, s, 'versato'), val = mostra(pm, s);
      const guad = val - ver;
      return `<tr class="${cls || ''}"><td>${colore ? `<span class="dot" style="display:inline-block;vertical-align:-2px;background:${esc(colore)}"></span> ` : ''}${esc(nome)}</td>
        <td>${euro(ver)}</td><td>${euro(mostra(pp, s))}</td><td><b>${euro(val)}</b></td><td>${euro(mostra(po, s))}</td>
        <td class="${guad < 0 ? 'neg' : ''}">${euro(guad)}</td><td>${euro(mostra(pm, s, 'tasse'))}</td><td>${euro(costi)}</td><td>${pct(rend)}</td></tr>`;
    };
    let html = `<thead><tr><th>Titolo</th><th>Versato</th><th>Pessimista</th><th>Medio</th><th>Ottimista</th><th>Guadagno (medio)</th><th>Tasse (medio)</th><th>Costi</th><th>Rend. netto annuo</th></tr></thead><tbody>`;
    if (!attivi.length) html += `<tr><td colspan="9">Nessun titolo acceso. Accendine uno dalla lista o aggiungilo dalla pagina Titoli.</td></tr>`;
    const cst = (x) => riepilogo([x]).costi;
    attivi.forEach((x) => { html += riga(x.f.nome, x.f.colore, x.r, cst(x), x.r.rendEffettivo); });
    if (attivi.length > 1) html += riga('Totale', null, tot, riepilogo(attivi).costi, null, 'totale');
    if (rifAccesi.length) {
      html += `<tr class="gruppo"><td colspan="9">Riferimenti: stessi soldi del totale, ma solo per confronto</td></tr>`;
      rifAccesi.forEach((x) => { html += riga(x.f.nome, x.f.colore, x.r, cst(x), x.r.rendEffettivo, 'rif'); });
    }
    $('#tab-risultati').innerHTML = html + '</tbody>';
  }

  // Sigla breve di un titolo (per le colonne strette): quella scelta dall'utente, oppure le iniziali delle parole significative.
  const PAROLE_VUOTE = new Set(['fund', 'found', 'fondo', 'eurizon', 'ucits', 'etf', 'sicav', 'classe', 'class', 'acc', 'dist', 'eur', 'the', 'di', 'del', 'e', 'and', 'r', 'esempio:']);
  function sigla(f) {
    if (f.sigla && String(f.sigla).trim()) return String(f.sigla).trim().slice(0, 8);
    const parole = String(f.nome || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !PAROLE_VUOTE.has(w.toLowerCase()));
    if (!parole.length) return String(f.nome || '?').slice(0, 6);
    if (parole.length === 1) return parole[0].slice(0, 6).toUpperCase();
    return parole.slice(0, 4).map((w) => /^\d+$/.test(w) ? w : w[0].toUpperCase()).join('');
  }

  // ---------------- Pop-up: dettaglio dei costi (semplice) ----------------
  function apriDettaglioCosti() {
    const s = stato.impostazioni;
    const attivi = calcoli().filter((x) => x.f.visibile !== false && !isRif(x.f));
    const dlg = $('#dlg-costi'), corpo = $('#dlg-costi-corpo');
    if (!attivi.length) { corpo.innerHTML = '<p>Nessun titolo acceso.</p>'; dlg.showModal(); return; }
    const R = riepilogo(attivi), col = R.perTitolo;
    const e0 = (x) => Math.abs(x) < 0.5 ? '–' : euro(x);
    const dot = (c) => `<span class="dot" style="display:inline-block;vertical-align:-2px;background:${esc(c.f.colore)}"></span>`;
    const somma = (fn) => col.reduce((a, c) => a + fn(c), 0);
    const PAG = ['ingresso', 'fisso', 'gestione', 'transazione', 'performance', 'uscita'];
    const pagati = (c) => PAG.reduce((a, k) => a + c.p.voci[k], 0);
    const RIGHE = [
      ['ingresso', 'Ingresso', 'Banca'], ['fisso', 'Costi fissi per rata', 'Banca'],
      ['gestione', 'Gestione (TER)', 'Società del fondo'], ['performance', 'Performance', 'Società del fondo'],
      ['transazione', 'Compravendite nel fondo', 'Mercato'], ['uscita', 'Uscita', 'Banca'],
    ].filter(([k]) => somma((c) => c.p.voci[k]) >= 0.5);
    const riga = (voce, chi, fn, cls) => `<tr class="${cls || ''}"><td>${voce}</td><td class="chi">${chi}</td>${col.map((c) => `<td>${e0(fn(c))}</td>`).join('')}<td class="tot">${e0(somma(fn))}</td></tr>`;
    let h = `<p class="riass">Senza costi i tuoi soldi sarebbero <b>${euro(R.senzaCosti)}</b>. Con i costi sono <b>${euro(R.ritiro)}</b>: i costi ti tolgono <b>${euro(R.costi)}</b>. Ecco dove vanno.</p>
      <div class="table-wrap"><table class="griglia"><thead><tr><th>Costo</th><th>A chi va</th>${col.map((c) => `<th title="${esc(c.f.nome)}">${dot(c)} ${esc(sigla(c.f))}</th>`).join('')}<th class="tot">Totale</th></tr></thead><tbody>`;
    RIGHE.forEach(([k, voce, chi]) => { h += riga(voce, chi, (c) => c.p.voci[k]); });
    h += riga('Soldi pagati', '', pagati, 'sub');
    h += riga('Guadagno perso su quei soldi', '', (c) => c.costi - pagati(c));
    h += riga('Totale costi', '', (c) => c.costi, 'sub forte');
    h += `</tbody></table></div>
      <div class="legenda-sigle">${col.map((c) => `<span>${dot(c)} <b>${esc(sigla(c.f))}</b> = ${esc(c.f.nome)}</span>`).join('')}</div>
      <p class="hint">"Guadagno perso": i soldi pagati in costi non sono rimasti investiti, quindi non hanno fruttato negli anni successivi.
      La gestione (TER) non la vedi mai addebitata: è già tolta dal prezzo della quota, e una parte spesso torna alla banca.
      Scenario medio, dopo ${s.anni} anni, euro nominali.</p>`;
    corpo.innerHTML = h;
    dlg.showModal();
  }
  $('#tiles').addEventListener('click', (e) => { if (e.target.closest('#tile-costi')) apriDettaglioCosti(); });
  $('#tiles').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('#tile-costi')) { e.preventDefault(); apriDettaglioCosti(); } });
  $('#dlg-costi-chiudi').addEventListener('click', () => $('#dlg-costi').close());
  $('#dlg-costi').addEventListener('click', (e) => { if (e.target.id === 'dlg-costi') e.target.close(); }); // tocco fuori dal riquadro

  $('#lista-serie').addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li || !li.dataset.id) return;
    const id = li.dataset.id;
    if (id === '__tot') stato.mostraTotale = !stato.mostraTotale;
    else if (id === '__ver') stato.mostraVersato = !stato.mostraVersato;
    else { const f = stato.titoli.find((t) => t.id === id); if (f) f.visibile = f.visibile === false; }
    salva(); disegnaHome();
  });
  const tuttiVisibili = (v) => { stato.titoli.forEach((f) => { f.visibile = v; }); salva(); disegnaHome(); };
  $('#btn-tutti').addEventListener('click', () => tuttiVisibili(true));
  $('#btn-nessuno').addEventListener('click', () => tuttiVisibili(false));
  $('#ctl-anni').addEventListener('change', (e) => {
    const n = Math.min(60, Math.max(1, Math.round(num(e.target.value)) || 20));
    stato.impostazioni.anni = n; salva(); disegnaHome();
  });
  [['#ctl-netto', 'netto'], ['#ctl-reale', 'realeOggi'], ['#ctl-fascia', 'fascia']].forEach(([sel, k]) => {
    $(sel).addEventListener('change', (e) => { stato.impostazioni[k] = e.target.checked; salva(); disegnaHome(); });
  });

  // ---------------- Pagina titoli ----------------
  let inModifica = null; // id del titolo in modifica, null = nuovo
  const form = $('#form-titolo');
  $('#sel-tipo').innerHTML = Object.entries(TIPI).map(([k, t]) => `<option value="${k}">${t.nome}</option>`).join('');

  function disegnaTitoli() {
    $('#lista-titoli').innerHTML = stato.titoli.length ? stato.titoli.map((f) => `
      <li data-id="${f.id}"><span class="dot" style="background:${esc(f.colore)}"></span><span class="nome" title="${esc(f.nome)}">${esc(f.nome)}${isRif(f) ? ' <small class="badge">riferimento</small>' : ''}</span>
      <button data-az="mod">Modifica</button><button data-az="dup">Duplica</button><button data-az="del" class="danger">Elimina</button></li>`).join('')
      : '<li>Nessun titolo. Premi "+ Nuovo titolo".</li>';
    // Ripartizione
    const reali = stato.titoli.filter((f) => !isRif(f));
    const capT = reali.reduce((a, f) => a + num(f.capitale), 0);
    const pacT = reali.reduce((a, f) => a + num(f.pac), 0);
    $('#rip-cap').value = capT; $('#rip-pac').value = pacT;
    const n = reali.length || 1;
    $('#rip-quote').innerHTML = reali.map((f) => {
      const q = capT > 0 ? num(f.capitale) / capT * 100 : (pacT > 0 ? num(f.pac) / pacT * 100 : 100 / n);
      return `<label>${esc(f.nome)}<span><input type="number" min="0" max="100" step="1" data-id="${f.id}" value="${Math.round(q * 10) / 10}"> %</span></label>`;
    }).join('');
    aggiornaSommaQuote();
    if (inModifica === null) riempiForm(null);
  }
  function aggiornaSommaQuote() {
    const somma = [...document.querySelectorAll('#rip-quote input')].reduce((a, i) => a + num(i.value), 0);
    $('#rip-somma').textContent = 'Somma delle quote: ' + pct(somma) + (Math.abs(somma - 100) > 0.5 ? ' (deve fare 100%)' : '');
  }
  $('#rip-quote').addEventListener('input', aggiornaSommaQuote);
  $('#btn-ripartisci').addEventListener('click', () => {
    const inputs = [...document.querySelectorAll('#rip-quote input')];
    const somma = inputs.reduce((a, i) => a + num(i.value), 0);
    if (Math.abs(somma - 100) > 0.5) { toast('Le quote devono sommare 100%'); return; }
    const cap = num($('#rip-cap').value), pac = num($('#rip-pac').value);
    inputs.forEach((i) => { const f = stato.titoli.find((t) => t.id === i.dataset.id); const q = num(i.value) / somma; // piccoli arrotondamenti assorbiti
      f.capitale = Math.round(cap * q); f.pac = Math.round(pac * q * 100) / 100; });
    salva(); disegnaTitoli(); toast('Ripartizione applicata');
  });

  function riempiForm(f) {
    inModifica = f ? f.id : null;
    const dati = f || Object.assign(titoloVuoto(), { colore: PALETTE[stato.titoli.length % PALETTE.length] });
    if (!f) { const r = TIPI[dati.tipo].r; dati.rPess = r[0]; dati.rMed = r[1]; dati.rOtt = r[2]; }
    CAMPI.forEach(([k]) => { const el = form.elements[k]; if (!el) return; if (el.type === 'checkbox') el.checked = !!dati[k]; else el.value = dati[k] ?? ''; });
    aggiornaRif();
    $('#form-titolo-h').textContent = f ? 'Modifica: ' + f.nome : 'Nuovo titolo';
    form.querySelectorAll('.da-verificare').forEach((el) => el.classList.remove('da-verificare'));
    $('#foto-stato').hidden = true; $('#storico-box').hidden = true; ultimoStorico = null;
    aggiornaCostoTotale();
  }
  function leggiForm() {
    const d = {};
    CAMPI.forEach(([k]) => { const el = form.elements[k]; if (el && el.type === 'checkbox') d[k] = el.checked; else if (el) d[k] = NUMERICI.has(k) ? (el.value === '' ? (k === 'sri' ? '' : 0) : num(el.value)) : el.value.trim(); });
    return d;
  }
  function aggiornaCostoTotale() {
    const d = leggiForm();
    $('#costo-totale').textContent = 'Costo annuo del prodotto: ' + pct(costoAnnuo(d)) + ' (gestione + transazione + performance), più ' + pct(d.ingresso) + ' di ingresso su ogni versamento.';
  }
  function aggiornaRif() {
    const rifOn = form.elements.riferimento.checked;
    ['capitale', 'pac'].forEach((k) => { form.elements[k].disabled = rifOn; });
    $('#nota-rif').hidden = !rifOn;
  }
  form.elements.riferimento.addEventListener('change', aggiornaRif);
  form.addEventListener('input', (e) => { e.target.classList.remove('da-verificare'); aggiornaCostoTotale(); });
  $('#btn-default-r').addEventListener('click', () => {
    const r = TIPI[form.elements.tipo.value].r;
    form.elements.rPess.value = r[0]; form.elements.rMed.value = r[1]; form.elements.rOtt.value = r[2];
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = leggiForm();
    if (!d.nome) { toast('Inserisci un nome'); return; }
    if (inModifica) Object.assign(stato.titoli.find((t) => t.id === inModifica), d);
    else stato.titoli.push(Object.assign({ id: nuovoId(), visibile: true }, d));
    const daVerificare = form.querySelectorAll('.da-verificare').length;
    if (daVerificare && !confirm('Ci sono ' + daVerificare + ' valori letti dalla foto non ancora controllati (evidenziati in giallo). Salvare lo stesso?')) return;
    salva(); toast('Titolo salvato'); inModifica = null; disegnaTitoli();
  });
  $('#btn-annulla').addEventListener('click', () => { riempiForm(null); });
  $('#btn-nuovo').addEventListener('click', () => { riempiForm(null); form.scrollIntoView({ behavior: 'smooth' }); });
  $('#lista-titoli').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.closest('li').dataset.id; const f = stato.titoli.find((t) => t.id === id); if (!f) return;
    if (b.dataset.az === 'mod') { riempiForm(f); form.scrollIntoView({ behavior: 'smooth' }); }
    if (b.dataset.az === 'dup') {
      stato.titoli.push(Object.assign({}, f, { id: nuovoId(), nome: f.nome + ' (copia)', colore: PALETTE[stato.titoli.length % PALETTE.length] }));
      salva(); disegnaTitoli();
    }
    if (b.dataset.az === 'del' && confirm('Eliminare "' + f.nome + '"?')) {
      stato.titoli = stato.titoli.filter((t) => t.id !== id); if (inModifica === id) inModifica = null;
      salva(); disegnaTitoli(); toast('Titolo eliminato');
    }
  });

  // ---------------- Lettura scheda da foto/PDF con Gemini ----------------
  const GEMINI_KEY = 'simulatore.geminiKey', GEMINI_MODEL = 'simulatore.geminiModel', MODELLO_DEFAULT = 'gemini-flash-latest';
  const MODELLI_RISERVA = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
  const leggiLocale = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const scriviLocale = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* ignorato */ } };

  // Riduce la foto (max 2000 px, JPEG) per inviarla più in fretta.
  function preparaFile(file) {
    return new Promise((res, rej) => {
      const leggiB64 = (blob, mime) => { const r = new FileReader(); r.onload = () => res({ mime, data: String(r.result).split(',')[1] }); r.onerror = () => rej(new Error('file non leggibile')); r.readAsDataURL(blob); };
      if (file.type === 'application/pdf') { if (file.size > 15e6) return rej(new Error('PDF troppo grande (max 15 MB)')); return leggiB64(file, 'application/pdf'); }
      if (!file.type.startsWith('image/')) return rej(new Error('serve una foto o un PDF'));
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 2000 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob((b) => b ? leggiB64(b, 'image/jpeg') : rej(new Error('foto non convertibile')), 'image/jpeg', 0.88);
      };
      img.onerror = () => { URL.revokeObjectURL(url); leggiB64(file, file.type); }; // formato non decodificabile (es. HEIC): lo invio così com'è
      img.src = url;
    });
  }

  const SCHEMA_SCHEDA = {
    type: 'OBJECT',
    properties: {
      nome: { type: 'STRING', nullable: true }, isin: { type: 'STRING', nullable: true },
      tipo: { type: 'STRING', enum: Object.keys(TIPI), nullable: true }, sri: { type: 'INTEGER', nullable: true },
      ingresso: { type: 'NUMBER', nullable: true }, fissoRata: { type: 'NUMBER', nullable: true },
      correnti: { type: 'NUMBER', nullable: true }, transazione: { type: 'NUMBER', nullable: true },
      performance: { type: 'NUMBER', nullable: true }, uscita: { type: 'NUMBER', nullable: true },
      quotaStato: { type: 'NUMBER', nullable: true }, note: { type: 'STRING', nullable: true },
      rend1a: { type: 'NUMBER', nullable: true }, rend3a: { type: 'NUMBER', nullable: true }, rend5a: { type: 'NUMBER', nullable: true },
      rend10a: { type: 'NUMBER', nullable: true }, rendLancio: { type: 'NUMBER', nullable: true }, dataLancio: { type: 'STRING', nullable: true },
      scenarioModerato: { type: 'NUMBER', nullable: true }, dataDati: { type: 'STRING', nullable: true },
    },
  };
  const ISTRUZIONI = `Sei un assistente che legge schede di fondi, ETF e titoli (KID, schede commerciali, factsheet, fogli della banca) in italiano o inglese.
Estrai SOLO i valori scritti nel documento, senza inventare: se un valore non c'è, metti null.
Percentuali come numeri (es. "2,46%" -> 2.46). Campi:
- nome: nome del prodotto con la classe di quote; isin: codice ISIN;
- tipo: una delle chiavi ${Object.entries(TIPI).map(([k, t]) => k + ' (' + t.nome + ')').join(', ')};
- sri: indicatore sintetico di rischio 1-7;
- ingresso: commissione/costo di ingresso massimo in % (se c'è solo un importo in euro su 10.000 €, convertilo in %);
- fissoRata: spese fisse in euro per operazione o per rata PAC;
- correnti: commissioni di gestione e altri costi amministrativi o di esercizio, % annuo (spese correnti / TER), SENZA i costi di transazione;
- transazione: costi di transazione % annuo;
- performance: commissioni di performance come impatto annuo % stimato (dal KID); se c'è solo l'aliquota tipo "20% dell'extra-rendimento" metti null e scrivilo nelle note;
- uscita: costo di uscita in %;
- quotaStato: % del portafoglio in titoli di Stato, solo se indicata;
- rend1a, rend3a, rend5a, rend10a: rendimenti passati ANNUALIZZATI % del prodotto (non del benchmark) a 1, 3, 5, 10 anni, se la scheda li riporta (tipico dei factsheet); se ci sono solo i rendimenti anno per anno, calcola la media annua composta per i periodi coperti; altrimenti null;
- rendLancio: rendimento annualizzato % dal lancio, se indicato; dataLancio: data di lancio; dataDati: data di riferimento dei rendimenti;
- scenarioModerato: nel KID, rendimento medio annuo % dello scenario "moderato" al periodo di detenzione raccomandato;
- note: in italiano, al massimo 3 frasi: cosa hai trovato, cosa manca, dubbi (es. valore massimo o stimato, data della scheda).`;

  // Chiamata a Gemini con modelli di riserva se il primo è occupato. Restituisce la risposta JSON dell'API.
  async function chiamaGemini(chiave, corpo, avviso, msg429) {
    const scelto = (leggiLocale(GEMINI_MODEL) || MODELLO_DEFAULT).replace(/^models\//, '');
    const modelli = [...new Set([scelto, ...MODELLI_RISERVA])];
    let r = null, j = {};
    for (const modello of modelli) {
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modello)}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chiave }, body: JSON.stringify(corpo),
        });
        j = await r.json().catch(() => ({}));
        if (r.ok || ![404, 429, 500, 503].includes(r.status)) break;
      } catch (e) { r = null; } // errore di rete: provo il modello successivo
      avviso('⏳ Il modello ' + esc(modello) + ' non risponde, provo con un altro…');
    }
    if (!r) throw new Error('connessione a Gemini non riuscita, controlla internet e riprova');
    if (!r.ok) {
      const msg = (j.error && j.error.message) || ('errore ' + r.status);
      if (r.status === 503 || r.status === 500) throw new Error('i server di Gemini sono sovraccarichi in questo momento, riprova tra qualche minuto');
      if (r.status === 429) throw new Error(msg429 || 'quota gratuita di Gemini esaurita per ora, riprova più tardi');
      if (r.status === 400 && /API key/i.test(msg)) throw new Error('chiave Gemini non valida');
      throw new Error(msg);
    }
    return j;
  }
  const testoRisposta = (j) => (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('') || '';

  async function leggiScheda(file) {
    const chiave = leggiLocale(GEMINI_KEY);
    const box = $('#foto-stato');
    const mostraStato = (html, errore) => { box.innerHTML = html; box.classList.toggle('errore', !!errore); box.hidden = false; };
    if (!chiave) { mostraStato('Per leggere le foto serve la chiave Gemini: inseriscila in <a href="#impostazioni">Impostazioni</a>.', true); return; }
    if (!navigator.onLine) { mostraStato('Serve la connessione a internet per leggere la foto.', true); return; }
    mostraStato('⏳ Sto leggendo la scheda… (10-30 secondi)');
    try {
      const { mime, data } = await preparaFile(file);
      const j = await chiamaGemini(chiave, {
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data } }, { text: ISTRUZIONI }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA_SCHEDA },
      }, mostraStato);
      const v = JSON.parse(testoRisposta(j));
      const trovati = [];
      ['nome', 'isin', 'tipo', 'sri', 'ingresso', 'fissoRata', 'correnti', 'transazione', 'performance', 'uscita', 'quotaStato'].forEach((k) => {
        if (v[k] === null || v[k] === undefined || v[k] === '') return;
        if (k === 'tipo' && !TIPI[v[k]]) return;
        const el = form.elements[k]; el.value = v[k]; el.classList.add('da-verificare'); trovati.push(el.closest('label').firstChild.textContent.trim());
      });
      if (v.tipo && TIPI[v.tipo] && inModifica === null) { const rr = TIPI[v.tipo].r; form.elements.rPess.value = rr[0]; form.elements.rMed.value = rr[1]; form.elements.rOtt.value = rr[2]; }
      if (v.note) form.elements.note.value = ('Da foto: ' + v.note + (form.elements.note.value ? '\n' + form.elements.note.value : '')).slice(0, 1000);
      aggiornaCostoTotale();
      if (['rend1a', 'rend3a', 'rend5a', 'rend10a', 'rendLancio', 'scenarioModerato'].some((k) => typeof v[k] === 'number')) mostraStorico(v, 'scheda fotografata');
      mostraStato(trovati.length
        ? `✅ Letti ${trovati.length} valori: <b>${esc(trovati.join(', '))}</b>. Sono evidenziati in giallo: <b>controllali con la scheda</b> prima di salvare. Capitale, versamento e rendimenti li scegli tu.` + (v.note ? `<br><small>${esc(v.note)}</small>` : '')
        : 'Non ho trovato valori utili nella foto. Prova con una foto più nitida e dritta, o con il PDF del KID.', !trovati.length);
    } catch (err) {
      mostraStato('Lettura non riuscita: ' + esc(err.message), true);
    }
  }
  // ---------------- Andamento storico -> proposta di rendimenti ----------------
  // I rendimenti storici di un fondo/ETF sono già al netto dei suoi costi annui (gestione, transazione, performance):
  // l'app lavora con il rendimento LORDO e toglie i costi da sola, quindi per proporre i rendimenti li riaggiungo.
  let ultimoStorico = null;
  function proponiRendimenti(d) {
    const costi = costoAnnuo(leggiForm());
    const periodi = [['rend10a', 10], ['rend5a', 5], ['rendLancio', 0], ['rend3a', 3]].filter(([k]) => typeof d[k] === 'number');
    let base = null, baseNome = '';
    if (periodi.length) { base = d[periodi[0][0]]; baseNome = { rend10a: '10 anni', rend5a: '5 anni', rendLancio: 'dal lancio', rend3a: '3 anni' }[periodi[0][0]]; }
    else if (typeof d.scenarioModerato === 'number') { base = d.scenarioModerato; baseNome = 'scenario moderato del KID'; }
    if (base === null) return null;
    const lordi = ['rend3a', 'rend5a', 'rend10a', 'rendLancio'].filter((k) => typeof d[k] === 'number').map((k) => d[k] + costi);
    const arrot = (x) => Math.round(x * 10) / 10;
    let med = base + costi, pess, ott;
    // Il pessimista non deve dipendere solo da anni buoni: prendo il più basso tra storico − 2, medio − 4 e il pessimista tipico del tipo.
    const tipico = (TIPI[form.elements.tipo.value] || TIPI.altro).r;
    pess = Math.min(lordi.length ? Math.min(...lordi) - 2 : med - 4, med - 4, tipico[0]);
    ott = lordi.length >= 2 ? Math.max(...lordi) : med + 3;
    const avvisi = [];
    if (!d.rend10a) avvisi.push('Non c\'è uno storico di 10 anni: pochi anni possono riflettere un periodo particolarmente buono o cattivo.');
    if (med > 10) { avvisi.push('Il medio storico supera il 10% lordo: è raro che duri per 20 anni, ho limitato la proposta al 10%.'); med = 10; }
    pess = Math.max(-5, Math.min(pess, med - 1)); ott = Math.min(15, Math.max(ott, med + 1));
    return { pess: arrot(pess), med: arrot(med), ott: arrot(ott), costi, baseNome, avvisi };
  }
  function mostraStorico(d, fonte) {
    ultimoStorico = Object.assign({ fonte }, d);
    const box = $('#storico-box'), p = proponiRendimenti(d);
    const cell = (k) => typeof d[k] === 'number' ? pct(d[k]) : '–';
    let html = `<b>Andamento storico</b> <small>(${esc(fonte)}${d.dataDati ? ', dati al ' + esc(d.dataDati) : ''})</small>
      <table class="mini-tab"><tr><th>1 anno</th><th>3 anni</th><th>5 anni</th><th>10 anni</th><th>Dal lancio</th></tr>
      <tr><td>${cell('rend1a')}</td><td>${cell('rend3a')}</td><td>${cell('rend5a')}</td><td>${cell('rend10a')}</td><td>${cell('rendLancio')}${d.dataLancio ? '<br><small>' + esc(d.dataLancio) + '</small>' : ''}</td></tr></table>
      <small>Rendimenti medi annui passati, già al netto dei costi del prodotto.</small>`;
    if (typeof d.scenarioModerato === 'number') html += `<br><small>Scenario moderato del KID: ${pct(d.scenarioModerato)} l'anno.</small>`;
    if (p) {
      html += `<p>Proposta (rendimento lordo = storico ${esc(p.baseNome)} + ${pct(p.costi)} di costi annui del prodotto):
        <b>pessimista ${pct(p.pess)} · medio ${pct(p.med)} · ottimista ${pct(p.ott)}</b></p>`;
      p.avvisi.forEach((a) => { html += `<p class="hint">⚠️ ${esc(a)}</p>`; });
      html += `<button type="button" id="btn-applica-storico" class="primary">Usa questi rendimenti</button>`;
    } else html += '<p class="hint">Non ci sono dati sufficienti per proporre dei rendimenti.</p>';
    html += '<p class="hint">I rendimenti passati non garantiscono quelli futuri: usali come indicazione, non come previsione.</p>';
    box.innerHTML = html; box.hidden = false; box.classList.remove('errore');
    const b = $('#btn-applica-storico');
    if (b) b.addEventListener('click', () => {
      const q = proponiRendimenti(ultimoStorico); // ricalcolo con i costi attuali del modulo
      [['rPess', q.pess], ['rMed', q.med], ['rOtt', q.ott]].forEach(([k, val]) => { form.elements[k].value = val; form.elements[k].classList.add('da-verificare'); });
      const riass = `Storico (${ultimoStorico.fonte}${ultimoStorico.dataDati ? ', ' + ultimoStorico.dataDati : ''}): ` +
        [['1a', 'rend1a'], ['3a', 'rend3a'], ['5a', 'rend5a'], ['10a', 'rend10a']].filter(([, k]) => typeof ultimoStorico[k] === 'number').map(([n, k]) => n + ' ' + pct(ultimoStorico[k])).join(', ');
      form.elements.note.value = (riass + (form.elements.note.value ? '\n' + form.elements.note.value : '')).slice(0, 1000);
      toast('Rendimenti inseriti: controllali e salva');
    });
  }

  async function cercaStorico() {
    const box = $('#storico-box');
    const mostra = (html, errore) => { box.innerHTML = html; box.classList.toggle('errore', !!errore); box.hidden = false; };
    const isin = form.elements.isin.value.trim(), nome = form.elements.nome.value.trim();
    const link = isin ? `<br>Puoi guardare tu: <a href="https://www.justetf.com/it/etf-profile.html?isin=${encodeURIComponent(isin)}" target="_blank" rel="noopener">justETF</a> (ETF) ·
      <a href="https://www.google.com/search?q=${encodeURIComponent(isin + ' rendimento annualizzato 5 anni')}" target="_blank" rel="noopener">cerca con Google</a>, oppure fotografa il factsheet: l'app legge anche i rendimenti passati.` : '';
    if (!isin && !nome) { mostra('Inserisci prima l\'ISIN (meglio) o il nome del titolo.', true); return; }
    const chiave = leggiLocale(GEMINI_KEY);
    if (!chiave) { mostra('Per cercare su internet serve la chiave Gemini: inseriscila in <a href="#impostazioni">Impostazioni</a>.' + link, true); return; }
    mostra('⏳ Cerco su internet l\'andamento storico… (20-60 secondi)');
    const domanda = `Cerca sul web (siti come justETF, Morningstar, Borsa Italiana, sito dell'emittente) i rendimenti storici del prodotto ${isin ? 'con ISIN ' + isin : ''} ${nome ? '(' + nome + ')' : ''}, nella classe/valuta corrispondente all'ISIN.
Rispondi SOLO con un oggetto JSON, senza altro testo, con queste chiavi:
nome (string), rend1a, rend3a, rend5a, rend10a (rendimento ANNUALIZZATO % del prodotto, non del benchmark, numero o null), rendLancio (annualizzato % dal lancio o null), dataLancio (string o null), dataDati (string: data di riferimento dei dati), fonte (string: nome del sito), note (max 2 frasi in italiano).
Usa solo numeri trovati nelle fonti; se non li trovi metti null. Non inventare.`;
    try {
      const j = await chiamaGemini(chiave, { contents: [{ role: 'user', parts: [{ text: domanda }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } },
        (h) => mostra(h), 'la ricerca su internet di Gemini non è disponibile ora con la tua chiave (quota gratuita esaurita o ricerca non inclusa nel piano gratuito)');
      const t = testoRisposta(j); const m = t.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('risposta non comprensibile');
      const d = JSON.parse(m[0]);
      ['rend1a', 'rend3a', 'rend5a', 'rend10a', 'rendLancio'].forEach((k) => { d[k] = typeof d[k] === 'number' ? d[k] : (d[k] != null && isFinite(num(d[k])) && String(d[k]).trim() !== '' ? num(d[k]) : null); });
      if (!['rend1a', 'rend3a', 'rend5a', 'rend10a', 'rendLancio'].some((k) => typeof d[k] === 'number')) { mostra('Non ho trovato rendimenti storici affidabili per questo titolo.' + (d.note ? '<br><small>' + esc(d.note) + '</small>' : '') + link, true); return; }
      mostraStorico(d, 'internet: ' + (d.fonte || 'ricerca Google'));
      if (d.note) box.insertAdjacentHTML('beforeend', `<p class="hint">${esc(d.note)}</p>`);
      box.insertAdjacentHTML('beforeend', `<p class="hint">Verifica i numeri sulla fonte.${link}</p>`);
    } catch (err) { mostra('Ricerca non riuscita: ' + esc(err.message) + '.' + link, true); }
  }
  $('#btn-storico').addEventListener('click', cercaStorico);

  ['#foto-camera', '#foto-file'].forEach((sel) => $(sel).addEventListener('change', (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (f) leggiScheda(f);
  }));

  // ---------------- Impostazioni ----------------
  const CAMPI_IMP = ['anni', 'inflazione', 'aliquota', 'aliquotaStato', 'bollo'];
  function disegnaImpostazioni() {
    const s = stato.impostazioni;
    CAMPI_IMP.forEach((k) => { $('#set-' + k).value = s[k]; });
    $('#set-tema').value = s.tema; $('#set-auto').checked = !!s.autoBackup;
    $('#set-gemini-key').value = leggiLocale(GEMINI_KEY); $('#set-gemini-model').value = leggiLocale(GEMINI_MODEL);
    aggiornaInfoBackup();
  }
  CAMPI_IMP.forEach((k) => $('#set-' + k).addEventListener('change', (e) => {
    let v = num(e.target.value); if (k === 'anni') v = Math.min(60, Math.max(1, Math.round(v) || 20));
    stato.impostazioni[k] = v; salva(); toast('Impostazione salvata');
  }));
  $('#set-tema').addEventListener('change', (e) => { stato.impostazioni.tema = e.target.value; salva(); applicaTema(); });
  $('#set-auto').addEventListener('change', (e) => { stato.impostazioni.autoBackup = e.target.checked; salva(); });
  $('#btn-info-gemini').addEventListener('click', (e) => {
    const box = $('#info-gemini'); box.hidden = !box.hidden; e.currentTarget.setAttribute('aria-expanded', String(!box.hidden));
    e.currentTarget.textContent = box.hidden ? 'ⓘ Info chiave' : '✕ Chiudi info';
  });
  $('#set-gemini-key').addEventListener('change', (e) => { scriviLocale(GEMINI_KEY, e.target.value.trim()); toast('Chiave Gemini salvata su questo dispositivo'); });
  $('#set-gemini-model').addEventListener('change', (e) => { scriviLocale(GEMINI_MODEL, e.target.value.trim()); toast('Modello salvato'); });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Cancellare tutti i titoli e le impostazioni? (Il file di backup Excel non viene toccato)')) return;
    stato = { impostazioni: Object.assign({}, IMPOSTAZIONI_DEFAULT), titoli: esempi(), mostraTotale: true, mostraVersato: true };
    salva(); applicaTema(); disegnaImpostazioni(); toast('Dati azzerati');
  });

  // ---------------- Cartella di backup (File System Access API, PC con Chrome/Edge) ----------------
  let dirHandle = null;
  const fsSupportato = 'showDirectoryPicker' in window;
  function idb(op, val) {
    return new Promise((res) => {
      try {
        const rq = indexedDB.open('simulatore', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onerror = () => res(null);
        rq.onsuccess = () => {
          const tx = rq.result.transaction('kv', op === 'get' ? 'readonly' : 'readwrite');
          const st = tx.objectStore('kv');
          const r = op === 'get' ? st.get('dir') : st.put(val, 'dir');
          r.onsuccess = () => res(r.result ?? null); r.onerror = () => res(null);
        };
      } catch (e) { res(null); }
    });
  }
  function aggiornaInfoBackup() {
    $('#btn-cartella').hidden = !fsSupportato;
    $('#backup-info').textContent = fsSupportato
      ? (dirHandle ? 'Cartella di backup: "' + dirHandle.name + '". Il file si chiama ' + FILE_BACKUP + '.'
        : 'Nessuna cartella scelta: il backup viene scaricato nella cartella Download. Scegli una cartella (es. Documenti) con il pulsante.')
      : 'Su questo dispositivo il browser non può scrivere in una cartella a scelta: il backup viene scaricato (cartella Download) e puoi spostarlo o condividerlo.';
  }
  $('#btn-cartella').addEventListener('click', async () => {
    try {
      dirHandle = await window.showDirectoryPicker({ id: 'backup', mode: 'readwrite', startIn: 'documents' });
      await idb('put', dirHandle); aggiornaInfoBackup(); toast('Cartella scelta: ' + dirHandle.name);
    } catch (e) { if (e.name !== 'AbortError') toast('Cartella non disponibile'); }
  });

  // ---------------- Excel: backup e ripristino ----------------
  function creaWorkbook() {
    const s = stato.impostazioni;
    const wb = XLSX.utils.book_new();
    const titoli = stato.titoli.map((f) => Object.fromEntries([['ID', f.id], ...CAMPI.map(([k, et]) => [et, k === 'tipo' ? (TIPI[f[k]] ? TIPI[f[k]].nome : f[k]) : f[k]])]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(titoli, { header: ['ID', ...CAMPI.map((c) => c[1])] }), 'Titoli');
    const imp = Object.entries(ETICHETTE_IMP).map(([k, et]) => ({ Chiave: k, Impostazione: et, Valore: k in s ? s[k] : stato[k] }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(imp), 'Impostazioni');
    // Proiezioni anno per anno (scenario medio, come impostato: netto/lordo, nominale/reale)
    const tutti = calcoli();
    const righe = [];
    for (let a = 0; a <= Math.round(num(s.anni)); a++) {
      const r = { Anno: a };
      let ver = 0, tot = 0, totP = 0, totO = 0;
      tutti.forEach(({ f, r: x }) => {
        r[f.nome + (isRif(f) ? ' (riferimento, medio)' : ' (medio)')] = Math.round(mostra(x.med[a], s));
        if (f.visibile !== false && !isRif(f)) { ver += mostra(x.med[a], s, 'versato'); tot += mostra(x.med[a], s); totP += mostra(x.pess[a], s); totO += mostra(x.ott[a], s); }
      });
      Object.assign(r, { 'Versato (accesi)': Math.round(ver), 'Totale pessimista': Math.round(totP), 'Totale medio': Math.round(tot), 'Totale ottimista': Math.round(totO) });
      righe.push(r);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(righe), 'Proiezioni');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Simulatore investimenti - backup'], ['Salvato il', new Date().toLocaleString('it-IT')],
      ['Valori in Proiezioni', (s.netto ? 'netto tasse' : 'lordo tasse') + ', ' + (s.realeOggi ? 'euro di oggi' : 'euro nominali')],
      ['Per ripristinare: Impostazioni > Ripristina da Excel. Non rinominare i fogli Titoli e Impostazioni.'],
      ['Simulazione ipotetica a scopo educativo, non consulenza.'],
    ]), 'Info');
    return wb;
  }
  async function salvaExcel(silenzioso) {
    try {
      const wb = creaWorkbook();
      if (dirHandle) {
        let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && !silenzioso) perm = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          const fh = await dirHandle.getFileHandle(FILE_BACKUP, { create: true });
          const w = await fh.createWritable(); await w.write(buf); await w.close();
          $('#backup-stato').textContent = 'Ultimo backup: ' + new Date().toLocaleString('it-IT') + ' in "' + dirHandle.name + '"';
          if (!silenzioso) toast('Backup salvato in ' + dirHandle.name);
          return;
        }
        if (silenzioso) return; // senza permesso il backup automatico non scarica file a sorpresa
      }
      XLSX.writeFile(wb, FILE_BACKUP);
      $('#backup-stato').textContent = 'Ultimo backup scaricato: ' + new Date().toLocaleString('it-IT');
    } catch (e) { toast('Backup non riuscito: ' + e.message); }
  }
  $('#btn-salva-excel').addEventListener('click', () => salvaExcel(false));

  $('#file-ripristina').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const shT = wb.Sheets['Titoli'];
      if (!shT) throw new Error('foglio "Titoli" mancante');
      const nomeTipo = Object.fromEntries(Object.entries(TIPI).map(([k, t]) => [t.nome, k]));
      const titoli = XLSX.utils.sheet_to_json(shT, { defval: '' }).map((riga) => {
        const f = titoloVuoto(); f.id = riga.ID ? String(riga.ID) : nuovoId();
        CAMPI.forEach(([k, et]) => { if (et in riga) f[k] = riga[et]; });
        NUMERICI.forEach((k) => { f[k] = k === 'sri' && f[k] === '' ? '' : num(f[k]); });
        f.tipo = nomeTipo[f.tipo] || (TIPI[f.tipo] ? f.tipo : 'altro');
        f.riferimento = f.riferimento === true || ['TRUE', 'VERO', 'SI', 'SÌ', '1'].includes(String(f.riferimento).toUpperCase());
        f.visibile = !(f.visibile === false || String(f.visibile).toUpperCase() === 'FALSE' || f.visibile === 'falso');
        f.nome = String(f.nome); f.isin = String(f.isin); f.note = String(f.note); f.colore = String(f.colore || '#2a78b8');
        return f;
      }).filter((f) => f.nome);
      const imp = Object.assign({}, IMPOSTAZIONI_DEFAULT);
      let mostraTotale = true, mostraVersato = true;
      if (wb.Sheets['Impostazioni']) {
        XLSX.utils.sheet_to_json(wb.Sheets['Impostazioni']).forEach(({ Chiave, Valore }) => {
          const bool = (v) => v === true || String(v).toUpperCase() === 'TRUE';
          if (Chiave === 'mostraTotale') mostraTotale = bool(Valore);
          else if (Chiave === 'mostraVersato') mostraVersato = bool(Valore);
          else if (Chiave in imp) imp[Chiave] = typeof imp[Chiave] === 'boolean' ? bool(Valore) : (typeof imp[Chiave] === 'number' ? num(Valore) : String(Valore));
        });
      }
      if (!confirm('Ripristinare ' + titoli.length + ' titoli dal file "' + file.name + '"? I dati attuali verranno sostituiti.')) return;
      stato = { impostazioni: imp, titoli, mostraTotale, mostraVersato };
      salva(); applicaTema(); disegnaImpostazioni(); toast('Ripristinati ' + titoli.length + ' titoli');
    } catch (err) { toast('File non valido: ' + err.message); }
  });

  // ---------------- Avvio ----------------
  applicaTema();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!$('#page-home').hidden) disegnaHome(); });
  idb('get').then((h) => { if (h) dirHandle = h; if (!$('#page-impostazioni').hidden) aggiornaInfoBackup(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  vai();
})();
