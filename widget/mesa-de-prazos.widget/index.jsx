// Mesa de Prazos — widget para o Übersicht (macOS)
// Lê o arquivo mesa-de-prazos.json que a Mesa grava no Google Drive
// (sincronizado no Mac pelo app "Google Drive para computador").

export const refreshFrequency = 5 * 60 * 1000; // a cada 5 minutos

export const command = `
F=""
for d in "$HOME"/Library/CloudStorage/GoogleDrive-*; do
  [ -d "$d" ] || continue
  F=$(find "$d" -maxdepth 5 -name 'mesa-de-prazos.json' -print 2>/dev/null | head -n 1)
  [ -n "$F" ] && break
done
if [ -z "$F" ]; then echo '{"erro":"nao-achei"}'; else cat "$F"; fi
`;

// ---------- datas ----------
const DIA = 864e5;
const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const fx = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map(md => `${y}-${md}`);
  const p = pascoa(y), mv = [-48, -47, -2, 60].map(n => toISO(new Date(p.getTime() + n * DIA)));
  const ex = (extras || []).map(s => { const [d, m, a] = s.split('/'); return `${a}-${m}-${d}`; });
  return new Set([...fx, ...mv, ...ex]);
}
function util(d, cfg) {
  const w = d.getDay(); if (w === 0 || w === 6) return false;
  const m = d.getMonth() + 1, dd = d.getDate();
  if (cfg.recessoUteis !== false && ((m === 12 && dd >= 20) || (m === 1 && dd <= 6))) return false;
  return !feriados(d.getFullYear(), cfg.feriadosExtras).has(toISO(d));
}
function diasUteisAte(alvo, cfg) {
  const h = hoje(); if (alvo <= h) return 0;
  let n = 0, x = new Date(h); while (x < alvo) { x = new Date(x.getTime() + DIA); if (util(x, cfg)) n++; }
  return n;
}

// ---------- regras ----------
const NOMES = { gaeco: 'GAECO', caapora: 'Caaporã', guarabira: 'Guarabira' };
const REGRA = { gaeco: '4 d.u. antes do prazo', caapora: '1 d.u. antes da ciência', guarabira: '1 dia antes do prazo' };

function situacao(it, cfg) {
  const h = hoje(), meta = fromISO(it.meta), pf = fromISO(it.prazoFinal);
  if (pf && pf < h) return { k: 'vencido', txt: 'PRAZO VENCIDO', ord: 0 };
  if (!meta) return { k: 'sem', txt: 'sem data', ord: 9 };
  if (meta < h) { const d = Math.round((h - meta) / DIA); return { k: 'atrasado', txt: `meta passou há ${d}d`, ord: 1 }; }
  if (+meta === +h) return { k: 'hoje', txt: it.prom === 'caapora' && it.limiteCiencia && fromISO(it.limiteCiencia) < h ? 'IMEDIATO' : 'ENTREGAR HOJE', ord: 2 };
  const du = diasUteisAte(meta, cfg);
  if (du <= 1) return { k: 'amanha', txt: 'próximo dia útil', ord: 3 };
  if (du <= 3) return { k: 'semana', txt: `em ${du} dias úteis`, ord: 4 };
  return { k: 'depois', txt: `em ${du} dias úteis`, ord: 5 };
}

function lidaHoje(cfg, chave) {
  const v = (cfg.leituras || {})[chave]; if (!v) return false;
  return toISO(new Date(v)) === toISO(hoje());
}

// ---------- visual ----------
export const className = `
  top: 28px; right: 24px; width: 380px;
  font-family: -apple-system, "SF Pro Text", Helvetica, sans-serif;
  color: #f4f1ea; font-size: 12px; line-height: 1.35;
  background: rgba(24, 22, 20, 0.78);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
  padding: 14px 16px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35);
  h1 { font-size: 14px; margin: 0; font-weight: 700; letter-spacing: .2px }
  .sub { color: #b9b2a5; font-size: 11px }
  .topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px }
  .proms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px }
  .pc { background: rgba(255,255,255,.06); border-radius: 10px; padding: 7px 8px }
  .pc b { font-size: 18px; display: block; line-height: 1.1 }
  .pc .n { font-size: 11px; font-weight: 600 }
  .pc .r { font-size: 9.5px; color: #a39c90 }
  .cx { font-size: 10px; margin-top: 4px }
  .ok { color: #8fd18a } .pend { color: #ffb15c }
  .lista { display: grid; gap: 4px }
  .it { display: grid; grid-template-columns: 6px 1fr auto; gap: 8px; align-items: center;
        padding: 6px 8px; border-radius: 9px; background: rgba(255,255,255,.04) }
  .bar { width: 6px; height: 28px; border-radius: 3px }
  .t { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px }
  .d { color: #b9b2a5; font-size: 10.5px }
  .q { text-align: right; font-weight: 700; font-size: 11px; white-space: nowrap }
  .vencido .bar, .atrasado .bar { background: #ff5a4e } .vencido .q, .atrasado .q { color: #ff7a70 }
  .hoje .bar { background: #ff9f2e } .hoje .q { color: #ffb15c }
  .amanha .bar { background: #ffd23f } .amanha .q { color: #ffdf6e }
  .semana .bar { background: #6fb6ff } .depois .bar, .sem .bar { background: #6d675e }
  .vazio { color: #b9b2a5; padding: 8px 0 }
  .mais { color: #a39c90; font-size: 10.5px; margin-top: 6px; text-align: right }
  .erro { color: #ffb15c }
`;

export const render = ({ output, error }) => {
  if (error) return <div className="erro">Erro ao ler a Mesa: {String(error)}</div>;
  let j; try { j = JSON.parse(output); } catch (e) { return <div className="erro">Aguardando a Mesa de Prazos…</div>; }
  if (j.erro) return (
    <div>
      <h1>Mesa de Prazos</h1>
      <div className="erro" style={{ marginTop: 6 }}>Não achei o arquivo <b>mesa-de-prazos.json</b>. Confira se o Google Drive para computador está aberto e se a Mesa está conectada ao Drive.</div>
    </div>
  );

  const cfg = j.cfg || {};
  const pend = (j.itens || []).filter(i => i.status !== 'feito').map(i => ({ ...i, s: situacao(i, cfg) }))
    .sort((a, b) => a.s.ord - b.s.ord || (a.meta || '9').localeCompare(b.meta || '9'));
  const urgentes = pend.filter(i => i.s.ord <= 4);
  const mostrar = (urgentes.length ? urgentes : pend).slice(0, 9);
  const salvo = j.salvoEm ? new Date(j.salvoEm) : null;
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div>
      <div className="topo">
        <h1>Mesa de Prazos</h1>
        <span className="sub">{dataHoje}</span>
      </div>

      <div className="proms">
        {['gaeco', 'caapora', 'guarabira'].map(p => {
          const lst = pend.filter(i => i.prom === p);
          const crit = lst.filter(i => i.s.ord <= 3).length;
          const lida = lidaHoje(cfg, p + '_judicial');
          return (
            <div className="pc" key={p}>
              <span className="n">{NOMES[p]}</span>
              <b>{lst.length}{crit ? <span style={{ fontSize: 11, color: '#ff9f2e' }}> · {crit} já</span> : null}</b>
              <div className="r">{REGRA[p]}</div>
              <div className={'cx ' + (lida ? 'ok' : 'pend')}>{lida ? '✓ caixa lida hoje' : '● ler a caixa hoje'}</div>
            </div>
          );
        })}
      </div>

      <div className="lista">
        {mostrar.length === 0 && <div className="vazio">Nada pendente. Mesa limpa ✨</div>}
        {mostrar.map(i => (
          <div className={'it ' + i.s.k} key={i.id}>
            <span className="bar" />
            <div>
              <div className="t">{NOMES[i.prom] || i.prom} · {i.processo || i.expediente || 'expediente'}</div>
              <div className="d">meta {br(i.meta)} · prazo final {br(i.prazoFinal)}{i.classe ? ' · ' + i.classe : ''}</div>
            </div>
            <div className="q">{i.s.txt}</div>
          </div>
        ))}
      </div>

      <div className="mais">
        {pend.length > mostrar.length ? `+${pend.length - mostrar.length} mais adiante · ` : ''}
        {salvo ? `atualizado ${salvo.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
      </div>
    </div>
  );
};
