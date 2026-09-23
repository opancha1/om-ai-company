/* Om AI Company office UI. All status, counts, tasks and messages come from the API. */
const $ = (s, root=document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const crew = {
  ava:{hair:'#4b3027',skin:'#efc69c',shirt:'#e1e4dc',accent:'#c3914d',role:'CEO Assistant',pos:[550,600]},
  james:{hair:'#714a2f',skin:'#eac09b',shirt:'#4389a6',accent:'#edc15e',role:'Project Manager',pos:[750,475]},
  alex:{hair:'#1b2331',skin:'#d89b72',shirt:'#3474b8',accent:'#63c8ed',role:'Software Engineer',pos:[350,300]},
  mia:{hair:'#56322c',skin:'#f0c19d',shirt:'#825dc2',accent:'#d6a7ff',role:'UI/UX Designer',pos:[550,300]},
  noah:{hair:'#263440',skin:'#dab18e',shirt:'#4a8991',accent:'#b1e3d6',role:'Researcher',pos:[750,300]},
  emma:{hair:'#704a2b',skin:'#f0c6a3',shirt:'#378c85',accent:'#f0ca68',role:'Data Analyst',pos:[350,475]},
  sophia:{hair:'#51372f',skin:'#e9b798',shirt:'#bf5d76',accent:'#ffb0bd',role:'Marketing',pos:[550,475]},
  olivia:{hair:'#252c3a',skin:'#efc4a3',shirt:'#b65b55',accent:'#ff9e78',role:'QA Engineer',pos:[350,600]},
  liam:{hair:'#93643a',skin:'#e9bd99',shirt:'#6876ad',accent:'#99b4ff',role:'Finance',pos:[750,600]}
};
const state = {company:null,employees:[],projects:[],tasks:[],messages:[],activity:[],artifacts:[],meetings:[],tab:'Chat',busy:false,lastMessageCount:0,refreshing:false};
let toastTimer;

async function api(path, options={}) {
  const response = await fetch('/api/'+path, options);
  const result = await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if(!response.ok) throw new Error(result.error || response.statusText || 'Request failed');
  return result;
}
function post(path, body) { return api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
function dateFmt(value, opts={month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) { if(!value)return '—'; const d=new Date(value);return Number.isNaN(+d)?'—':d.toLocaleString([],opts); }
function currentProject(){return state.projects[0]||null;}
function projectTasks(projectId){return state.tasks.filter(t=>!projectId||t.project_id===projectId);}
function statusLabel(employee){const task=state.tasks.find(t=>t.employee_id===employee.id&&t.status==='IN_PROGRESS');if(task)return 'Working';const recent=state.tasks.find(t=>t.employee_id===employee.id&&['BLOCKED','FAILED'].includes(t.status));if(recent)return recent.status==='BLOCKED'?'Blocked':'Error';return employee.status||'Available';}
function assignedTask(employee){return state.tasks.find(t=>t.employee_id===employee.id&&t.status==='IN_PROGRESS')||state.tasks.find(t=>t.employee_id===employee.id&&['TODO','BLOCKED','FAILED'].includes(t.status));}
function taskActivity(employee){const task=assignedTask(employee);if(task)return task.status==='IN_PROGRESS'?'Working on task':task.status==='TODO'?'Ready for task':task.status==='BLOCKED'?'Blocked':task.status==='FAILED'?'Run failed':'Available';return statusLabel(employee)==='Working'?'Working':'Available';}
function palette(employee){return crew[(employee.id||'').toLowerCase()]||{hair:'#28303a',skin:'#dba982',shirt:'#47738d',accent:'#f0cf70',role:employee.role||'Employee',pos:[500,400]};}
function employeeById(id){return state.employees.find(e=>e.id===id);}
function avatarSvg(employee, large=false){
  const p=palette(employee);const hair=p.hair,skin=p.skin,shirt=p.shirt,accent=p.accent;
  return `<svg class="pixel-avatar" viewBox="0 0 32 38" aria-hidden="true" shape-rendering="crispEdges"><rect x="9" y="2" width="14" height="3" fill="${hair}"/><rect x="6" y="5" width="20" height="11" fill="${hair}"/><rect x="7" y="11" width="18" height="12" fill="${skin}"/><rect x="5" y="9" width="3" height="9" fill="${hair}"/><rect x="24" y="9" width="3" height="9" fill="${hair}"/><rect x="10" y="15" width="3" height="3" fill="#233241"/><rect x="20" y="15" width="3" height="3" fill="#233241"/><rect x="14" y="20" width="5" height="2" fill="#a85f55"/><rect x="8" y="24" width="16" height="3" fill="${accent}"/><path d="M4 37v-8l5-5h14l5 5v8z" fill="${shirt}"/><rect x="14" y="27" width="4" height="10" fill="#e5edf2" opacity=".85"/><rect x="2" y="35" width="10" height="3" fill="#24374a"/><rect x="21" y="35" width="10" height="3" fill="#24374a"/><rect x="7" y="8" width="3" height="3" fill="${hair}"/><rect x="22" y="8" width="3" height="3" fill="${hair}"/></svg>`;
}
function spriteAt(employee, x, y, compact=false){
  const p=palette(employee), status=statusLabel(employee), task=assignedTask(employee), c=status==='Working'?'#62d8ff':status==='Blocked'||status==='Error'?'#fb8177':'#60dc89';
  const label=(employee.name||'?').slice(0,13), shortRole=(employee.role||p.role).replace('Software Engineer','Engineer').replace('UI/UX Designer','Designer').replace('CEO Assistant','Assistant');
  return `<g class="employee-hit" data-employee="${esc(employee.id)}" tabindex="0" role="button" aria-label="Open ${esc(employee.name)} profile"><title>${esc(employee.name)} · ${esc(status)}${task?' · '+esc(task.title):''}</title>
    <ellipse cx="${x}" cy="${y+29}" rx="42" ry="6" fill="#101a1dcc"/><g class="desk-outline"><rect x="${x-40}" y="${y+2}" width="80" height="22" rx="2" fill="#9a6035" stroke="#d59a56" stroke-width="2"/><rect x="${x-37}" y="${y+5}" width="74" height="3" fill="#d69b59"/><rect x="${x-33}" y="${y+24}" width="5" height="19" fill="#513b30"/><rect x="${x+28}" y="${y+24}" width="5" height="19" fill="#513b30"/><rect x="${x-13}" y="${y-17}" width="28" height="19" rx="2" fill="#121d28" stroke="#a2b2af" stroke-width="2"/><rect x="${x-10}" y="${y-14}" width="22" height="13" fill="#17384b"/><rect x="${x-8}" y="${y-12}" width="16" height="2" fill="${p.accent}" opacity=".9"/><rect x="${x-8}" y="${y-8}" width="11" height="2" fill="#82cbe1" opacity=".7"/><rect x="${x-4}" y="${y+1}" width="8" height="2" fill="#aeb7b2"/><rect x="${x+20}" y="${y-6}" width="7" height="7" rx="1" fill="#202932" stroke="#d6ab68"/><circle cx="${x+24}" cy="${y-3}" r="2" fill="#8bd2ac"/></g>
    <g transform="translate(${x-16} ${y-48})"><rect x="5" y="27" width="23" height="11" rx="3" fill="#283846"/><rect x="8" y="21" width="18" height="13" fill="${p.shirt}"/><rect x="12" y="17" width="11" height="8" fill="${p.skin}"/><rect x="8" y="5" width="19" height="15" fill="${p.hair}"/><rect x="10" y="10" width="15" height="12" fill="${p.skin}"/><rect x="9" y="7" width="17" height="4" fill="${p.hair}"/><rect x="7" y="10" width="3" height="8" fill="${p.hair}"/><rect x="24" y="10" width="3" height="8" fill="${p.hair}"/><rect x="12" y="14" width="3" height="2" fill="#1b2b36"/><rect x="20" y="14" width="3" height="2" fill="#1b2b36"/><rect x="15" y="18" width="5" height="2" fill="#aa6454"/><rect x="11" y="22" width="13" height="2" fill="${p.accent}"/></g>
    <rect x="${x-42}" y="${y+45}" width="84" height="31" rx="4" fill="#0a1c2b" stroke="#638093" stroke-width="1.2"/><circle cx="${x-32}" cy="${y+56}" r="3.4" fill="${c}"/><text x="${x-24}" y="${y+58}" class="worker-name">${esc(label)}</text><text x="${x-32}" y="${y+70}" class="worker-role">${esc(shortRole)}</text>${!compact&&status==='Working'?`<text x="${x+35}" y="${y+70}" text-anchor="end" class="worker-state" fill="${c}">ACTIVE</text>`:''}
  </g>`;
}
function plant(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})" shape-rendering="crispEdges"><rect x="-9" y="0" width="18" height="13" fill="#a7663d" stroke="#d39b60"/><rect x="-6" y="-11" width="4" height="12" fill="#3d8c57"/><rect x="1" y="-17" width="4" height="18" fill="#4b9a5b"/><rect x="-13" y="-15" width="8" height="4" fill="#57a65d"/><rect x="4" y="-24" width="9" height="4" fill="#5cae62"/><rect x="-5" y="-29" width="10" height="4" fill="#4e9b58"/><rect x="-17" y="-8" width="5" height="4" fill="#68b969"/><rect x="11" y="-11" width="6" height="4" fill="#5aa959"/><rect x="-2" y="-7" width="8" height="3" fill="#83cb75"/></g>`;}

function buildOffice(){
  const employees=state.employees||[];
  const positions=employees.map(e=>spriteAt(e,...(palette(e).pos||[500,400]))).join('');
  const city=Array.from({length:14},(_,i)=>{
    const x=286+i*48,h=34+(i*31)%82;
    return `<g><rect x="${x}" y="${158-h}" width="38" height="${h}" fill="${i%2?'#193b58':'#244b68'}"/>
      <g fill="#9ed7df" opacity=".7">${[0,1,2,3].map(r=>`<rect x="${x+6}" y="${165-h+r*15}" width="5" height="4"/><rect x="${x+18}" y="${165-h+r*15}" width="5" height="4"/><rect x="${x+30}" y="${165-h+r*15}" width="4" height="4"/>`).join('')}</g></g>`;
  }).join('');
  const notes=['#f1ca63','#6fd4e7','#82d491','#dc8bc6','#f39b6f','#78a9ed','#f0d47c','#69cdbd'].map((c,i)=>`<g><rect x="${655+(i%4)*29}" y="${356+Math.floor(i/4)*39}" width="21" height="28" rx="2" fill="${c}" stroke="#fff1bd"/><path d="M${659+(i%4)*29} ${365+Math.floor(i/4)*39}h13M${659+(i%4)*29} ${371+Math.floor(i/4)*39}h9M${659+(i%4)*29} ${377+Math.floor(i/4)*39}h12" stroke="#354650" stroke-width="2"/></g>`).join('');
  const desk=employees.map((e,i)=>{
    const p=palette(e), pos=p.pos||[500,400], status=statusLabel(e);
    const [x,y]=pos;
    return `<g class="station-zone" opacity=".96">
      <rect x="${x-58}" y="${y-15}" width="116" height="150" rx="6" fill="#3b4b4c" stroke="#6d7b75" stroke-width="2"/>
      <rect x="${x-53}" y="${y+39}" width="106" height="3" fill="${p.accent}" opacity=".22"/>
      <rect x="${x-50}" y="${y+6}" width="100" height="6" fill="#6f5038" opacity=".7"/>
      <circle cx="${x-43}" cy="${y+51}" r="3" fill="${status==='Working'?'#61d8ff':status==='Blocked'?'#ff8178':'#5ed987'}"/>
      <rect x="${x+27}" y="${y+51}" width="16" height="12" rx="2" fill="#152938" stroke="${p.accent}" opacity=".85"/>
      <path d="M${x+30} ${y+55}h10M${x+30} ${y+59}h7" stroke="${p.accent}" stroke-width="1"/>
    </g>`;
  }).join('');
  $('#officeMap').innerHTML=`<svg class="office-svg" viewBox="0 0 1000 700" preserveAspectRatio="none" role="img" aria-label="Detailed Om AI Company pixel-art office">
  <defs>
    <pattern id="floorTile" width="36" height="28" patternUnits="userSpaceOnUse"><rect width="36" height="28" fill="#3b4a4a"/><path d="M0 0H36M0 0V28" stroke="#56635e" opacity=".55"/><path d="M2 25H34" stroke="#293b40" opacity=".7"/></pattern>
    <linearGradient id="windowSky" x2="0" y2="1"><stop stop-color="#11263e"/><stop offset=".55" stop-color="#35647f"/><stop offset="1" stop-color="#718c93"/></linearGradient>
    <linearGradient id="warm" x2="0" y2="1"><stop stop-color="#ffd56c" stop-opacity=".26"/><stop offset="1" stop-color="#ffd56c" stop-opacity="0"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#07131f" flood-opacity=".65"/></filter>
  </defs>
  <rect width="1000" height="700" fill="url(#floorTile)"/>
  <rect x="13" y="13" width="974" height="674" rx="7" fill="none" stroke="#d8b56c" stroke-width="7"/>
  <rect x="21" y="21" width="958" height="658" rx="4" fill="none" stroke="#716e5b" stroke-width="2"/>

  <g filter="url(#shadow)">
    <rect x="273" y="25" width="452" height="142" rx="4" fill="#152b39" stroke="#d9b36a" stroke-width="6"/>
    <rect x="284" y="37" width="430" height="117" fill="url(#windowSky)"/>
    ${city}
    <rect x="284" y="37" width="430" height="117" fill="url(#warm)"/>
    ${Array.from({length:7},(_,i)=>`<rect x="${286+i*71}" y="37" width="3" height="117" fill="#d8bd7b" opacity=".8"/>`).join('')}
    <rect x="284" y="154" width="430" height="6" fill="#e3c579"/>
  </g>

  <g class="room-hit" data-room="meeting" tabindex="0" role="button">
    <rect x="25" y="28" width="225" height="204" rx="5" fill="#283c43" stroke="#dfb970" stroke-width="5"/>
    <rect x="37" y="41" width="201" height="176" fill="#203743" stroke="#8aa0a4" stroke-width="3"/>
    <text x="137" y="62" text-anchor="middle" class="room-label">MEETING ROOM</text>
    <rect x="68" y="77" width="139" height="73" fill="#102536" stroke="#d7af67" stroke-width="4"/>
    <rect x="75" y="84" width="125" height="59" fill="#195b7e"/>
    <text x="137" y="105" text-anchor="middle" class="zone-sub">TEAMWORK BUILDS</text><text x="137" y="119" text-anchor="middle" class="zone-sub">THE FUTURE</text>
    <path d="M99 137l17-13 11 8 21-24" fill="none" stroke="#6ce1d4" stroke-width="3"/>
    <rect x="77" y="172" width="120" height="17" rx="3" fill="#96603a" stroke="#d19a57"/>
    <circle cx="91" cy="197" r="7" fill="#4d3b39"/><circle cx="185" cy="197" r="7" fill="#4d3b39"/><circle cx="106" cy="197" r="7" fill="#4d3b39"/><circle cx="170" cy="197" r="7" fill="#4d3b39"/>
  </g>

  <g class="room-hit" data-room="company" tabindex="0" role="button">
    <rect x="34" y="248" width="207" height="128" rx="6" fill="#152e3b" stroke="#cba767" stroke-width="4"/>
    <text x="137" y="272" text-anchor="middle" class="room-label">CEO OFFICE</text>
    <rect x="91" y="298" width="94" height="25" rx="2" fill="#9b6037" stroke="#d9a15b" stroke-width="3"/>
    <rect x="117" y="276" width="44" height="22" fill="#12222e" stroke="#9eb2af" stroke-width="2"/><rect x="122" y="281" width="34" height="12" fill="#18536b"/>
    <text x="137" y="318" text-anchor="middle" class="zone-sub">YOU · CEO</text>
    <rect x="117" y="330" width="41" height="11" rx="4" fill="#6d7e82"/><rect x="127" y="341" width="22" height="19" fill="#3a4b53"/>
    ${plant(57,358,.72)}
  </g>

  <g class="room-hit" data-room="break" tabindex="0" role="button">
    <rect x="25" y="505" width="225" height="159" rx="5" fill="#263d40" stroke="#c4a365" stroke-width="4"/>
    <text x="137" y="529" text-anchor="middle" class="room-label">BREAK ROOM</text>
    <rect x="47" y="548" width="40" height="75" fill="#132b37" stroke="#dfbc70" stroke-width="3"/><path d="M54 562h26M54 571h26" stroke="#69cfee" stroke-width="3"/><text x="67" y="596" text-anchor="middle" class="zone-sub">COFFEE</text>
    <rect x="108" y="583" width="83" height="13" rx="4" fill="#a66a3d"/><circle cx="119" cy="578" r="7" fill="#c0a87f"/><circle cx="180" cy="578" r="7" fill="#c0a87f"/><rect x="119" y="596" width="7" height="20" fill="#4b362e"/><rect x="175" y="596" width="7" height="20" fill="#4b362e"/>
    <rect x="204" y="551" width="27" height="72" fill="#4a5a60" stroke="#aebdbb" stroke-width="2"/><text x="217" y="638" text-anchor="middle" class="zone-sub">FRIDGE</text>${plant(225,546,.55)}
  </g>

  <g class="room-hit" data-room="server" tabindex="0" role="button">
    <rect x="750" y="27" width="225" height="205" rx="5" fill="#142a38" stroke="#d7af65" stroke-width="5"/>
    <rect x="761" y="42" width="203" height="176" fill="#0c2030" stroke="#587a87" stroke-width="2"/>
    <text x="862" y="63" text-anchor="middle" class="room-label">SERVER ROOM</text>
    ${[0,1,2,3].map(i=>`<g><rect x="${775+i*46}" y="79" width="37" height="119" rx="2" fill="#202f3b" stroke="#6b858d" stroke-width="2"/><rect x="${779+i*46}" y="86" width="29" height="18" fill="#132d41"/><path d="M782 ${93}h20M782 ${98}h13" stroke="#4fc9e8" stroke-width="2"/><circle class="server-led" cx="${804+i*46}" cy="94" r="2" fill="#64df8b"/><circle class="server-led" cx="${804+i*46}" cy="113" r="2" fill="#62cfff"/><path d="M781 ${131}h25M781 ${145}h25M781 ${159}h25M781 ${173}h25M781 ${187}h25" stroke="#435764" stroke-width="3"/></g>`).join('')}
    <text x="862" y="211" text-anchor="middle" class="zone-sub">API · DATABASE · AGENT JOBS</text>
  </g>

  <path d="M268 246H981M268 246V680M268 680H981" stroke="#d1ae6e" stroke-width="8"/>
  <path d="M272 253H977" stroke="#f2d28c" stroke-width="2"/>
  <path d="M272 340H977M272 510H977M610 253V680M797 253V510" stroke="#77827d" stroke-width="1" opacity=".2"/>
  ${desk}
  ${plant(272,250,.55)}${plant(615,250,.65)}${plant(796,250,.6)}${plant(974,472,.65)}${plant(268,478,.55)}${plant(611,674,.6)}

  <g class="room-hit" data-room="tasks" tabindex="0" role="button">
    <rect x="625" y="285" width="170" height="127" rx="5" fill="#17374a" stroke="#d0a55f" stroke-width="4"/>
    <text x="710" y="307" text-anchor="middle" class="room-label">TASK BOARD</text><text x="710" y="324" text-anchor="middle" class="zone-sub">IDEAS → TASKS → IMPACT</text>
    ${notes}
  </g>

  <g class="room-hit" data-room="lounge" tabindex="0" role="button">
    <rect x="800" y="505" width="175" height="158" rx="5" fill="#2b3d40" stroke="#c6a265" stroke-width="4"/>
    <text x="887" y="529" text-anchor="middle" class="room-label">LOUNGE</text>
    <rect x="826" y="563" width="120" height="45" rx="8" fill="#314b5c" stroke="#77858c" stroke-width="2"/><rect x="844" y="549" width="84" height="20" rx="7" fill="#3e5867"/>
    <rect x="858" y="616" width="56" height="10" rx="3" fill="#a56b3e"/><circle cx="886" cy="611" r="8" fill="#c0ac86"/>
    ${plant(957,548,.55)}
  </g>

  <g class="room-hit" data-room="printer" tabindex="0" role="button">
    <rect x="773" y="440" width="68" height="68" rx="4" fill="#182b37" stroke="#c5a264" stroke-width="3"/>
    <rect x="784" y="452" width="44" height="25" fill="#d5d9d1" stroke="#5d6e72" stroke-width="2"/><rect x="789" y="477" width="34" height="16" fill="#8d9a9d"/><rect x="793" y="441" width="26" height="11" fill="#f2efe3"/><circle cx="815" cy="463" r="3" fill="#6be38b"/>
    <text x="807" y="525" text-anchor="middle" class="zone-sub">PRINTER</text>
  </g>

  <g pointer-events="none">
    <rect x="846" y="350" width="96" height="67" fill="#e7d8b0" stroke="#8b6841" stroke-width="4"/><rect x="855" y="359" width="78" height="48" fill="#9fc1cc"/><path d="M858 397l20-24 14 16 12-11 24 20" fill="#71986f"/><text x="894" y="428" text-anchor="middle" class="zone-sub">KEEP BUILDING</text>
    <text x="84" y="641" class="wall-script">Build</text><text x="84" y="654" class="wall-script">Automate</text><text x="84" y="667" class="wall-script">Create</text><text x="84" y="680" class="wall-script">Grow</text>
  </g>

  ${positions}
  <rect x="18" y="18" width="964" height="664" fill="none" stroke="#e2c27a" stroke-width="3" pointer-events="none"/>
  </svg>`;
  $('#officeMap').querySelectorAll('[data-employee]').forEach(g=>{
    g.addEventListener('click',()=>openEmployee(g.dataset.employee));
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEmployee(g.dataset.employee)}});
  });
  $('#officeMap').querySelectorAll('[data-room]').forEach(el=>{
    el.addEventListener('click',()=>roomAction(el.dataset.room));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();roomAction(el.dataset.room)}});
  });
}
function drawEmployeeCards(){
  $('#employeeCards').innerHTML=state.employees.map(e=>{const status=statusLabel(e),t=assignedTask(e), activity=t?((t.status==='IN_PROGRESS'?'Working: ':t.status==='BLOCKED'?'Blocked: ':'Next: ')+t.title):'No active task';return `<button class="employee-card" data-employee-card="${esc(e.id)}"><span class="avatar-wrap">${avatarSvg(e)}</span><span class="employee-meta"><b>${esc(e.name)}</b><small>${esc(e.role)}</small></span><span class="employee-activity"><i class="employee-dot ${status.toLowerCase()}"></i>${esc(activity)}</span></button>`}).join('');
  $('#employeeCards').querySelectorAll('[data-employee-card]').forEach(b=>b.addEventListener('click',()=>openEmployee(b.dataset.employeeCard)));
}
function drawGoalAndProgress(){
  const p=currentProject(),tasks=projectTasks(p?.id),done=tasks.filter(t=>t.status==='COMPLETED').length,active=tasks.filter(t=>t.status==='IN_PROGRESS').length,todo=tasks.filter(t=>t.status==='TODO').length,review=tasks.filter(t=>['IN_REVIEW','APPROVED'].includes(t.status)).length,blocked=tasks.filter(t=>['BLOCKED','FAILED'].includes(t.status)).length;
  const pct=tasks.length?Math.round(done/tasks.length*100):0;
  $('#goalPanel').innerHTML=`<div class="card-heading"><div><span class="eyebrow">◎ &nbsp;CURRENT GOAL</span><h2>${p?esc(p.name):'No active project'}</h2></div><button class="link-button" data-open-projects>VIEW ↗</button></div><p class="progress-caption ${p?'':'goal-empty'}">${p?esc(p.description||'Project created in your workspace.').slice(0,150):'Give the team a command to start a project.'}</p>`;
  $('[data-open-projects]')?.addEventListener('click',()=>openCollection('Projects'));
  $('#progressPercent').textContent=`${pct}%`;$('#progressFill').style.width=`${pct}%`;$('#progressCaption').textContent=`${done} of ${tasks.length} tasks completed · ${tasks.length?`${p?.name||'Selected project'}`:'No project tasks yet'}`;
  $('#statusCounts').innerHTML=[['To do',todo],['In progress',active],['Review',review],['Blocked',blocked]].map(([n,v])=>`<div class="status-count"><b>${v}</b><small>${n}</small></div>`).join('');
}
function drawRightPanel(){
  const host=$('#rightContent');
  if(state.tab==='Chat'){
    const messages=[...state.messages].reverse().slice(-30);
    host.innerHTML=`<div class="chat-head"><b>＃ company-updates <span>⌄</span></b><span>${messages.length} STORED</span></div><div class="chat-messages" id="chatMessages">${messages.map(m=>`<article class="chat-message"><span class="mini-face">${esc((m.employee_name||'CEO')[0])}</span><div><div class="message-meta"><b>${esc(m.employee_name||'CEO')}</b><small>${dateFmt(m.created_at,{hour:'numeric',minute:'2-digit'})}</small></div><div class="message-body">${esc(m.body)}</div></div></article>`).join('')||'<div class="chat-empty">No messages are stored yet.<br>Agent messages and CEO notes will appear here.</div>'}</div><form class="chat-composer" id="chatForm"><input id="chatInput" placeholder="Message #company-updates…" aria-label="Message company updates"><button aria-label="Send message">➤</button></form>`;
    $('#chatForm').addEventListener('submit',sendChat);const scroller=$('#chatMessages');if(scroller)scroller.scrollTop=scroller.scrollHeight;
  }else if(state.tab==='Tasks'){
    const tasks=[...state.tasks].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    host.innerHTML=`<div class="chat-head"><b>ACTIVE TASK BOARD</b><span>${tasks.length} STORED</span></div><div class="task-list">${tasks.map(t=>`<div class="task-line" data-task="${esc(t.id)}"><div><b>${esc(t.title)}</b><small>${esc(t.employee_name||'Unassigned')} · ${dateFmt(t.updated_at)}</small></div><span class="pill ${esc(t.status)}">${esc(t.status.replace('_',' '))}</span></div>`).join('')||'<div class="chat-empty">No tasks in the workspace.</div>'}</div>`;
    host.querySelectorAll('[data-task]').forEach(el=>el.addEventListener('click',()=>openTask(el.dataset.task)));
  }else if(state.tab==='Employees'){
    host.innerHTML=`<div class="chat-head"><b>TEAM DIRECTORY</b><span>${state.employees.length} MEMBERS</span></div><div class="employee-list">${state.employees.map(e=>{const s=statusLabel(e),t=assignedTask(e);return `<div class="task-line" data-person="${esc(e.id)}"><div><b><i class="employee-dot ${s.toLowerCase()}"></i>${esc(e.name)} · ${esc(e.role)}</b><small>${esc(t?.title||'No current task')}</small></div><span class="pill ${s==='Working'?'IN_PROGRESS':s==='Blocked'?'BLOCKED':'COMPLETED'}">${esc(s.toUpperCase())}</span></div>`}).join('')}</div>`;
    host.querySelectorAll('[data-person]').forEach(el=>el.addEventListener('click',()=>openEmployee(el.dataset.person)));
  }else{
    const p=currentProject();const costStatus='AI usage and budgets are not tracked by the current backend.';
    host.innerHTML=`<div class="chat-head"><b>COMPANY SNAPSHOT</b><span>LIVE RECORDS</span></div><div class="company-list"><div class="modal-list-item"><b>${esc(state.company?.name||'Om AI Company')}</b><small>CEO · Local company workspace</small></div><div class="modal-list-item"><b>Active project</b><small>${esc(p?.name||'No project created')}</small></div><div class="modal-list-item"><b>Team availability</b><small>${state.employees.filter(e=>statusLabel(e)==='Available').length} available · ${state.employees.filter(e=>statusLabel(e)==='Working').length} working · ${state.employees.filter(e=>statusLabel(e)==='Blocked').length} blocked</small></div><div class="modal-list-item"><b>Finance</b><small>${esc(costStatus)}</small></div><div class="modal-list-item"><b>Approvals</b><small>Approval records are not available in this workspace.</small></div></div>`;
  }
}
function draw(){
  buildOffice();drawEmployeeCards();drawGoalAndProgress();drawRightPanel();
  $('#onlineNumber').textContent=state.employees.filter(e=>!['Offline','Error'].includes(statusLabel(e))).length;
  const badge=$('#chatBadge');if(state.messages.length>state.lastMessageCount&&state.lastMessageCount){badge.hidden=false;badge.textContent=Math.min(9,state.messages.length-state.lastMessageCount)}state.lastMessageCount=state.messages.length;
}
async function refresh(){
  if(state.refreshing)return;state.refreshing=true;
  try{
    const [company,employees,projects,tasks,messages,activity,artifacts,meetings]=await Promise.all(['company','employees','projects','tasks','messages','activity','artifacts','meetings'].map(p=>api(p)));
    state.company=company;state.employees=employees;state.projects=projects;state.tasks=tasks;state.messages=messages;state.activity=activity;state.artifacts=artifacts;state.meetings=meetings;
    $('#companyState').className='server-state connected';$('#companyState').innerHTML='<i></i> API CONNECTED';draw();
  }catch(error){$('#companyState').className='server-state error';$('#companyState').innerHTML='<i></i> API OFFLINE';showToast(`Workspace API unavailable: ${error.message}`)}
  finally{state.refreshing=false;}
}
function tickClock(){const now=new Date();$('#dateLabel').textContent=now.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'});$('#clockLabel').textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});$('#floorClock').textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function showToast(text){const toast=$('#toast');toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),4200)}
function showDialog(html,form=false){const d=$(form?'#formDialog':'#detailDialog'),body=$(form?'#formDialogBody':'#dialogBody');body.innerHTML=html;d.showModal();body.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>d.close()));return body;}
function agentTasks(employee){return state.tasks.filter(t=>t.employee_id===employee.id).slice(0,6)}
function openEmployee(id){
  const e=employeeById(id);if(!e)return;const status=statusLabel(e),task=assignedTask(e),p=task?state.projects.find(p=>p.id===task.project_id):null,relatedMessages=state.messages.filter(m=>m.employee_id===e.id).slice(-4).reverse(),arts=state.artifacts.filter(a=>a.employee_id===e.id).slice(0,4),tasks=agentTasks(e);
  const canRun=task&&['TODO','BLOCKED','FAILED'].includes(task.status);
  const body=showDialog(`<div class="profile-panel"><div>${avatarSvg(e,true)}</div><div><span class="eyebrow">${esc(e.department||'TEAM MEMBER')}</span><h2>${esc(e.name)}</h2><div class="role">${esc(e.role)}</div><span class="pill ${status==='Working'?'IN_PROGRESS':status==='Blocked'?'BLOCKED':'COMPLETED'}">● ${esc(status.toUpperCase())}</span></div></div><div class="profile-stats"><div class="profile-stat"><small>CURRENT TASK</small><b>${esc(task?.title||'No active task')}</b></div><div class="profile-stat"><small>CURRENT PROJECT</small><b>${esc(p?.name||'—')}</b></div><div class="profile-stat"><small>TASK HISTORY</small><b>${tasks.length} stored task${tasks.length===1?'':'s'}</b></div><div class="profile-stat"><small>LAST ACTIVE</small><b>${dateFmt(e.created_at,{month:'short',day:'numeric'})}</b></div></div><section class="profile-section"><h3>RECENT TASKS</h3>${tasks.map(t=>`<div class="modal-list-item"><b>${esc(t.title)} <span class="pill ${esc(t.status)}">${esc(t.status)}</span></b><small>${esc(state.projects.find(x=>x.id===t.project_id)?.name||'No project')} · ${dateFmt(t.updated_at)}</small>${t.result?`<p>${esc(t.result.slice(0,700))}</p>`:''}</div>`).join('')||'<p>No tasks assigned yet.</p>'}</section><section class="profile-section"><h3>RECENT MESSAGES</h3>${relatedMessages.map(m=>`<div class="modal-list-item"><small>${dateFmt(m.created_at)}</small><p>${esc(m.body)}</p></div>`).join('')||'<p>No stored messages from this employee.</p>'}</section><section class="profile-section"><h3>ARTIFACTS</h3>${arts.map(a=>`<div class="modal-list-item"><b>${esc(a.name)}</b><small>${dateFmt(a.created_at)} · <button class="link-button" data-artifact="${esc(a.path)}">OPEN</button></small></div>`).join('')||'<p>No artifacts created yet.</p>'}</section><div class="profile-actions"><button data-assign-to="${esc(e.id)}">Assign task</button>${canRun?`<button data-run-task="${esc(task.id)}">${task.status==='TODO'?'Start task':'Retry task'}</button>`:''}<button data-message-to="${esc(e.name)}">Message employee</button></div>`);
  body.querySelector('[data-assign-to]')?.addEventListener('click',()=>{ $('#detailDialog').close();openTaskForm(id); });
  body.querySelector('[data-run-task]')?.addEventListener('click',async ev=>{await runTask(ev.currentTarget.dataset.runTask);$('#detailDialog').close()});
  body.querySelector('[data-message-to]')?.addEventListener('click',ev=>{state.tab='Chat';selectTab('Chat');$('#detailDialog').close();$('#chatInput').value=`@${ev.currentTarget.dataset.messageTo} `;$('#chatInput').focus()});
  body.querySelectorAll('[data-artifact]').forEach(b=>b.addEventListener('click',()=>viewArtifact(b.dataset.artifact)));
}
function openTask(id){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;const e=employeeById(t.employee_id),p=state.projects.find(x=>x.id===t.project_id);
  const body=showDialog(`<span class="eyebrow">TASK DETAILS</span><h2 style="font:700 19px Manrope;margin:5px 34px 15px 0">${esc(t.title)}</h2><div class="profile-stats"><div class="profile-stat"><small>STATUS</small><b>${esc(t.status)}</b></div><div class="profile-stat"><small>ASSIGNEE</small><b>${esc(e?.name||'Unassigned')}</b></div><div class="profile-stat"><small>PROJECT</small><b>${esc(p?.name||'—')}</b></div><div class="profile-stat"><small>UPDATED</small><b>${dateFmt(t.updated_at)}</b></div></div><section class="profile-section"><h3>DESCRIPTION</h3><p>${esc(t.description||'No description recorded.')}</p></section>${t.result?`<section class="profile-section"><h3>AGENT RESULT</h3><p>${esc(t.result)}</p></section>`:''}<div class="profile-actions">${['TODO','BLOCKED','FAILED'].includes(t.status)?`<button data-run-task="${esc(t.id)}">${t.status==='TODO'?'Start task':'Retry task'}</button>`:''}${e?`<button data-open-employee="${esc(e.id)}">Open ${esc(e.name)} profile</button>`:''}</div>`);
  body.querySelector('[data-run-task]')?.addEventListener('click',async ev=>{await runTask(ev.currentTarget.dataset.runTask);$('#detailDialog').close()});body.querySelector('[data-open-employee]')?.addEventListener('click',ev=>openEmployee(ev.currentTarget.dataset.openEmployee));
}
async function viewArtifact(path){
  try{const r=await fetch('/'+path),a=await r.json();if(!r.ok)throw Error(a.error||'Artifact not found');showDialog(`<span class="eyebrow">SAVED WORKSPACE ARTIFACT</span><h2 style="font:700 18px Manrope;margin:5px 0 13px">${esc(a.name)}</h2><pre style="max-height:60vh;overflow:auto;white-space:pre-wrap;color:#c7d7e0;font:11px/1.6 'DM Mono',monospace">${esc(a.content)}</pre>`)}catch(e){showToast(e.message)}
}
function openCollection(section){
  const sets={Projects:state.projects,Tasks:state.tasks,Employees:state.employees,Chat:state.messages,Activity:state.activity,Meetings:state.meetings,Artifacts:state.artifacts,Approvals:[],Finance:[],Analytics:[],Settings:[]};const items=sets[section]||[];let inner='';
  if(section==='Projects')inner=items.map(p=>{const tasks=projectTasks(p.id),done=tasks.filter(t=>t.status==='COMPLETED').length,pct=tasks.length?Math.round(done/tasks.length*100):0;return `<article class="section-card" data-project="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.status)} · ${tasks.length} tasks · ${pct}% complete</small><p>${esc(p.description)}</p></article>`}).join('');
  else if(section==='Tasks')inner=items.map(t=>`<article class="section-card" data-task-open="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc(t.employee_name||employeeById(t.employee_id)?.name||'Unassigned')} · ${esc(t.status)} · ${dateFmt(t.updated_at)}</small><p>${esc(t.description||'')}</p></article>`).join('');
  else if(section==='Employees')inner=items.map(e=>`<article class="section-card" data-employee-open="${esc(e.id)}"><b>${esc(e.name)} · ${esc(e.role)}</b><small>${esc(statusLabel(e))} · ${esc(e.department)}</small><p>${esc(assignedTask(e)?.title||'No current task')}</p></article>`).join('');
  else if(section==='Chat')inner=[...items].reverse().map(m=>`<article class="section-card"><b>${esc(m.employee_name||'CEO')} · ${dateFmt(m.created_at)}</b><p>${esc(m.body)}</p></article>`).join('');
  else if(section==='Activity')inner=items.map(a=>`<article class="section-card"><b>${esc(a.event.replaceAll('_',' '))}</b><small>${dateFmt(a.created_at)}</small><p>${esc(a.detail)}</p></article>`).join('');
  else if(section==='Meetings')inner=items.map(m=>`<article class="section-card"><b>${esc(m.title)}</b><small>${esc(m.status)} · ${dateFmt(m.starts_at)}</small><p>${esc(m.agenda||'No agenda added.')}</p><small>Participants: ${esc((JSON.parse(m.participants||'[]')).map(id=>employeeById(id)?.name||id).join(', ')||'No participants selected')}</small></article>`).join('');
  else if(section==='Artifacts')inner=items.map(a=>`<article class="section-card" data-artifact-open="${esc(a.path)}"><b>${esc(a.name)}</b><small>${esc(employeeById(a.employee_id)?.name||'Employee')} · ${dateFmt(a.created_at)}</small><p>Open saved artifact ↗</p></article>`).join('');
  else if(section==='Approvals')inner='<article class="section-card"><b>Approval workflow unavailable</b><p>The current backend has no approval records or approve/reject endpoints. This view does not show simulated approvals.</p></article>';
  else if(section==='Finance')inner='<article class="section-card"><b>Finance records unavailable</b><p>The current backend does not track budgets or AI usage costs.</p></article>';
  else if(section==='Analytics')inner=`<article class="section-card"><b>Stored workspace totals</b><small>${state.projects.length} projects · ${state.tasks.length} tasks · ${state.messages.length} messages · ${state.artifacts.length} artifacts</small></article>`;
  else inner='<article class="section-card"><b>Workspace settings</b><p>Local API mode. Configure OPENAI_API_KEY in .env to enable agent task runs.</p></article>';
  const body=showDialog(`<button class="section-back" data-close>BACK TO OFFICE</button><h2>${esc(section)}</h2><div class="section-grid">${inner||'<article class="section-card"><b>No stored records</b><p>There is nothing to show yet.</p></article>'}</div>`);
  body.querySelectorAll('[data-project]').forEach(el=>el.addEventListener('click',()=>openProject(el.dataset.project)));
  body.querySelectorAll('[data-task-open]').forEach(el=>el.addEventListener('click',()=>openTask(el.dataset.taskOpen)));
  body.querySelectorAll('[data-employee-open]').forEach(el=>el.addEventListener('click',()=>openEmployee(el.dataset.employeeOpen)));
  body.querySelectorAll('[data-artifact-open]').forEach(el=>el.addEventListener('click',()=>viewArtifact(el.dataset.artifactOpen)));
}
function openProject(id){const p=state.projects.find(x=>x.id===id);if(!p)return;const tasks=projectTasks(id),done=tasks.filter(t=>t.status==='COMPLETED').length;const body=showDialog(`<span class="eyebrow">PROJECT · ${esc(p.status)}</span><h2 style="font:700 20px Manrope;margin:6px 0 14px">${esc(p.name)}</h2><p style="color:#b8cad4;font-size:11px">${esc(p.description)}</p><div class="profile-stats"><div class="profile-stat"><small>PROGRESS</small><b>${tasks.length?Math.round(done/tasks.length*100):0}%</b></div><div class="profile-stat"><small>TASKS</small><b>${done} / ${tasks.length} completed</b></div></div><div class="section-grid">${tasks.map(t=>`<article class="section-card" data-project-task="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc(t.employee_name||'Unassigned')} · ${esc(t.status)}</small></article>`).join('')||'No project tasks recorded.'}</div>`);body.querySelectorAll('[data-project-task]').forEach(b=>b.addEventListener('click',()=>openTask(b.dataset.projectTask)))}
function selectTab(name){state.tab=name;$('#rightTabs').querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===name));drawRightPanel()}
async function runTask(id){try{await api(`tasks/${encodeURIComponent(id)}/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});showToast('Task execution requested. The display will follow the stored task state.');await refresh()}catch(e){showToast(e.message)}}
async function sendCommand(event){
  event.preventDefault();const input=$('#commandInput'),button=$('#sendCommand'),command=input.value.trim();if(!command)return;
  button.disabled=true;button.innerHTML='<span>…</span> Sending';
  try{const result=await post('commands',{command});input.value='';showToast(result.message);await refresh();if(result.project_id)openProject(result.project_id)}catch(error){showToast(error.message)}finally{button.disabled=false;button.innerHTML='<span>ϟ</span> Send command'}
}
async function sendChat(event){
  event.preventDefault();const input=$('#chatInput'),text=input.value.trim();if(!text)return;
  try{await post('messages',{body:text});input.value='';await refresh()}catch(e){showToast(e.message)}
}
function openTaskForm(employeeId=''){
  if(!state.projects.length){showToast('Create a project with a CEO command before assigning tasks.');return}
  const body=showDialog(`<h2>Assign a task</h2><p>Create a stored task and assign it to a team member.</p><form id="taskCreateForm"><div class="form-field"><label>TASK TITLE</label><input name="title" required maxlength="180" placeholder="What needs to get done?"></div><div class="form-field"><label>DESCRIPTION</label><textarea name="description" placeholder="Add context and acceptance notes"></textarea></div><div class="form-field"><label>PROJECT</label><select name="project_id">${state.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div><div class="form-field"><label>ASSIGNEE</label><select name="employee_id"><option value="">Unassigned</option>${state.employees.map(e=>`<option value="${esc(e.id)}" ${e.id===employeeId?'selected':''}>${esc(e.name)} · ${esc(e.role)}</option>`).join('')}</select></div><button class="form-submit">Create assigned task</button></form>`,true);
  $('#taskCreateForm',body).addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));try{await post('tasks',values);$('#formDialog').close();showToast('Task saved to the company task board.');await refresh();selectTab('Tasks')}catch(err){showToast(err.message)}})
}
async function createProject(){
  const body=showDialog(`<h2>New project</h2><p>Create a project record for the team. You can start agent work with the CEO command after creation.</p><form id="projectCreateForm"><div class="form-field"><label>PROJECT NAME</label><input name="name" required maxlength="120" placeholder="Project name"></div><div class="form-field"><label>DESCRIPTION</label><textarea name="description" placeholder="What is the project about?"></textarea></div><button class="form-submit">Create project</button></form>`,true);
  $('#projectCreateForm',body).addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));try{await post('projects',values);$('#formDialog').close();showToast('Project created.');await refresh();openCollection('Projects')}catch(err){showToast(err.message)}})
}
function scheduleMeeting(){
  const body=showDialog(`<h2>Schedule a meeting</h2><p>Save a meeting time, agenda, and real team participants to the company calendar.</p><form id="meetingForm"><div class="form-field"><label>MEETING TITLE</label><input name="title" required maxlength="160" placeholder="Engineering planning"></div><div class="form-field"><label>DATE AND TIME</label><input name="starts_at" type="datetime-local" required></div><div class="form-field"><label>AGENDA</label><textarea name="agenda" placeholder="Topics to cover"></textarea></div><div class="form-field"><label>PARTICIPANTS</label><select name="participants" multiple size="5">${state.employees.map(e=>`<option value="${esc(e.id)}">${esc(e.name)} · ${esc(e.role)}</option>`).join('')}</select></div><button class="form-submit">Save meeting</button></form>`,true);
  $('#meetingForm',body).addEventListener('submit',async e=>{e.preventDefault();const form=new FormData(e.currentTarget),participants=form.getAll('participants');const startsAt=new Date(form.get('starts_at')).toISOString();try{await post('meetings',{title:form.get('title'),starts_at:startsAt,agenda:form.get('agenda'),participants});$('#formDialog').close();showToast('Meeting added to the company calendar.');await refresh();openCollection('Meetings')}catch(error){showToast(error.message)}})
}
async function generateReport(){
  try{const report=await api('reports/daily',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});showToast('Daily report saved as a workspace artifact.');await refresh();viewArtifact(report.path)}catch(e){showToast(e.message)}
}
function bind(){
  $('#commandForm').addEventListener('submit',sendCommand);$('#refreshButton').addEventListener('click',refresh);$('#newProjectButton').addEventListener('click',createProject);$('#assignTaskButton').addEventListener('click',()=>openTaskForm());$('#scheduleMeetingButton').addEventListener('click',scheduleMeeting);$('#reportButton').addEventListener('click',generateReport);
  $('#rightTabs').querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
  document.querySelectorAll('.rail-nav [data-section]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.rail-nav button').forEach(x=>x.classList.toggle('active',x===b));const section=b.dataset.section;if(section==='Office'){$('#detailDialog').close();return}if(['Chat','Tasks','Employees'].includes(section)){selectTab(section);if(section!=='Chat')openCollection(section);return}openCollection(section)}));
  $('#soundButton').addEventListener('click',()=>showToast('Sound controls are not configured.'));
  $('#helpButton').addEventListener('click',()=>showDialog('<span class="eyebrow">OM AI COMPANY</span><h2 style="font:700 20px Manrope">Workspace guide</h2><p style="color:#bfd0da;font-size:11px;line-height:1.6">Click a team member to inspect their stored task and message history. Use the command bar to create a project plan, or assign a specific task from the bottom dock. The office uses live records from the local API. Features the backend does not support are identified as unavailable rather than filled with sample data.</p>'));
  $('#settingsButton').addEventListener('click',()=>openCollection('Settings'));$('#profileButton').addEventListener('click',()=>showToast('Signed in as local CEO Om Panchal.'));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
  $('#commandInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#commandForm').requestSubmit()}});
}
bind();tickClock();refresh();setInterval(tickClock,1000);setInterval(refresh,2800);
if('EventSource' in window){const stream=new EventSource('/api/events');stream.addEventListener('activity.created',()=>refresh());}
