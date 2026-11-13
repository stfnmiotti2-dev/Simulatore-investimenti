const C=require('../calc.js');
const s={anni:20,bollo:0,aliquota:26,aliquotaStato:12.5,inflazione:2,netto:false,realeOggi:false};
const fondo={capitale:30000,pac:500,ingresso:3,correnti:2.2,transazione:0,performance:0,rPess:6,rMed:6,rOtt:6};
const fondo0={...fondo,ingresso:0};
const etf={capitale:30000,pac:500,ingresso:0,correnti:0.2,rPess:6,rMed:6,rOtt:6};
for(const [n,f] of [['fondo3%',fondo],['fondo0',fondo0],['etf',etf]]){const r=C.simula(f,s,6,false);console.log(n,Math.round(r[10].valore),Math.round(r[20].valore),'versato',r[10].versato,r[20].versato);}
const s2={...s,bollo:0.2,netto:true};const r=C.calcolaTitolo(etf,s2);const e=r.med[20];console.log('etf netto',Math.round(e.netto),'tasse',Math.round(e.tasse),'rendEff',r.rendEffettivo.toFixed(2),'costi',Math.round(r.costoDeiCosti));
