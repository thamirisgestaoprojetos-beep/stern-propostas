// STERN — app.js
const LS={get:k=>{try{return JSON.parse(localStorage.getItem('stern_'+k));}catch(e){return null;}},set:(k,v)=>localStorage.setItem('stern_'+k,JSON.stringify(v))};

function getDB(){return window._db;}
function getAuth2(){return window._auth;}
function fbDoc(...a){return window._fbFns.doc(...a);}
function fbSetDoc(...a){return window._fbFns.setDoc(...a);}
function fbGetDoc(...a){return window._fbFns.getDoc(...a);}

let proposals=[],nextNum=1,isRev=false,revBase=null;
let chartInst={},sKey='numSort',sDir=-1,blSKey='numSort',blSDir=-1;
let currentUser=null,colF={},blColF={},impRows=[],impMode='add';

let cfg={
  gestores:['ALESSANDRA AMARAL','BRUNO BUENO','THAMIRIS SILVA','LARA ONGARO','DIEGO COSTA','OUTROS'],
  statusList:['AG. DEFINIÇÃO','VENCIDA','PERDIDA','CANCELADA','SEM RETORNO','BUDGET','DECLINADA'],
  visibleCols:['num','contratante','escopo','data','resultado','gestor','segmento','valor']
};

const ALL_COLS=[
  {key:'num',label:'Nº',always:true},{key:'rev',label:'Rev.',always:false},
  {key:'contratante',label:'Contratante',always:true},{key:'cnpj',label:'CNPJ',always:false},
  {key:'cliente',label:'Cliente Final',always:false},{key:'convite',label:'Convite',always:false},
  {key:'escopo',label:'Escopo',always:true},{key:'data',label:'Data',always:true},
  {key:'descricao',label:'Descrição',always:false},{key:'cidade',label:'Cidade',always:false},
  {key:'uf',label:'UF',always:false},{key:'resultado',label:'Resultado',always:true},
  {key:'gestor',label:'Gestor',always:true},{key:'orex',label:'OREX',always:false},
  {key:'prazo',label:'Prazo',always:false},{key:'tipo',label:'Tipo',always:false},
  {key:'segmento',label:'Segmento',always:true},{key:'nome',label:'Contato',always:false},
  {key:'telefone',label:'Telefone',always:false},{key:'email',label:'E-mail',always:false},
  {key:'projeto',label:'Projeto',always:false},{key:'valor',label:'Valor Total',always:true},
  {key:'status',label:'Status Neg.',always:false}
];

const STC={'VENCIDA':'#1a7a3e','PERDIDA':'#991b1b','AG. DEFINIÇÃO':'#b45309','CANCELADA':'#374151','SEM RETORNO':'#4c1d95','BUDGET':'#9a3412','DECLINADA':'#7c3aed'};

// ── AUTH ──────────────────────────────────────────────────
function swTab(t, el){
  document.querySelectorAll('.atab').forEach(b=>b.classList.remove('active'));
  const btn = el || document.querySelector(`.atab[onclick*="${t}"]`);
  if(btn) btn.classList.add('active');
  document.getElementById('lform').style.display=t==='login'?'flex':'none';
  document.getElementById('rform').style.display=t==='register'?'flex':'none';
  document.getElementById('aerr').style.display='none';
}
function doLogin(){
  const em=document.getElementById('lem').value.trim(),pw=document.getElementById('lpw').value;
  const err=document.getElementById('aerr');
  if(!em||!pw){err.textContent='Preencha e-mail e senha.';err.style.display='block';return;}
  err.style.display='none';
  window._fbFns.signInWithEmailAndPassword(getAuth2(),em,pw)
    .then(uc=>{currentUser={email:uc.user.email,name:uc.user.email.split('@')[0]};startApp();})
    .catch(()=>{err.textContent='E-mail ou senha incorretos.';err.style.display='block';});
}
function doReg(){
  const err=document.getElementById('aerr');
  err.textContent='Cadastro de novos usuários é feito pelo administrador do sistema.';err.style.display='block';
}
function doLogout(){
  window._fbFns.signOut(getAuth2());
  currentUser=null;
  document.getElementById('app').style.display='none';
  document.getElementById('auth').style.display='flex';
}

// ── INIT ─────────────────────────────────────────────────
async function startApp(){
  document.getElementById('auth').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('udsp').textContent=currentUser.name||currentUser.email;
  const cfgDoc=await fbGetDoc(fbDoc(getDB(),'stern','config'));
  if(cfgDoc.exists())cfg={...cfg,...cfgDoc.data()};
  const propDoc=await fbGetDoc(fbDoc(getDB(),'stern','proposals'));
  if(propDoc.exists()&&propDoc.data().list&&propDoc.data().list.length>0){
    proposals=propDoc.data().list;
  } else {
    proposals=DEMO_DATA.map(d=>({...d}));
    saveProp();
  }
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('fdt').value=today;
  document.getElementById('ddf').value=today.slice(0,4)+'-01-01';
  document.getElementById('ddt').value=today;
  updNN();popG();renderColCfg();renderGTags();renderSTags();
}
function saveProp(){fbSetDoc(fbDoc(getDB(),'stern','proposals'),{list:proposals}).catch(e=>console.error('saveProp:',e));}
function saveCfg(){fbSetDoc(fbDoc(getDB(),'stern','config'),cfg).catch(e=>console.error('saveCfg:',e));}
function updNN(){
  const mx=proposals.reduce((m,p)=>Math.max(m,parseInt(p.num)||0),0);
  nextNum=mx+1;
  document.getElementById('nnum').textContent=nextNum;
}

// ── SUBMIT ────────────────────────────────────────────────
function submitProp(){
  const req=['fc','fcl','fes','fdt','fde','fci','fuf','frs','fge','fsg','fvl'];
  let ok=true;
  req.forEach(id=>{const el=document.getElementById(id);if(!el.value){el.classList.add('err');ok=false;}else el.classList.remove('err');});
  if(!ok){showAlert('Preencha todos os campos obrigatórios.','wn');return;}
  let numStr,revStr='',numSort;
  if(isRev){const cnt=proposals.filter(p=>String(p.num)===String(revBase)).length;numStr=revBase+'.'+cnt;revStr='Rev.'+cnt;numSort=parseFloat(revBase+'.'+cnt);}
  else{numStr=String(nextNum);numSort=nextNum;}
  const res=vv('frs');
  proposals.push({_id:rndId(),num:isRev?String(revBase):String(nextNum),displayNum:numStr,rev:revStr,numSort,
    cnpj:vv('fcnpj'),contratante:vv('fc'),cliente:vv('fcl'),convite:vv('fcv'),
    escopo:vv('fes'),data:vv('fdt'),descricao:vv('fde'),cidade:vv('fci'),
    uf:vv('fuf'),resultado:res,gestor:vv('fge'),orex:vv('fox'),
    prazo:vv('fpr'),tipo:vv('ftp'),segmento:vv('fsg'),nome:vv('fnm'),
    telefone:vv('fte'),email:vv('fem'),projeto:vv('fpj'),
    valor:parseFloat(vv('fvl'))||0,status:res,prob:res==='VENCIDA'?100:0,
    criadoPor:currentUser.name||currentUser.email});
  saveProp();updNN();
  showAlert('Proposta '+numStr+' gerada com sucesso!','ok');
  clrForm();clrRev();
}
function vv(id){return document.getElementById(id)?.value||'';}
function rndId(){return Math.random().toString(36).slice(2,12);}

// ── REVISION ─────────────────────────────────────────────
function setRev(){
  const base=document.getElementById('rbin').value;if(!base)return;
  const f=proposals.find(p=>String(p.num)===String(base)&&!p.rev);
  if(!f){showAlert('Proposta '+base+' não encontrada.','wn');return;}
  isRev=true;revBase=base;
  document.getElementById('rvbox').style.display='flex';
  document.getElementById('rvnum').textContent=base;
  const cnt=proposals.filter(p=>String(p.num)===String(base)).length;
  document.getElementById('nnum').textContent=base+'.'+cnt;
  const fm={fc:'contratante',fcl:'cliente',fcv:'convite',fde:'descricao',fci:'cidade',fvl:'valor',fox:'orex',fpr:'prazo',fnm:'nome',fte:'telefone',fem:'email',fcnpj:'cnpj'};
  Object.entries(fm).forEach(([id,k])=>{const el=document.getElementById(id);if(el)el.value=f[k]||'';});
  ['fes','fuf','frs','fge','fsg','ftp','fpj'].forEach(id=>{
    const el=document.getElementById(id);
    const km={fes:'escopo',fuf:'uf',frs:'resultado',fge:'gestor',fsg:'segmento',ftp:'tipo',fpj:'projeto'};
    if(el&&f[km[id]])el.value=f[km[id]];
  });
}
function clrRev(){isRev=false;revBase=null;document.getElementById('rvbox').style.display='none';document.getElementById('rbin').value='';document.getElementById('nnum').textContent=nextNum;}
function clrForm(){
  ['fc','fcnpj','fcl','fcv','fde','fci','fvl','fox','fpr','fnm','fte','fem'].forEach(id=>{const el=document.getElementById(id);if(el){el.value='';el.classList.remove('err');}});
  ['fes','fuf','frs','fge','fsg','ftp','fpj'].forEach(id=>{const el=document.getElementById(id);if(el){el.value='';el.classList.remove('err');}});
}

// ── TABLE ─────────────────────────────────────────────────
function getFilterableCols(){
  return ALL_COLS.filter(c=>!['rev','status'].includes(c.key));
}
function getUniqueOptions(key){
  const vals=[...new Set(proposals.map(p=>String(p[key]??'').trim()).filter(Boolean))];
  return vals.sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}));
}
let tableFilterTimer=null;
function setcF(k,v,part=null,delay=false){
  if(part){
    const cur=(typeof colF[k]==='object' && colF[k]!==null)?colF[k]:{};
    cur[part]=v;
    if(Object.values(cur).every(x=>x===''||x===null||x===undefined)) delete colF[k];
    else colF[k]=cur;
  }else{
    if(v===undefined||v===null||v==='') delete colF[k];
    else colF[k]=v;
  }
  if(delay){
    clearTimeout(tableFilterTimer);
    tableFilterTimer=setTimeout(()=>renderTable(),180);
  }else{
    renderTable();
  }
}
function clearTableFilters(){
  colF={};
  const gs=document.getElementById('gsrch'); if(gs) gs.value='';
  const ano=document.getElementById('ftano'); if(ano) ano.value='';
  renderAdvancedFilters();
  renderTable();
}
function matchesFilter(row,key,filter){
  const val=row[key];
  const sval=String(val??'').trim();
  if(filter===undefined||filter===null||filter==='') return true;
  if(typeof filter==='string') return sval.toLowerCase().includes(filter.toLowerCase());
  if(typeof filter==='object'){
    if(key==='data'){
      const d=(sval||'').slice(0,10);
      if(filter.from && (!d || d<filter.from)) return false;
      if(filter.to && (!d || d>filter.to)) return false;
      return true;
    }
    if(key==='valor'){
      const n=parseFloat(val)||0;
      if(filter.min!=='' && filter.min!=null && n < (parseFloat(filter.min)||0)) return false;
      if(filter.max!=='' && filter.max!=null && n > (parseFloat(filter.max)||0)) return false;
      return true;
    }
    if(filter.mode==='select'){
      if(!filter.value) return true;
      return sval===String(filter.value);
    }
    if(filter.value) return sval.toLowerCase().includes(String(filter.value).toLowerCase());
    return true;
  }
  return true;
}
function renderAdvancedFilters(){
  const host=document.getElementById('advFilters');
  if(!host) return;
  const selectKeys=new Set(['escopo','uf','resultado','gestor','orex','tipo','segmento','projeto']);
  const cols=getFilterableCols();
  host.innerHTML=`<div class="fg">${cols.map(c=>{
    const f=colF[c.key];
    if(c.key==='data'){
      return `<div class="fi" style="grid-column:span 2"><label>${c.label} de / até</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><input type="date" value="${(f&&f.from)||''}" onchange="setcF('${c.key}',this.value,'from')"><input type="date" value="${(f&&f.to)||''}" onchange="setcF('${c.key}',this.value,'to')"></div></div>`;
    }
    if(c.key==='valor'){
      return `<div class="fi" style="grid-column:span 2"><label>${c.label} min / max</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><input type="number" step="0.01" placeholder="Min" value="${(f&&f.min)||''}" oninput="setcF('${c.key}',this.value,'min',true)"><input type="number" step="0.01" placeholder="Max" value="${(f&&f.max)||''}" oninput="setcF('${c.key}',this.value,'max',true)"></div></div>`;
    }
    if(selectKeys.has(c.key)){
      const current=typeof f==='object' ? (f.value||'') : (f||'');
      const opts=getUniqueOptions(c.key);
      return `<div class="fi"><label>${c.label}</label><select onchange="setcF('${c.key}',this.value)"><option value="">Todos</option>${opts.map(v=>`<option value="${esc(v)}" ${current===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`;
    }
    const current=typeof f==='object' ? (f.value||'') : (f||'');
    return `<div class="fi"><label>${c.label}</label><input type="text" placeholder="Filtrar ${c.label.toLowerCase()}" value="${esc(current)}" oninput="setcF('${c.key}',this.value,null,true)"></div>`;
  }).join('')}</div>`;
}
function getTblData(){
  const gs=(document.getElementById('gsrch')?.value||'').toLowerCase();
  const ano=document.getElementById('ftano')?.value||'';
  const filtered=proposals.filter(p=>{
    if(gs&&!JSON.stringify(p).toLowerCase().includes(gs))return false;
    if(ano&&!(p.data||'').startsWith(ano))return false;
    for(const [k,v] of Object.entries(colF)){ if(!matchesFilter(p,k,v)) return false; }
    return true;
  });
  const k=sKey;
  filtered.sort((a,b)=>{
    let av=a[k]||'',bv=b[k]||'';
    if(k==='valor'||k==='numSort'||k==='prob'){av=parseFloat(av)||0;bv=parseFloat(bv)||0;}
    if(av>bv)return sDir;
    if(av<bv)return -sDir;
    return 0;
  });
  return filtered;
}

function renderTable(){
  const data=getTblData();
  const cols=ALL_COLS.filter(c=>cfg.visibleCols.includes(c.key));

  let hh='<tr class="hrow">'+cols.map(c=>`<th class="s" onclick="doSort('${c.key}')">${c.label}${sKey===c.key?(sDir===-1?' ▼':' ▲'):''}</th>`).join('')+'<th>Ações</th></tr>';
  hh+='<tr class="frow">'+cols.map(c=>`<th style="color:rgba(255,255,255,.75);font-size:10px">Filtro acima</th>`).join('')+'<th></th></tr>';
  document.getElementById('thd').innerHTML=hh;

  let bh='';
  data.forEach(row=>{
    bh+='<tr>';
    cols.forEach(c=>{
      if(c.key==='num'){
        bh+=`<td><strong style="color:var(--sd)">${row.displayNum||row.num}</strong>${row.rev?`<span class="rvtag">${row.rev}</span>`:''}</td>`;
      }else if(c.key==='resultado'||c.key==='status'){
        const v=row[c.key]||'';
        const cls=v==='VENCIDA'?'venc':v==='PERDIDA'?'perd':'';
        bh+=`<td><select class="${cls}" onchange="editRow('${row._id}','${c.key}',this.value);updResColor(this)">${cfg.statusList.map(s=>`<option ${v===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
      }else if(c.key==='valor'){
        bh+=`<td style="text-align:right;font-weight:600">R$ ${fmtBRL(row.valor)}</td>`;
      }else if(c.key==='data'){
        bh+=`<td>${fmtDate(row.data)}</td>`;
      }else{
        bh+=`<td><input value="${esc(row[c.key]||'')}" onchange="editRow('${row._id}','${c.key}',this.value)"></td>`;
      }
    });
    bh+=`<td><button class="btn dng" onclick="delRow('${row._id}')">Del</button></td></tr>`;
  });

  document.getElementById('tbd').innerHTML=bh||'<tr><td colspan="99" style="text-align:center;padding:24px;color:var(--sg)">Nenhuma proposta encontrada.</td></tr>';
  const totV=data.reduce((s,p)=>s+(p.valor||0),0);
  document.getElementById('tfoot').textContent=`${data.length} proposta(s) de ${proposals.length} • Valor filtrado: R$ ${fmtBRL(totV)}`;
}
// ── EXPORT PAINEL ─────────────────────────────────────────
function expExcel(){
  const data=getTblData();
  if(!data.length){showAlert('Sem dados para exportar.','wn');return;}
  const rows=data.map(p=>{
    const obj={'Nº':p.displayNum||p.num,'Revisão':p.rev||''};
    ALL_COLS.filter(c=>c.key!=='num'&&c.key!=='rev').forEach(c=>{
      if(c.key==='valor')obj['Valor Total']=p.valor;
      else if(c.key==='data')obj['Data']=fmtDate(p.data);
      else obj[c.label]=p[c.key]||'';
    });
    return obj;
  });
  xlsxExport(rows,'PROPOSTAS',`STERN_Propostas_${today()}.xlsx`);
}

// ── BACKLOG ───────────────────────────────────────────────
const BL_COLS=[
  {key:'num',label:'Nº'},{key:'contratante',label:'Contratante'},
  {key:'escopo',label:'Escopo'},{key:'data',label:'Data'},
  {key:'gestor',label:'Gestor'},{key:'resultado',label:'Resultado'},
  {key:'valor',label:'Valor Total'},{key:'prob',label:'% Prob.'},
  {key:'vbl',label:'Valor Backlog'}
];

function getBlData(){
  const sr=(document.getElementById('blsrch')?.value||'').toLowerCase();
  const ge=document.getElementById('blges')?.value||'';
  const re=document.getElementById('blres')?.value||'';
  const filtered=proposals.filter(p=>{
    if(sr&&!JSON.stringify(p).toLowerCase().includes(sr))return false;
    if(ge&&p.gestor!==ge)return false;
    if(re&&p.resultado!==re&&p.status!==re)return false;
    for(const[k,v] of Object.entries(blColF)){if(v&&!String(p[k]||'').toLowerCase().includes(v.toLowerCase()))return false;}
    return true;
  });
  const k=blSKey;
  filtered.sort((a,b)=>{
    let av=a[k]||'',bv=b[k]||'';
    if(k==='valor'||k==='numSort'||k==='prob'){av=parseFloat(av)||0;bv=parseFloat(bv)||0;}
    if(av>bv)return blSDir;
    if(av<bv)return -blSDir;
    return 0;
  });
  return filtered;
}

function renderBacklog(){
  const data=getBlData();
  let hh='<tr class="hrow">'+BL_COLS.map(c=>`<th class="s" onclick="blSort('${c.key}')">${c.label}${blSKey===c.key?(blSDir===-1?' ▼':' ▲'):''}</th>`).join('')+'</tr>';
  hh+='<tr class="frow">'+BL_COLS.map(c=>{
    if(c.key==='vbl'||c.key==='prob')return'<th></th>';
    if(c.key==='resultado'){const cur=blColF[c.key]||'';return`<th><select onchange="setBlF('${c.key}',this.value)"><option value="">Todos</option>${cfg.statusList.map(s=>`<option ${cur===s?'selected':''}>${s}</option>`).join('')}</select></th>`;}
    if(c.key==='gestor'){const cur=blColF[c.key]||'';return`<th><select onchange="setBlF('${c.key}',this.value)"><option value="">Todos</option>${cfg.gestores.map(g=>`<option ${cur===g?'selected':''}>${g}</option>`).join('')}</select></th>`;}
    return`<th><input placeholder="filtrar..." value="${blColF[c.key]||''}" oninput="setBlF('${c.key}',this.value)"></th>`;
  }).join('')+'</tr>';
  document.getElementById('bl-thd').innerHTML=hh;

  let bh='';
  data.forEach(row=>{
    const isV=row.resultado==='VENCIDA'||row.status==='VENCIDA';
    const prob=isV?100:(parseInt(row.prob)||0);
    const vbl=(row.valor||0)*prob/100;
    const resCls=row.resultado==='VENCIDA'?'venc':row.resultado==='PERDIDA'?'perd':'';
    bh+=`<tr>
      <td><strong style="color:var(--sd)">${row.displayNum||row.num}</strong></td>
      <td><input value="${esc(row.contratante||'')}" onchange="editRow('${row._id}','contratante',this.value)" style="min-width:110px"></td>
      <td>${esc(row.escopo||'')}</td>
      <td>${fmtDate(row.data)}</td>
      <td>${esc(row.gestor||'')}</td>
      <td class="${resCls}">${esc(row.resultado||'')}</td>
      <td style="text-align:right;font-weight:600">R$ ${fmtBRL(row.valor)}</td>
      <td style="text-align:center">${isV?`<span class="bl100">100%</span>`:`<input type="number" min="0" max="100" value="${prob}" style="width:55px;text-align:center;border:1.5px solid var(--se);border-radius:4px;padding:3px 5px;font-size:12px" onchange="editProb('${row._id}',this.value)">%`}</td>
      <td style="text-align:right;font-weight:700;color:#166534">R$ ${fmtBRL(vbl)}</td>
    </tr>`;
  });

  document.getElementById('bl-tbd').innerHTML=bh||'<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--sg)">Nenhuma proposta.</td></tr>';
  const totV=data.reduce((s,p)=>s+(p.valor||0),0);
  const totBL=data.reduce((s,p)=>{const isV=p.resultado==='VENCIDA'||p.status==='VENCIDA';return s+(p.valor||0)*(isV?100:(parseInt(p.prob)||0))/100;},0);
  document.getElementById('bl-foot').textContent=`${data.length} proposta(s) • Volume: R$ ${fmtBRL(totV)} • Backlog Projetado: R$ ${fmtBRL(totBL)}`;
}
function setBlF(k,v){blColF[k]=v;renderBacklog();}
function editProb(id,v){const p=proposals.find(x=>x._id===id);if(p){p.prob=parseInt(v)||0;saveProp();renderBacklog();}}
function blSort(k){
  if(blSKey===k)blSDir*=-1;else{blSKey=k;blSDir=-1;}
  renderBacklog();
}
function expBacklog(){
  const data=getBlData();
  if(!data.length){showAlert('Sem dados para exportar.','wn');return;}
  const rows=data.map(p=>{
    const isV=p.resultado==='VENCIDA'||p.status==='VENCIDA';
    const prob=isV?100:(parseInt(p.prob)||0);
    return{'Nº':p.displayNum||p.num,'Contratante':p.contratante,'Escopo':p.escopo,'Data':fmtDate(p.data),'Gestor':p.gestor,'Resultado':p.resultado,'Valor Total':p.valor,'% Prob. Ganho':prob,'Valor Backlog':(p.valor||0)*prob/100};
  });
  xlsxExport(rows,'BACKLOG',`STERN_Backlog_${today()}.xlsx`);
}

// ── DASHBOARD ─────────────────────────────────────────────
function getDashData(){
  const df=document.getElementById('ddf')?.value||'';
  const dt=document.getElementById('ddt')?.value||'';
  const es=document.getElementById('ddes')?.value||'';
  const ge=document.getElementById('ddge')?.value||'';
  const st=document.getElementById('ddst')?.value||'';
  return proposals.filter(p=>{
    if(df&&(p.data||'')<df)return false;
    if(dt&&(p.data||'')>dt)return false;
    if(es&&p.escopo!==es)return false;
    if(ge&&p.gestor!==ge)return false;
    if(st&&p.resultado!==st&&p.status!==st)return false;
    return true;
  });
}
function renderDash(){
  const data=getDashData();
  const totV=data.reduce((s,p)=>s+(p.valor||0),0);
  const won=data.filter(p=>p.resultado==='VENCIDA'||p.status==='VENCIDA');
  const wonV=won.reduce((s,p)=>s+(p.valor||0),0);
  const inN=data.filter(p=>p.resultado==='AG. DEFINIÇÃO'||p.status==='AG. DEFINIÇÃO');
  const inNV=inN.reduce((s,p)=>s+(p.valor||0),0);
  const conv=data.length>0?((won.length/data.length)*100).toFixed(1):'0.0';
  const ticket=won.length>0?wonV/won.length:0;

  document.getElementById('dmets').innerHTML=[
    {val:data.length,lbl:'Total de Propostas',c:'var(--sc)'},
    {val:'R$ '+fmtV(totV),lbl:'Volume Orçado',c:'#185fa5'},
    {val:won.length,lbl:'Propostas Vencidas',c:'#166534'},
    {val:'R$ '+fmtV(wonV),lbl:'Valor Vencido',c:'#166534'},
    {val:conv+'%',lbl:'Taxa de Conversão',c:'var(--sd)'},
    {val:'R$ '+fmtV(ticket),lbl:'Ticket Médio',c:'#185fa5'},
    {val:inN.length,lbl:'Em Negociação',c:'#b45309'},
    {val:'R$ '+fmtV(inNV),lbl:'Pipeline',c:'#b45309'}
  ].map(m=>`<div class="mc" style="border-left-color:${m.c}"><div class="mv">${m.val}</div><div class="ml">${m.lbl}</div></div>`).join('');

  const stC={};cfg.statusList.forEach(s=>{stC[s]=data.filter(p=>p.resultado===s||p.status===s).length;});
  const maxSt=Math.max(...Object.values(stC),1);
  document.getElementById('funnel').innerHTML=Object.entries(stC).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([s,cnt])=>{
    const pct=Math.max(8,Math.round((cnt/maxSt)*100));
    return`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:115px;font-size:11px;color:var(--sg);text-align:right;font-weight:500">${s}</div><div style="flex:1;background:var(--bg);border-radius:4px;height:30px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${STC[s]||'#14527a'};border-radius:4px;display:flex;align-items:center;padding-left:8px;color:#fff;font-size:12px;font-weight:600">${cnt}</div></div></div>`;
  }).join('')||'<p style="color:var(--sg);font-size:13px">Sem dados no período.</p>';

  const gU=[...new Set(data.map(p=>p.gestor).filter(Boolean))];
  mkCh('chconv','bar',{labels:gU.map(g=>g.split(' ')[0]),datasets:[{label:'Conv %',data:gU.map(g=>{const gd=data.filter(p=>p.gestor===g),gw=gd.filter(p=>p.resultado==='VENCIDA'||p.status==='VENCIDA');return gd.length?parseFloat(((gw.length/gd.length)*100).toFixed(1)):0;}),backgroundColor:'#14527a',borderRadius:4}]},{scales:{y:{beginAtZero:true,max:100}},plugins:{legend:{display:false}}});

  const mn=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],mo=Array(12).fill(0);
  data.forEach(p=>{if(!p.data||p.data.length<7)return;const m=parseInt(p.data.slice(5,7))-1;if(m>=0&&m<12)mo[m]+=(p.valor||0);});
  mkCh('chmon','bar',{labels:mn,datasets:[{data:mo.map(v=>parseFloat((v/1e6).toFixed(2))),backgroundColor:'rgba(20,82,122,.75)',borderRadius:3}]},{scales:{y:{ticks:{callback:v=>v+'M'}}},plugins:{legend:{display:false}}});

  const eM={};data.forEach(p=>{if(p.escopo)eM[p.escopo]=(eM[p.escopo]||0)+1;});
  const eE=Object.entries(eM).sort((a,b)=>b[1]-a[1]).slice(0,7);
  mkCh('chesc','doughnut',{labels:eE.map(e=>e[0]),datasets:[{data:eE.map(e=>e[1]),backgroundColor:['#0d2e4a','#14527a','#1a7ab5','#00b4d8','#0f6e56','#166534','#b45309'],borderWidth:2,borderColor:'#fff'}]},{plugins:{legend:{position:'right',labels:{font:{size:10},boxWidth:12}}}});

  const sM={};data.forEach(p=>{if(p.segmento&&p.segmento!=='0')sM[p.segmento]=(sM[p.segmento]||0)+1;});
  const sE=Object.entries(sM).sort((a,b)=>b[1]-a[1]).slice(0,7);
  mkCh('chseg','bar',{labels:sE.map(e=>e[0].length>16?e[0].slice(0,14)+'..':e[0]),datasets:[{data:sE.map(e=>e[1]),backgroundColor:'#1a7ab5',borderRadius:4}]},{indexAxis:'y',scales:{x:{beginAtZero:true}},plugins:{legend:{display:false}}});

  const stE=Object.entries(stC).filter(([,v])=>v>0);
  mkCh('chst','pie',{labels:stE.map(e=>e[0]),datasets:[{data:stE.map(e=>e[1]),backgroundColor:stE.map(([s])=>STC[s]||'#14527a'),borderWidth:2,borderColor:'#fff'}]},{plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:12,padding:8}}}});
}
function mkCh(id,type,data,opts){
  const c=document.getElementById(id);if(!c)return;
  if(chartInst[id])chartInst[id].destroy();
  chartInst[id]=new Chart(c,{type,data,options:{responsive:true,maintainAspectRatio:false,...opts}});
}

// ── CONFIG ────────────────────────────────────────────────
function renderColCfg(){
  document.getElementById('colcfg').innerHTML=ALL_COLS.map(c=>
    `<li class="cfi"><input type="checkbox" id="col-${c.key}" ${cfg.visibleCols.includes(c.key)?'checked':''} ${c.always?'disabled':''}>
    <label for="col-${c.key}">${c.label}</label>${c.always?'<span class="ftag">fixo</span>':''}</li>`
  ).join('');
}
function saveColCfg(){
  cfg.visibleCols=ALL_COLS.filter(c=>{const el=document.getElementById('col-'+c.key);return el&&el.checked;}).map(c=>c.key);
  saveCfg();showAlert('Colunas salvas!','ok');renderTable();
}
function renderGTags(){
  const el=document.getElementById('gtags');if(!el)return;
  el.innerHTML=cfg.gestores.map((g,i)=>`<span class="tag">${g}<button onclick="rmGst(${i})">×</button></span>`).join('');
  popG();
}
function popG(){
  ['fge','blges','ddge'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value,ph=id==='fge'?'Selecione...':'Todos';
    el.innerHTML=`<option value="">${ph}</option>`+cfg.gestores.map(g=>`<option ${cur===g?'selected':''}>${g}</option>`).join('');
  });
}
function addGst(){const v=document.getElementById('ngi').value.trim().toUpperCase();if(!v||cfg.gestores.includes(v))return;cfg.gestores.push(v);document.getElementById('ngi').value='';saveCfg();renderGTags();}
function rmGst(i){cfg.gestores.splice(i,1);saveCfg();renderGTags();}
function renderSTags(){
  const el=document.getElementById('stags');if(!el)return;
  el.innerHTML=cfg.statusList.map((s,i)=>`<span class="tag">${s}<button onclick="rmSts(${i})">×</button></span>`).join('');
}
function addSts(){const v=document.getElementById('nsi').value.trim().toUpperCase();if(!v||cfg.statusList.includes(v))return;cfg.statusList.push(v);document.getElementById('nsi').value='';saveCfg();renderSTags();}
function rmSts(i){cfg.statusList.splice(i,1);saveCfg();renderSTags();}

// ── NAVIGATION ────────────────────────────────────────────
function showPage(p){
  ['nova','painel','backlog','dash','config'].forEach(pg=>{
    document.getElementById('page-'+pg).style.display=pg===p?'block':'none';
    document.getElementById('nav-'+pg).classList.toggle('active',pg===p);
  });
  if(p==='painel'){renderAdvancedFilters();renderTable();}
  if(p==='backlog')renderBacklog();
  if(p==='dash')renderDash();
  if(p==='config'){renderColCfg();renderGTags();renderSTags();}
}

// ── IMPORT ────────────────────────────────────────────────
function openImp(){document.getElementById('imp-modal').style.display='flex';rstImp();}
function closeImp(){document.getElementById('imp-modal').style.display='none';rstImp();}
function rstImp(){impRows=[];document.getElementById('iprev').style.display='none';document.getElementById('fimp').value='';document.getElementById('doimp').disabled=true;document.getElementById('iwrn').style.display='none';document.getElementById('iok').style.display='none';selMode('add');}
function selMode(m){impMode=m;['add','replace','update'].forEach(x=>document.getElementById('md-'+x).classList.toggle('sel',x===m));}
function handleDrop(e){e.preventDefault();document.getElementById('dzone').style.borderColor='';if(e.dataTransfer.files[0])readXL(e.dataTransfer.files[0]);}
function handleFileSelect(e){if(e.target.files[0])readXL(e.target.files[0]);}
function parseImportedDate(value){
  if(value===null||value===undefined||value==='') return '';
  if(value instanceof Date && !isNaN(value)) return value.toISOString().slice(0,10);
  const s=String(value).trim();
  if(!s) return '';
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m) return `${m[3]}-${m[2]}-${m[1]}`;
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if(m){ const yy=Number(m[3]); const yyyy=yy>=70?1900+yy:2000+yy; return `${yyyy}-${m[2]}-${m[1]}`; }
  if(/^\d+(?:\.\d+)?$/.test(s)){
    const num=Number(s);
    if(num>20000 && num<100000){
      const ms=Math.round((num-25569)*86400*1000);
      const d=new Date(ms);
      if(!isNaN(d)) return d.toISOString().slice(0,10);
    }
  }
  const d=new Date(s);
  if(!isNaN(d)) return d.toISOString().slice(0,10);
  return '';
}

function readXL(file){
  const iwrn=document.getElementById('iwrn'),iok=document.getElementById('iok');
  iwrn.style.display='none';iok.style.display='none';
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'binary',cellDates:true});
      const pref=['PROPOSTAS','PROPOSTA 25','PROPOSTA'];
      let sn=wb.SheetNames.find(n=>pref.includes(n.trim().toUpperCase()));
      if(!sn)sn=wb.SheetNames[0];
      const raw=XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:'',raw:false});
      if(!raw.length){iwrn.textContent='Nenhuma linha encontrada.';iwrn.style.display='block';return;}
      const CM={num:['Nº','N°','NUM'],contratante:['CONTRATANTE'],cliente:['CLIENTE FINAL','CLIENTE'],
        cnpj:['CNPJ'],convite:['CONVITE'],escopo:['ESCOPO'],data:['DATA'],descricao:['DESCRIÇÃO','DESCRICAO'],
        cidade:['CIDADE'],uf:['UF'],resultado:['RESULTADO'],gestor:['GESTOR COMERCIAL','GESTOR'],
        orex:['OREX'],prazo:['PRAZO'],tipo:['TIPO'],segmento:['SEGMENTO'],nome:['NOME'],
        telefone:['TELEFONE'],email:['\xa0E-MAIL\xa0','E-MAIL','EMAIL'],projeto:['PROJETO'],valor:['VALOR TOTAL','VALOR']};
      const rk=Object.keys(raw[0]);
      const fk=als=>{for(const a of als){const f=rk.find(k=>k.trim().toUpperCase()===a.trim().toUpperCase());if(f!==undefined)return f;}return null;};
      const ck={};Object.entries(CM).forEach(([f,a])=>{ck[f]=fk(a);});
      let skip=0;
      impRows=raw.map(r=>{
        const numRaw=ck.num?r[ck.num]:'';
        const numInt=parseInt(String(numRaw).replace(/[^0-9]/g,''));
        if(!numRaw||isNaN(numInt)){skip++;return null;}
        let ds=parseImportedDate(ck.data?r[ck.data]:'');
        const g=k=>ck[k]?String(r[ck[k]]||'').trim():'';
        const res=g('resultado').trimEnd();
        const valor=parseFloat(g('valor').replace(/[^\d.,]/g,'').replace(',','.'))||0;
        return{_id:rndId(),num:String(numInt),displayNum:String(numInt),rev:'',numSort:numInt,
          cnpj:g('cnpj'),contratante:g('contratante'),cliente:g('cliente')||g('contratante'),
          convite:g('convite'),escopo:g('escopo'),data:ds,descricao:g('descricao'),
          cidade:g('cidade'),uf:g('uf'),resultado:res,gestor:g('gestor'),orex:g('orex'),
          prazo:g('prazo'),tipo:g('tipo'),segmento:g('segmento'),nome:g('nome'),
          telefone:g('telefone'),email:g('email'),projeto:g('projeto'),valor,
          status:res,prob:res==='VENCIDA'?100:0,criadoPor:'Importado'};
      }).filter(Boolean);
      if(!impRows.length){iwrn.textContent='Nenhuma linha válida (sem Nº).';iwrn.style.display='block';return;}
      document.getElementById('isum').innerHTML=[{val:impRows.length,lbl:'Linhas'},{val:skip,lbl:'Ignoradas'},{val:sn,lbl:'Aba'}].map(s=>`<div class="ist"><strong>${s.val}</strong><span>${s.lbl}</span></div>`).join('');
      const pC=['num','contratante','escopo','data','resultado','valor'];
      document.getElementById('pvhd').innerHTML='<tr>'+pC.map(c=>`<th>${c}</th>`).join('')+'</tr>';
      document.getElementById('pvbd').innerHTML=impRows.slice(0,5).map(r=>'<tr>'+pC.map(c=>c==='valor'?`<td>R$ ${fmtBRL(r.valor)}</td>`:`<td>${esc(r[c]||'—')}</td>`).join('')+'</tr>').join('');
      iok.textContent=`✓ ${impRows.length} propostas prontas para importar.`;iok.style.display='block';
      if(skip>0){iwrn.textContent=`⚠ ${skip} linha(s) ignoradas.`;iwrn.style.display='block';}
      document.getElementById('iprev').style.display='block';
      document.getElementById('doimp').disabled=false;
    }catch(err){iwrn.textContent='Erro ao ler: '+err.message;iwrn.style.display='block';}
  };
  reader.readAsBinaryString(file);
}
function doImport(){
  if(!impRows.length)return;
  const btn=document.getElementById('doimp');btn.disabled=true;btn.textContent='Importando...';
  try{
    if(impMode==='replace')proposals=impRows;
    else if(impMode==='add'){const ek=new Set(proposals.map(p=>p.displayNum||p.num));proposals=[...proposals,...impRows.filter(r=>!ek.has(r.displayNum||r.num))];}
    else{const bn={};proposals.forEach(p=>{bn[p.num]=p;});impRows.forEach(r=>{bn[r.num]={...(bn[r.num]||{}),...r};});proposals=Object.values(bn);}
    proposals.sort((a,b)=>(a.numSort||0)-(b.numSort||0));
    saveProp();updNN();closeImp();showPage('painel');
    showAlert(`${impRows.length} propostas importadas!`,'ok');
  }catch(err){btn.disabled=false;btn.textContent='Importar';document.getElementById('iwrn').textContent='Erro: '+err.message;document.getElementById('iwrn').style.display='block';}
}

// ── HELPERS ──────────────────────────────────────────────
function mskCNPJ(el){
  let v=el.value.replace(/\D/g,'').slice(0,14);
  if(v.length>12)v=v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,'$1.$2.$3/$4-$5');
  else if(v.length>8)v=v.replace(/(\d{2})(\d{3})(\d{3})(\d+)/,'$1.$2.$3/$4');
  else if(v.length>5)v=v.replace(/(\d{2})(\d{3})(\d+)/,'$1.$2.$3');
  else if(v.length>2)v=v.replace(/(\d{2})(\d+)/,'$1.$2');
  el.value=v;
}
function fmtDate(d){
  if(!d)return'—';
  const s=String(d).trim().slice(0,10);
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m)return`${m[3]}/${m[2]}/${m[1]}`;
  if(s.match(/^\d{2}\/\d{2}\/\d{4}$/))return s;
  return s;
}
function fmtBRL(v){return(parseFloat(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtV(v){if(v>=1e6)return(v/1e6).toFixed(1)+'M';if(v>=1e3)return(v/1e3).toFixed(0)+'K';return fmtBRL(v);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function today(){return new Date().toISOString().slice(0,10);}
function showAlert(msg,type='ok'){
  const el=document.getElementById('amsg');
  if(!el)return;
  el.textContent=msg;el.className='alert '+type;el.style.display='block';
  setTimeout(()=>el.style.display='none',4000);
}
function xlsxExport(rows,sheet,filename){
  if(!rows.length){showAlert('Sem dados para exportar.','wn');return;}
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=Object.keys(rows[0]).map(()=>({wch:18}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheet);
  XLSX.writeFile(wb,filename);
}


// ── MISSING FUNCTIONS ─────────────────────────────────────
function delRow(id){
  if(!confirm('Excluir esta proposta?'))return;
  const idx=proposals.findIndex(p=>p._id===id);
  if(idx===-1)return;
  proposals.splice(idx,1);
  saveProp();
  renderTable();
  showAlert('Proposta excluída.','ok');
}

function editRow(id,key,value){
  const p=proposals.find(x=>x._id===id);
  if(!p)return;
  if(key==='valor')p[key]=parseFloat(value)||0;
  else p[key]=value;
  // keep resultado and status in sync
  if(key==='resultado')p.status=value;
  if(key==='status')p.resultado=value;
  saveProp();
}

function doSort(k){
  if(sKey===k)sDir*=-1;
  else{sKey=k;sDir=-1;}
  renderTable();
}

function updResColor(el){
  el.className='';
  if(el.value==='VENCIDA')el.className='venc';
  else if(el.value==='PERDIDA')el.className='perd';
}

function downloadDashImg(){
  const dash=document.getElementById('dash');
  if(!dash){showAlert('Dashboard não encontrado.','wn');return;}
  if(typeof html2canvas==='undefined'){showAlert('html2canvas não carregado.','wn');return;}
  showAlert('Gerando imagem...','ok');
  html2canvas(dash,{scale:2,useCORS:true,backgroundColor:'#f1f5f9'}).then(canvas=>{
    const a=document.createElement('a');
    a.download='STERN_Dashboard_'+today()+'.png';
    a.href=canvas.toDataURL('image/png');
    a.click();
    showAlert('Dashboard baixado!','ok');
  }).catch(()=>showAlert('Erro ao gerar imagem.','wn'));
}

// ── BOOT ─────────────────────────────────────────────────
function initAuth(){
  window._fbFns.onAuthStateChanged(getAuth2(), user=>{
    if(user){
      currentUser={email:user.email,name:user.email.split('@')[0]};
      startApp();
    } else {
      document.getElementById('app').style.display='none';
      document.getElementById('auth').style.display='flex';
      swTab('login', document.querySelector('.atab'));
    }
  });
}

document.addEventListener("DOMContentLoaded",function(){
  if(window._fbReady){
    initAuth();
  } else {
    window.addEventListener("fbready", initAuth);
  }
});
