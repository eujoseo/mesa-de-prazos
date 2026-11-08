// Mesa de Prazos — widget médio para iPhone (app Scriptable)
// Lê o arquivo mesa-de-prazos.json que a Mesa grava no seu Google Drive.
//
// Núcleo do widget: é baixado e executado pelo script curto "Mesa de Prazos" no Scriptable.
// Configuração (uma vez só):
// 1. No script do bot (Apps Script), rode ligarWidget e implante como App da Web (instruções lá).
// 2. No Scriptable, rode o script "Mesa de Prazos" (▶) e cole o endereço .../exec?k=CHAVE quando pedir.
// 3. Na tela de início: segure › + › Scriptable › MÉDIO ou GRANDE › toque no widget › Script: Mesa de Prazos.
// O File Bookmark "Mesa" (arquivo do app Google Drive) continua como reserva, mas não é atualizado sozinho.

const BOOKMARK = 'Mesa';
const SITE = 'https://eujoseo.github.io/mesa-de-prazos/';

// ---------- cores ----------
const C = {
  fundo: Color.dynamic(new Color('#F2F5F6'), new Color('#0E151B')),
  cartao: Color.dynamic(new Color('#FFFFFF'), new Color('#162029')),
  tinta: Color.dynamic(new Color('#15212B'), new Color('#E4EAEE')),
  fraco: Color.dynamic(new Color('#5A6875'), new Color('#93A2AE')),
  vermelho: Color.dynamic(new Color('#B42318'), new Color('#F4877C')),
  laranja: Color.dynamic(new Color('#A15C07'), new Color('#F2B24C')),
  verde: Color.dynamic(new Color('#2B7A4B'), new Color('#73C995')),
  azul: Color.dynamic(new Color('#22577A'), new Color('#7FB4D8')),
  cinza: Color.dynamic(new Color('#D7DFE4'), new Color('#263541')),
  gaeco: Color.dynamic(new Color('#3A4892'), new Color('#9AA6EC')),
  caapora: Color.dynamic(new Color('#18756A'), new Color('#5FC9B9')),
  guarabira: Color.dynamic(new Color('#93630F'), new Color('#E1AE52')),
};
const NOMES = { gaeco: 'GAECO', caapora: 'Caaporã', guarabira: 'Guarabira' };
const TIPOS = { relatorio: 'Relatório de audiência', pga: 'PGA de audiência', pgaout: 'PGA', outra: 'Urgência' };
const CHECK_TOTAL = { gaeco: 6, caapora: 2, guarabira: 7 };

// ---------- datas ----------
const DIA = 864e5;
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = s => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const br = s => { const d = fromISO(s); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : '—'; };
const hoje = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
function pascoa(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(y, mes - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function feriados(y, extras) {
  const fx = ['01-01', '04-21', '05-01', '08-05', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map(md => `${y}-${md}`);
  const p = pascoa(y), mv = [-48, -47, -2, 60].map(n => iso(new Date(p.getTime() + n * DIA)));
  const ex = (extras || []).map(s => { const [d, m, a] = s.split('/'); return `${a}-${m}-${d}`; });
  return new Set([...fx, ...mv, ...ex]);
}
function util(d, cfg) {
  const w = d.getDay(); if (w === 0 || w === 6) return false;
  const m = d.getMonth() + 1, dd = d.getDate();
  if (cfg.recessoUteis !== false && ((m === 12 && dd >= 20) || (m === 1 && dd <= 20))) return false;
  return !feriados(d.getFullYear(), cfg.feriadosExtras).has(iso(d));
}
function diasUteisAte(alvo, cfg) {
  const h = hoje(); if (alvo <= h) return 0;
  let n = 0, x = new Date(h); while (x < alvo) { x = new Date(x.getTime() + DIA); if (util(x, cfg)) n++; }
  return n;
}
function situacaoItem(it, cfg) {
  const h = hoje(), meta = fromISO(it.meta), pf = fromISO(it.prazoFinal);
  if (pf && pf < h) return { k: 'vencido', txt: 'PRAZO VENCIDO', ord: 0 };
  if (!meta) return { k: 'sem', txt: 'sem data', ord: 9 };
  if (meta < h) return { k: 'atrasado', txt: `meta há ${Math.round((h - meta) / DIA)}d`, ord: 1 };
  if (+meta === +h) return { k: 'hoje', txt: 'HOJE', ord: 2 };
  const du = diasUteisAte(meta, cfg);
  if (du <= 1) return { k: 'amanha', txt: 'próx. dia útil', ord: 3 };
  return { k: du <= 3 ? 'semana' : 'depois', txt: `em ${du} d.u.`, ord: du <= 3 ? 4 : 5 };
}
const COR_SIT = { vencido: C.vermelho, atrasado: C.vermelho, hoje: C.laranja, amanha: C.laranja, semana: C.azul, depois: C.fraco, sem: C.fraco };

// ---------- leitura do arquivo (direto do Drive, com reservas) ----------
// O app Google Drive do iPhone só baixa a versão nova do arquivo quando ele é aberto no app Arquivos,
// então o File Bookmark fica com dados velhos. A leitura principal agora vem do app da Web do Apps Script
// (função doGet do bot), cujo endereço fica guardado nas Chaves do Scriptable.
const CHAVE_URL = 'mesa_url';
async function pedirUrl() {
  const a = new Alert(); a.title = 'Endereço da Mesa';
  a.message = 'Cole o URL do app da Web do Apps Script com ?k=CHAVE no final (rode ligarWidget no script do bot para obter a chave).';
  a.addTextField('https://script.google.com/macros/s/.../exec?k=...', Keychain.contains(CHAVE_URL) ? Keychain.get(CHAVE_URL) : '');
  a.addAction('Salvar'); a.addCancelAction('Agora não');
  if ((await a.present()) === 0) { const u = a.textFieldValue(0).trim(); if (/^https:\/\//.test(u)) Keychain.set(CHAVE_URL, u); }
}
async function lerMesa() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.documentsDirectory(), 'mesa-de-prazos-cache.json');
  if (!config.runsInWidget && !Keychain.contains(CHAVE_URL)) await pedirUrl();
  let txt = null, aviso = null;
  if (Keychain.contains(CHAVE_URL)) {
    try {
      const r = new Request(Keychain.get(CHAVE_URL)); r.timeoutInterval = 15;
      const s = await r.loadString(), j = JSON.parse(s);
      if (j && j.itens) txt = s; else aviso = j && j.erro ? 'Drive: ' + j.erro : 'Resposta inesperada do Drive.';
    } catch (e) { aviso = 'Sem conexão com o Drive; mostrando a última cópia.'; }
  }
  if (!txt && fm.bookmarkExists(BOOKMARK)) {
    try { const s = fm.readString(fm.bookmarkedPath(BOOKMARK)); if (s) txt = s; } catch (e) {}
    if (txt && fm.fileExists(cache)) {           // não deixa o bookmark velho sobrescrever uma cópia mais nova
      try { if ((JSON.parse(fm.readString(cache)).salvoEm || '') > (JSON.parse(txt).salvoEm || '')) txt = null; } catch (e) {}
    }
  }
  if (txt) fm.writeString(cache, txt);
  else if (fm.fileExists(cache)) txt = fm.readString(cache);
  if (!txt) return { erro: aviso || 'Configure o endereço da Mesa: rode este script no app Scriptable.' };
  if (!aviso && !Keychain.contains(CHAVE_URL)) aviso = 'Sem endereço do Drive: rode o script no app para configurar.';
  try { return { j: JSON.parse(txt), aviso }; } catch (e) { return { erro: 'O arquivo da Mesa está corrompido ou incompleto.' }; }
}

// ---------- análise ----------
function analisar(j) {
  const cfg = j.cfg || {}, h = iso(hoje()), utilHoje = util(hoje(), cfg);
  const itens = j.itens || [];
  const ab = itens.filter(i => i.status !== 'feito').map(i => Object.assign({}, i, { s: situacaoItem(i, cfg) }));
  const urg = ab.filter(i => i.tipo === 'urgencia');
  const pend = [], obs = [];
  const venc = ab.filter(i => i.s.k === 'vencido'), atras = ab.filter(i => i.s.k === 'atrasado'), deHoje = ab.filter(i => i.s.k === 'hoje');
  if (venc.length) pend.push(`${venc.length} com prazo vencido`);
  if (atras.length) pend.push(`${atras.length} com meta passada`);
  if (deHoje.length) pend.push(`${deHoje.length} para hoje`);
  const ck = (j.check || {})[h] || {};
  const feitosCk = Object.keys(ck).filter(k => ck[k]).length, totalCk = Object.values(CHECK_TOTAL).reduce((a, b) => a + b, 0);
  if (utilHoje && feitosCk < totalCk) pend.push(`análise ${feitosCk}/${totalCk}`);
  const presos = ab.filter(i => (i.flags || []).some(f => /preso/i.test(f)));
  if (presos.length) obs.push(`${presos.length} réu preso`);
  const naCaixa = itens.filter(i => i.status === 'feito' && i.aindaNaCaixa && i.aindaNaCaixa > (i.feitoMs || 0));
  if (naCaixa.length) obs.push(`${naCaixa.length} feito ainda na caixa`);
  if (utilHoje) {
    const nao = Object.keys(NOMES).filter(p => { const l = (cfg.leituras || {})[p + '_judicial']; return !l || iso(new Date(l)) !== h; });
    if (nao.length) obs.push(`caixa não lida: ${nao.map(p => NOMES[p]).join(', ')}`);
  }
  const lista = ab.filter(i => i.s.ord <= 4 || i.tipo === 'urgencia')
    .sort((a, b) => a.s.ord - b.s.ord || (a.meta || '9').localeCompare(b.meta || '9'));
  return { cfg, ab, urg, pend, obs, lista, presos };
}

// ---------- desenho ----------
function txt(st, s, size, cor, peso) {
  const t = st.addText(s); t.textColor = cor || C.tinta;
  t.font = peso === 'b' ? Font.boldSystemFont(size) : peso === 'm' ? Font.semiboldSystemFont(size) : peso === 'mono' ? Font.mediumMonospacedSystemFont(size) : Font.systemFont(size);
  t.lineLimit = 1; return t;
}
function montar(r, aviso) {
  const w = new ListWidget(); w.backgroundColor = C.fundo; w.setPadding(10, 12, 8, 12); w.url = SITE;
  const { ab, pend, obs, lista } = r;

  // topo
  const topo = w.addStack(); topo.centerAlignContent();
  txt(topo, 'Mesa de Prazos', 15, C.tinta, 'b'); topo.addSpacer();
  const df = new DateFormatter(); df.locale = 'pt_BR'; df.dateFormat = "EEE, d 'de' MMM";
  txt(topo, df.string(new Date()), 11, C.fraco);
  w.addSpacer(4);

  // situação
  const sit = w.addStack(); sit.layoutVertically(); sit.backgroundColor = C.cartao; sit.cornerRadius = 10; sit.setPadding(5, 9, 5, 9);
  const cor = pend.length ? C.vermelho : obs.length ? C.laranja : C.verde;
  const l1 = sit.addStack(); l1.size = new Size(0, 0);
  txt(l1, pend.length ? `● ${pend.length} pendência${pend.length > 1 ? 's' : ''}` : obs.length ? '● Tudo em dia — observar' : '● Tudo em dia', 13, cor, 'b');
  if (pend.length) txt(sit, 'Pendente: ' + pend.join(' · '), 10, C.tinta);
  if (obs.length) txt(sit, 'Observar: ' + obs.join(' · '), 10, C.fraco);
  w.addSpacer(6);

  // promotorias
  const pr = w.addStack(); pr.spacing = 6;
  for (const p of ['gaeco', 'caapora', 'guarabira']) {
    const c = pr.addStack(); c.layoutVertically(); c.backgroundColor = C.cartao; c.cornerRadius = 9; c.setPadding(4, 8, 4, 8); c.size = new Size(0, 0);
    const lst = ab.filter(i => i.prom === p), crit = lst.filter(i => i.s.ord <= 3).length;
    txt(c, NOMES[p].toUpperCase(), 9, C[p], 'b');
    const n = c.addStack(); n.bottomAlignContent();
    txt(n, String(lst.length), 15, C.tinta, 'mono');
    if (crit) { n.addSpacer(4); txt(n, `${crit} já`, 10, C.laranja, 'm'); }
    const lida = ((r.cfg.leituras || {})[p + '_judicial']) && iso(new Date(r.cfg.leituras[p + '_judicial'])) === iso(hoje());
    txt(c, lida ? '✓ caixa lida' : '○ ler caixa', 9, lida ? C.verde : C.laranja);
    c.addSpacer();
    if (p !== 'guarabira') pr.addSpacer(0);
  }
  w.addSpacer(6);

  // lista
  const MAX = 5;
  if (!lista.length) {
    txt(w, 'Nada vencendo até o próximo dia útil.', 12, C.fraco);
  } else {
    for (const i of lista.slice(0, MAX)) {
      const row = w.addStack(); row.centerAlignContent(); row.spacing = 7;
      const barra = row.addStack(); barra.size = new Size(4, 24); barra.cornerRadius = 2; barra.backgroundColor = COR_SIT[i.s.k];
      const meio = row.addStack(); meio.layoutVertically();
      const titulo = i.tipo === 'urgencia' ? `${TIPOS[i.urgTipo] || 'Urgência'}${i.processo ? ' · ' + i.processo : ''}`
        : `${NOMES[i.prom]} · ${i.processo || 'expediente'}`;
      const preso = (i.flags || []).some(f => /preso/i.test(f));
      txt(meio, (preso ? '⚠︎ ' : '') + titulo, 11.5, i.tipo === 'urgencia' ? C.vermelho : C.tinta, 'm');
      const det = i.tipo === 'urgencia' ? `fazer até ${br(i.meta)}${i.descricao ? ' · ' + i.descricao : ''}`
        : i.tipo === 'extra' ? `encerramento ${br(i.vencimento)}` : `meta ${br(i.meta)} · final ${br(i.prazoFinal)}${i.classe ? ' · ' + i.classe : ''}`;
      txt(meio, det, 9.5, C.fraco);
      row.addSpacer();
      txt(row, i.s.txt, 10, COR_SIT[i.s.k], 'b');
      w.addSpacer(3);
    }
  }
  w.addSpacer();

  // rodapé
  const rod = w.addStack();
  const resto = lista.length > MAX ? `+${lista.length - MAX} na fila · ` : '';
  txt(rod, aviso ? '⚠︎ ' + aviso : resto + `${ab.length} em aberto`, 9, aviso ? C.laranja : C.fraco).lineLimit = 1;
  rod.addSpacer();
  return w;
}

function montarMedio(r, aviso, MAXI) {
  const G = !!MAXI;
  const w = new ListWidget(); w.backgroundColor = C.fundo; w.setPadding(G ? 14 : 11, 13, G ? 12 : 10, 13); w.url = SITE;
  const { ab, pend, obs, lista } = r;
  const cor = pend.length ? C.vermelho : obs.length ? C.laranja : C.verde;
  // topo: título + situação
  const topo = w.addStack(); topo.centerAlignContent();
  txt(topo, 'Mesa de Prazos', G ? 15 : 13, C.tinta, 'b'); topo.addSpacer();
  txt(topo, pend.length ? `● ${pend.length} pendência${pend.length > 1 ? 's' : ''}` : obs.length ? '● Em dia · observar' : '● Tudo em dia', 11, cor, 'b');
  w.addSpacer(2);
  const resumo = pend.length ? pend.join(' · ') : obs.length ? obs.join(' · ') : 'Nada atrasado nem para hoje.';
  if (G) {
    if (pend.length) txt(w, 'Pendente: ' + pend.join(' · '), 10, C.tinta).lineLimit = 2;
    if (obs.length) txt(w, 'Observar: ' + obs.join(' · '), 10, C.fraco).lineLimit = 2;
    if (!pend.length && !obs.length) txt(w, resumo, 10, C.fraco);
  } else txt(w, resumo, 9.5, pend.length ? C.tinta : C.fraco);
  w.addSpacer(G ? 8 : 5);
  // promotorias numa linha
  const pr = w.addStack(); pr.spacing = 5;
  for (const p of ['gaeco', 'caapora', 'guarabira']) {
    const c = pr.addStack(); c.backgroundColor = C.cartao; c.cornerRadius = 7; c.setPadding(3, 6, 3, 6); c.centerAlignContent(); c.spacing = 4;
    const lst = ab.filter(i => i.prom === p), crit = lst.filter(i => i.s.ord <= 3).length;
    const l = (r.cfg.leituras || {})[p + '_judicial']; const lida = l && iso(new Date(l)) === iso(hoje());
    txt(c, NOMES[p], 9, C[p], 'b');
    txt(c, String(lst.length) + (crit ? ` (${crit} já)` : ''), 9.5, crit ? C.laranja : C.tinta, 'm');
    txt(c, lida ? '✓' : '○', 9, lida ? C.verde : C.laranja, 'b');
  }
  w.addSpacer(G ? 8 : 5);
  // itens
  const MAX = MAXI || 3;
  if (!lista.length) txt(w, 'Nada vencendo até o próximo dia útil.', 10.5, C.fraco);
  for (const i of lista.slice(0, MAX)) {
    const row = w.addStack(); row.centerAlignContent(); row.spacing = 6;
    const barra = row.addStack(); barra.size = new Size(3, 14); barra.cornerRadius = 1.5; barra.backgroundColor = COR_SIT[i.s.k];
    const preso = (i.flags || []).some(f => /preso/i.test(f));
    const titulo = i.tipo === 'urgencia' ? `${TIPOS[i.urgTipo] || 'Urgência'}${i.processo ? ' · ' + i.processo : ''}` : `${NOMES[i.prom]} · ${i.processo || 'expediente'}`;
    txt(row, (preso ? '⚠︎ ' : '') + titulo, 10.5, i.tipo === 'urgencia' ? C.vermelho : C.tinta, 'm');
    row.addSpacer();
    if (G) { row.addSpacer(4); txt(row, br(i.tipo === 'extra' ? i.vencimento : i.meta), 9.5, C.fraco, 'mono'); row.addSpacer(4); }
    txt(row, i.s.txt, 9.5, COR_SIT[i.s.k], 'b');
    w.addSpacer(G ? 5 : 2);
  }
  w.addSpacer();
  const rod = w.addStack();
  txt(rod, aviso ? '⚠︎ ' + aviso : (lista.length > MAX ? `+${lista.length - MAX} na fila · ` : '') + `${ab.length} em aberto`, 8.5, aviso ? C.laranja : C.fraco);
  if (r.salvoEm) {
    rod.addSpacer();
    const df = new DateFormatter(); df.dateFormat = 'dd/MM HH:mm';
    const velho = Date.now() - r.salvoEm.getTime() > 12 * 36e5;
    txt(rod, 'salvo ' + df.string(r.salvoEm), 8.5, velho ? C.laranja : C.fraco);
  }
  return w;
}
function telaErro(msg) {
  const w = new ListWidget(); w.backgroundColor = C.fundo; w.setPadding(16, 16, 16, 16); w.url = SITE;
  txt(w, 'Mesa de Prazos', 15, C.tinta, 'b'); w.addSpacer(8);
  const t = txt(w, msg, 12, C.laranja); t.lineLimit = 6; w.addSpacer();
  return w;
}

// ---------- execução ----------
module.exports = async function () {
const leitura = await lerMesa();
const widget = leitura.erro ? telaErro(leitura.erro) : (() => {
  const r = analisar(leitura.j);
  const salvo = leitura.j.salvoEm ? new Date(leitura.j.salvoEm) : null;
  r.salvoEm = salvo;
  const grande = config.widgetFamily === 'large';
  const w = grande ? montarMedio(r, leitura.aviso, 9) : montarMedio(r, leitura.aviso);
  if (false) {
    const df = new DateFormatter(); df.dateFormat = 'dd/MM HH:mm';
    const t = w.addText('dados de ' + df.string(salvo)); t.font = Font.systemFont(8); t.textColor = C.fraco; t.rightAlignText();
  }
  return w;
})();
const prox = new Date(); prox.setMinutes(prox.getMinutes() + 15); widget.refreshAfterDate = prox;
if (config.runsInWidget) Script.setWidget(widget); else await widget.presentLarge();
Script.complete();
};
