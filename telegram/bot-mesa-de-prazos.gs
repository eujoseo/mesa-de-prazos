/**
 * Mesa de Prazos — bot do Telegram com avisos às 6h, 14h e 21h
 *
 * Lê o arquivo "mesa-de-prazos.json" que a Mesa de Prazos grava no seu Google Drive
 * e manda no Telegram o que precisa de atenção: prazos vencidos, metas atrasadas,
 * o que vence hoje, urgências do GAECO, réu preso e caixas ainda não lidas.
 * Um dia útil antes da meta de uma peça do GAECO, abre a mensagem com o aviso
 * "AMANHÃ É O DIA DE ENVIAR A PEÇA DO GAECO DO PROCESSO ...".
 * Se estiver tudo feito, manda os parabéns e o próximo prazo.
 *
 * CONFIGURAR (uma vez):
 *  1. @BotFather → /newbot → crie o bot (ex.: "Mesa de Prazos", usuário mesadeprazosjose_bot) e copie o token.
 *  2. Cole o token abaixo, salve e rode "configurar".
 *  3. Abra o bot no Telegram e mande /start.
 */
const TELEGRAM_TOKEN = '';

const ARQUIVO = 'mesa-de-prazos.json';
const FUSO = 'America/Fortaleza';
const SITE = 'https://eujoseo.github.io/mesa-de-prazos/';
const NOMES = { gaeco: 'GAECO', caapora: 'Caaporã', guarabira: 'Guarabira' };
const TIPOS = { relatorio: 'Relatório de audiência', pga: 'PGA de audiência', pgaout: 'PGA', outra: 'Urgência' };
const CHECK_TOTAL = { gaeco: 6, caapora: 2, guarabira: 7 };
const DIA = 864e5;

/* ═════════════ configuração ═════════════ */

function configurar() {
  if (!TELEGRAM_TOKEN) throw new Error('Cole o token do @BotFather na linha TELEGRAM_TOKEN, salve e rode de novo.');
  PropertiesService.getScriptProperties().setProperty('TG_TOKEN', TELEGRAM_TOKEN);
  lerMesa_();                                       // pede a autorização do Drive
  tg_('deleteWebhook', {});
  const me = tg_('getMe', {});
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('verificarTelegram').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('aviso6h').timeBased().everyDays(1).atHour(6).nearMinute(0).inTimezone(FUSO).create();
  ScriptApp.newTrigger('aviso14h').timeBased().everyDays(1).atHour(14).nearMinute(0).inTimezone(FUSO).create();
  ScriptApp.newTrigger('aviso21h').timeBased().everyDays(1).atHour(21).nearMinute(0).inTimezone(FUSO).create();
  Logger.log('Bot @' + me.result.username + ' pronto. Abra o Telegram e mande /start para ele.');
}

/* ═════════════ avisos agendados ═════════════ */

function aviso6h() { avisar_('manha'); }
function aviso14h() { avisar_('tarde'); }
function aviso21h() { avisar_('noite'); }

function avisar_(turno) {
  if (!PropertiesService.getScriptProperties().getProperty('TG_CHAT')) return;
  const r = analisar_(lerMesa_());
  // fim de semana, feriado e recesso: só avisa se houver algo vencido, atrasado ou urgente
  if (!r.utilHoje && !r.venc.length && !r.atras.length && !r.urg.length) return;
  enviar_(mensagem_(r, turno));
}

function mensagem_(r, turno) {
  // de manhã a rotina (ler caixas, checklist) ainda vai ser feita; à tarde e à noite ela conta
  const pend = turno === 'manha' ? r.pend : r.pend.concat(r.rotina);
  const emDia = !pend.length;
  const L = [];
  if (turno === 'manha') L.push('☀️ <b>Bom dia, José!</b> ' + dataExtenso_());
  else if (turno === 'tarde') L.push('🕑 <b>Como está a tarde?</b>');
  else L.push('🌙 <b>Fechamento do dia</b>');

  // um dia antes: peças do GAECO com meta no próximo dia útil (mesmo aviso da Mesa)
  if (r.avisos.length) {
    L.push('');
    r.avisos.forEach(function (a) { L.push('🔔 <b>' + esc_(a) + '</b>'); });
  }

  if (emDia) {
    L.push('');
    if (turno === 'noite') L.push('🎉 <b>Parabéns, você está em dia!</b> Tudo feito por hoje, pode descansar.');
    else if (turno === 'tarde') L.push('✅ <b>Parabéns, você está em dia!</b> Nada pendente para hoje.');
    else L.push('✅ <b>Você está em dia.</b> Nada vencido nem atrasado.');
    if (r.obs.length) L.push('👀 Para observar: ' + r.obs.join(' · '));
  } else {
    L.push('');
    L.push('⚠️ <b>Pendente:</b> ' + pend.join(' · '));
    if (r.obs.length) L.push('👀 <b>Observar:</b> ' + r.obs.join(' · '));
    const lista = r.lista.slice(0, 8);
    if (lista.length) {
      L.push('');
      lista.forEach(function (i) { L.push(linha_(i)); });
      if (r.lista.length > lista.length) L.push('<i>+' + (r.lista.length - lista.length) + ' na fila</i>');
    }
  }

  if (turno === 'manha' && r.utilHoje) {
    L.push('');
    L.push('🗂 <b>Roteiro:</b> ler as caixas (GAECO, Caaporã, Guarabira) e lançar na Mesa · 4h GAECO primeiro · 1h Caaporã · 1h Guarabira');
  }
    if (turno === 'noite' && !emDia) L.push('\n💪 Amanhã cedo começa por esses. Você consegue!');

  const prox = r.proximo;
  L.push('');
  L.push(prox ? '⏭ <b>Próximo prazo:</b> ' + rotulo_(prox) + ' · meta ' + br_(prox.meta) + (prox.prazoFinal ? ' (final ' + br_(prox.prazoFinal) + ')' : '') + ' · ' + prox.s.txt
              : '⏭ Nenhum prazo em aberto na Mesa.');
  L.push('\n<a href="' + SITE + '">Abrir a Mesa de Prazos</a>');
  return L.join('\n');
}

function linha_(i) {
  const ic = { vencido: '🔴', atrasado: '🔴', hoje: '🟠', amanha: '🟡', semana: '🔵', depois: '⚪', sem: '⚪' }[i.s.k];
  const preso = (i.flags || []).some(function (f) { return /preso/i.test(f); }) ? ' ⛓️' : '';
  const det = i.tipo === 'urgencia' ? 'até ' + br_(i.meta) + (i.descricao ? ' · ' + esc_(i.descricao) : '')
    : i.tipo === 'extra' ? 'encerramento ' + br_(i.vencimento)
    : 'meta ' + br_(i.meta) + ' · final ' + br_(i.prazoFinal) + (i.classe ? ' · ' + esc_(i.classe) : '');
  return ic + ' <b>' + rotulo_(i) + '</b>' + preso + ' — ' + i.s.txt + '\n     ' + det;
}
function rotulo_(i) {
  return i.tipo === 'urgencia' ? esc_((TIPOS[i.urgTipo] || 'Urgência') + (i.processo ? ' · ' + i.processo : ''))
    : esc_(NOMES[i.prom] + ' · ' + (i.processo || 'expediente'));
}

/* ═════════════ conversa (comandos) ═════════════ */

function verificarTelegram() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const up = tg_('getUpdates', { offset: +(props.getProperty('TG_OFFSET') || 0), timeout: 0, allowed_updates: ['message'] });
    (up.result || []).forEach(function (u) {
      props.setProperty('TG_OFFSET', String(u.update_id + 1));
      const msg = u.message; if (!msg || !msg.text) return;
      const chat = String(msg.chat.id);
      let dono = props.getProperty('TG_CHAT');
      if (!dono && /^\/start/.test(msg.text)) { props.setProperty('TG_CHAT', chat); dono = chat; }
      if (chat !== dono) return;
      let resp;
      try { resp = responder_(msg.text.trim().toLowerCase()); } catch (e) { resp = '⚠️ ' + (e && e.message || e); }
      enviar_(resp);
    });
  } finally { lock.releaseLock(); }
}

function responder_(t) {
  if (/^\/start|^\/ajuda|^\/help/.test(t)) return '👋 Oi, José! Eu sou o bot da <b>Mesa de Prazos</b>.\n\nTe aviso às <b>6h</b>, <b>14h</b> e <b>21h</b> (dias úteis; fins de semana só se houver algo urgente).\n\nComandos:\n/agora — situação neste momento\n/proximos — próximos 10 prazos\n/gaeco, /caapora, /guarabira — prazos de cada promotoria';
  const r = analisar_(lerMesa_());
  if (/^\/agora/.test(t)) return mensagem_(r, 'tarde');
  if (/^\/proximos/.test(t)) {
    const l = r.ab.filter(function (i) { return i.meta; }).sort(function (a, b) { return a.s.ord - b.s.ord || a.meta.localeCompare(b.meta); }).slice(0, 10);
    return l.length ? '📅 <b>Próximos prazos</b>\n\n' + l.map(linha_).join('\n') : 'Nenhum prazo em aberto. 🎉';
  }
  const p = (t.match(/^\/(gaeco|caapora|caaporã|guarabira)/) || [])[1];
  if (p) {
    const k = p.replace('ã', 'a');
    const l = r.ab.filter(function (i) { return i.prom === k; }).sort(function (a, b) { return a.s.ord - b.s.ord || (a.meta || '9').localeCompare(b.meta || '9'); });
    return l.length ? '🗂 <b>' + NOMES[k] + '</b> — ' + l.length + ' em aberto\n\n' + l.slice(0, 15).map(linha_).join('\n') : '✅ ' + NOMES[k] + ': nada em aberto.';
  }
  return 'Não entendi. Mande /ajuda para ver os comandos.';
}

/* ═════════════ análise (mesma lógica do widget da Mesa) ═════════════ */

function analisar_(j) {
  const cfg = j.cfg || {}, h = iso_(hoje_()), utilHoje = util_(hoje_(), cfg);
  const itens = j.itens || [];
  const ab = itens.filter(function (i) { return i.status !== 'feito'; }).map(function (i) { return Object.assign({}, i, { s: situacao_(i, cfg) }); });
  const urg = ab.filter(function (i) { return i.tipo === 'urgencia'; });
  const venc = ab.filter(function (i) { return i.s.k === 'vencido'; }), atras = ab.filter(function (i) { return i.s.k === 'atrasado'; }), deHoje = ab.filter(function (i) { return i.s.k === 'hoje'; });
  const pend = [], obs = [];
  if (venc.length) pend.push(venc.length + ' com prazo vencido');
  if (atras.length) pend.push(atras.length + ' com meta passada');
  if (deHoje.length) pend.push(deHoje.length + ' para hoje');
  const ck = (j.check || {})[h] || {};
  const feitosCk = Object.keys(ck).filter(function (k) { return ck[k]; }).length;
  const totalCk = Object.keys(CHECK_TOTAL).reduce(function (a, k) { return a + CHECK_TOTAL[k]; }, 0);
  const rotina = [];
  if (utilHoje && feitosCk < totalCk) rotina.push('checklist de análise ' + feitosCk + '/' + totalCk);
  const presos = ab.filter(function (i) { return (i.flags || []).some(function (f) { return /preso/i.test(f); }); });
  if (presos.length) obs.push(presos.length + ' com réu preso');
  const naCaixa = itens.filter(function (i) { return i.status === 'feito' && i.aindaNaCaixa && i.aindaNaCaixa > (i.feitoMs || 0); });
  if (naCaixa.length) obs.push(naCaixa.length + ' feito ainda na caixa');
  let naoLidas = [];
  if (utilHoje) {
    naoLidas = Object.keys(NOMES).filter(function (p) { const l = (cfg.leituras || {})[p + '_judicial']; return !l || iso_(new Date(l)) !== h; }).map(function (p) { return NOMES[p]; });
    if (naoLidas.length) rotina.push('caixa não lida: ' + naoLidas.join(', '));
  }
  const lista = ab.filter(function (i) { return i.s.ord <= 4 || i.tipo === 'urgencia'; })
    .sort(function (a, b) { return a.s.ord - b.s.ord || (a.meta || '9').localeCompare(b.meta || '9'); });
  const proximo = ab.filter(function (i) { return i.meta && i.meta.slice(0, 10) >= h; })
    .sort(function (a, b) { return a.meta.localeCompare(b.meta); })[0] || null;
  return { cfg: cfg, ab: ab, urg: urg, venc: venc, atras: atras, pend: pend, rotina: rotina, obs: obs, lista: lista, naoLidas: naoLidas, proximo: proximo, utilHoje: utilHoje, avisos: avisosGaeco_(ab, cfg) };
}

/* Aviso de um dia antes: GAECO com meta no próximo dia útil (igual ao aviso do painel da Mesa). */
function avisosGaeco_(ab, cfg) {
  const h = hoje_();
  let nx = new Date(h.getTime() + DIA); while (!util_(nx, cfg)) nx = new Date(nx.getTime() + DIA);
  const nxIso = iso_(nx);
  const sem = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
  const quando = Math.round((nx - h) / DIA) === 1 ? 'AMANHÃ' : sem[nx.getDay()] + ' (' + br_(nxIso) + ')';
  return ab.filter(function (i) { return i.prom === 'gaeco' && i.tipo !== 'tram30' && i.meta && i.meta.slice(0, 10) === nxIso; })
    .map(function (i) {
      const proc = i.processo ? ' DO PROCESSO ' + i.processo : '';
      return i.tipo === 'urgencia'
        ? quando + ' É O DIA DE ENVIAR ' + (TIPOS[i.urgTipo] || 'A URGÊNCIA').toUpperCase() + ' DO GAECO' + proc
        : quando + ' É O DIA DE ENVIAR A PEÇA DO GAECO' + proc;
    });
}

function situacao_(it, cfg) {
  const h = hoje_(), meta = fromISO_(it.meta), pf = fromISO_(it.prazoFinal);
  if (pf && pf < h) return { k: 'vencido', txt: 'PRAZO VENCIDO', ord: 0 };
  if (!meta) return { k: 'sem', txt: 'sem data', ord: 9 };
  if (meta < h) return { k: 'atrasado', txt: 'meta há ' + Math.round((h - meta) / DIA) + 'd', ord: 1 };
  if (+meta === +h) return { k: 'hoje', txt: 'HOJE', ord: 2 };
  const du = diasUteisAte_(meta, cfg);
  if (du <= 1) return { k: 'amanha', txt: 'próx. dia útil', ord: 3 };
  return { k: du <= 3 ? 'semana' : 'depois', txt: 'em ' + du + ' d.u.', ord: du <= 3 ? 4 : 5 };
}

function pascoa_(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(y, mes - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function feriados_(y, extras) {
  const s = {};
  ['01-01', '04-21', '05-01', '08-05', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].forEach(function (md) { s[y + '-' + md] = 1; });
  const p = pascoa_(y);
  [-48, -47, -2, 60].forEach(function (n) { s[iso_(new Date(p.getTime() + n * DIA))] = 1; });
  (extras || []).forEach(function (x) { const q = x.split('/'); s[q[2] + '-' + q[1] + '-' + q[0]] = 1; });
  return s;
}
function util_(d, cfg) {
  const w = d.getDay(); if (w === 0 || w === 6) return false;
  const m = d.getMonth() + 1, dd = d.getDate();
  if (cfg.recessoUteis !== false && ((m === 12 && dd >= 20) || (m === 1 && dd <= 20))) return false;
  return !feriados_(d.getFullYear(), cfg.feriadosExtras)[iso_(d)];
}
function diasUteisAte_(alvo, cfg) {
  const h = hoje_(); if (alvo <= h) return 0;
  let n = 0, x = new Date(h); while (x < alvo) { x = new Date(x.getTime() + DIA); if (util_(x, cfg)) n++; }
  return n;
}

/* ═════════════ Drive e Telegram ═════════════ */

function textoMesa_() {
  const it = DriveApp.getFilesByName(ARQUIVO);
  let arq = null;
  while (it.hasNext()) { const f = it.next(); if (f.isTrashed()) continue; if (!arq || f.getLastUpdated() > arq.getLastUpdated()) arq = f; }
  if (!arq) throw new Error('Não achei "' + ARQUIVO + '" no Drive. Conecte o Drive na Mesa de Prazos.');
  return arq.getBlob().getDataAsString('UTF-8');
}
function lerMesa_() { return JSON.parse(textoMesa_()); }

/* ═════════════ widget do iPhone ═════════════
 * O app Google Drive do iPhone não atualiza sozinho a cópia do arquivo que o Scriptable lê,
 * então o widget busca o JSON direto daqui.
 * 1. Rode "ligarWidget" uma vez e copie a chave do registro de execução.
 * 2. Implantar › Nova implantação › Tipo: App da Web › Executar como: Eu › Quem pode acessar: Qualquer pessoa › Implantar.
 * 3. Copie o URL do app da Web (termina em /exec) e acrescente ?k=CHAVE.
 * 4. No Scriptable, rode o script "Mesa de Prazos" (▶) uma vez e cole esse endereço quando ele pedir.
 */
function ligarWidget() {
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty('WIDGET_KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); props.setProperty('WIDGET_KEY', k); }
  textoMesa_();
  Logger.log('Chave do widget: ' + k + '\nEndereço para o Scriptable: URL_DO_APP_DA_WEB?k=' + k);
}
function doGet(e) {
  const k = PropertiesService.getScriptProperties().getProperty('WIDGET_KEY');
  const saida = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  if (!k || !e || !e.parameter || e.parameter.k !== k) return saida.setContent(JSON.stringify({ erro: 'chave inválida' }));
  try { return saida.setContent(textoMesa_()); } catch (err) { return saida.setContent(JSON.stringify({ erro: String(err.message || err) })); }
}
function tg_(metodo, corpo) {
  const token = PropertiesService.getScriptProperties().getProperty('TG_TOKEN') || TELEGRAM_TOKEN;
  if (!token) throw new Error('Bot sem token. Rode configurar.');
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + metodo, { method: 'post', contentType: 'application/json', payload: JSON.stringify(corpo), muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText()); if (!j.ok) throw new Error('Telegram: ' + j.description); return j;
}
function enviar_(texto) {
  const chat = PropertiesService.getScriptProperties().getProperty('TG_CHAT'); if (!chat) return;
  tg_('sendMessage', { chat_id: chat, text: texto, parse_mode: 'HTML', disable_web_page_preview: true });
}

/* ═════════════ datas ═════════════ */

function hoje_() { const s = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd'); return fromISO_(s); }
function iso_(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function fromISO_(s) { if (!s) return null; const p = s.slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function br_(s) { const d = fromISO_(s); return d ? ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) : '—'; }
function dataExtenso_() {
  const d = hoje_(), dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  return '(' + dias[d.getDay()] + ', ' + br_(iso_(d)) + ')';
}
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
