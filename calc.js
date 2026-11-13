/* Motore di calcolo del simulatore. Nessuna dipendenza: funziona nel browser e in Node (per i test). */
(function (root) {
  'use strict';

  const TIPI = {
    az_mondo:   { nome: 'Azionario mondiale',            r: [2, 6, 9] },
    az_tema:    { nome: 'Azionario tematico / settoriale', r: [0, 6, 10] },
    bilanciato: { nome: 'Bilanciato',                    r: [1.5, 4, 6] },
    flessibile: { nome: 'Flessibile',                    r: [0, 3, 6] },
    obblig:     { nome: 'Obbligazionario',               r: [1, 3, 4.5] },
    stato:      { nome: 'Titolo di Stato',               r: [3, 3, 3] },
    monetario:  { nome: 'Monetario / liquidità',         r: [1.5, 2, 2.5] },
    altro:      { nome: 'Altro',                         r: [2, 4, 6] },
  };

  const SCENARI = ['pess', 'med', 'ott'];

  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };

  /** Costo annuo del prodotto in % (gestione + transazione + performance). */
  function costoAnnuo(f) {
    return num(f.correnti) + num(f.transazione) + num(f.performance);
  }

  /**
   * Simula un titolo mese per mese.
   * f: parametri del titolo, s: impostazioni, rLordo: rendimento lordo annuo %,
   * senzaCosti: se true azzera i costi del prodotto (restano bollo e tasse) per misurare "quanto costano i costi".
   * Ritorna array per anno (0..anni) con: versato, valore (prima delle tasse), netto (dopo uscita e tasse), tasse.
   */
  function simula(f, s, rLordo, senzaCosti) {
    const anni = Math.max(1, Math.round(num(s.anni)));
    const ingresso = senzaCosti ? 0 : num(f.ingresso) / 100;
    const fisso = senzaCosti ? 0 : num(f.fissoRata);
    const uscita = senzaCosti ? 0 : num(f.uscita) / 100;
    const costi = senzaCosti ? 0 : costoAnnuo(f) / 100;
    const bollo = num(s.bollo) / 100;
    const quotaStato = Math.min(100, Math.max(0, num(f.quotaStato))) / 100;
    const aliquota = (quotaStato * num(s.aliquotaStato) + (1 - quotaStato) * num(s.aliquota)) / 100;
    const rNetto = num(rLordo) / 100 - costi;
    const fattoreMese = Math.pow(Math.max(0, 1 + rNetto), 1 / 12);
    const cap = num(f.capitale), pac = num(f.pac);

    let valore = cap > 0 ? Math.max(0, cap * (1 - ingresso) - fisso) : 0;
    let versato = cap;
    const out = [];
    const punto = (anno) => {
      const lordoUscita = valore * (1 - uscita);
      const guadagno = lordoUscita - versato;
      const tasse = guadagno > 0 ? guadagno * aliquota : 0;
      out.push({ anno, versato, valore, netto: lordoUscita - tasse, tasse });
    };
    punto(0);
    for (let m = 1; m <= anni * 12; m++) {
      valore *= fattoreMese;
      if (pac > 0) { valore += Math.max(0, pac * (1 - ingresso) - fisso); versato += pac; }
      if (m % 12 === 0) { valore = Math.max(0, valore - valore * bollo); punto(m / 12); }
    }
    return out;
  }

  /** Rendimento annuo effettivo (money-weighted) per chi investe: dai soldi versati al netto finale. */
  function rendimentoEffettivo(f, netFinale, anni) {
    const cap = num(f.capitale), pac = num(f.pac), N = anni * 12;
    if (cap + pac <= 0) return null;
    const vpn = (i) => { // valore attuale dei flussi con tasso mensile i
      let v = -cap;
      for (let m = 1; m <= N; m++) v -= pac / Math.pow(1 + i, m);
      return v + netFinale / Math.pow(1 + i, N);
    };
    let lo = -0.99 / 12, hi = 0.5 / 12;
    if (vpn(lo) * vpn(hi) > 0) return null;
    for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (vpn(lo) * vpn(mid) <= 0) hi = mid; else lo = mid; }
    return (Math.pow(1 + (lo + hi) / 2, 12) - 1) * 100;
  }

  /** Calcolo completo di un titolo: tre scenari + versione senza costi (scenario medio). */
  function calcolaTitolo(f, s) {
    const r = { pess: num(f.rPess), med: num(f.rMed), ott: num(f.rOtt) };
    const ris = {};
    SCENARI.forEach((k) => { ris[k] = simula(f, s, r[k], false); });
    ris.senzaCosti = simula(f, s, r.med, true);
    const fine = ris.med[ris.med.length - 1];
    const fineZero = ris.senzaCosti[ris.senzaCosti.length - 1];
    ris.costoDeiCosti = fineZero.netto - fine.netto;
    ris.rendEffettivo = rendimentoEffettivo(f, fine.netto, Math.max(1, Math.round(num(s.anni))));
    return ris;
  }

  /** Converte un punto nel valore da mostrare: netto o lordo, in euro nominali o di oggi. */
  // I soldi versati restano sempre in euro nominali (quelli che hai messo davvero), così il guadagno "in euro di oggi" è quello reale.
  function mostra(p, s, campo) {
    if (campo === 'versato') return p.versato;
    let v = campo === 'tasse' ? p.tasse : (s.netto ? p.netto : p.valore);
    if (s.realeOggi) v /= Math.pow(1 + num(s.inflazione) / 100, p.anno);
    return v;
  }

  const api = { TIPI, SCENARI, num, costoAnnuo, simula, calcolaTitolo, rendimentoEffettivo, mostra };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
