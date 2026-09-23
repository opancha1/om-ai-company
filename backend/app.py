"""Local Om AI Company service. Uses only Python's standard library."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import json, os, sqlite3, threading, uuid, urllib.request, urllib.error
import mimetypes
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "company.sqlite3"
ARTIFACTS = ROOT / "workspace"
DB.parent.mkdir(exist_ok=True); ARTIFACTS.mkdir(exist_ok=True)
LOCK = threading.RLock()
EMPLOYEES = [
 ("Ava","CEO Assistant","Executive","Summarize work and coordinate CEO requests."),
 ("James","Project Manager","Operations","Plan work, dependencies, and report project status."),
 ("Alex","Software Engineer","Engineering","Implement software and inspect project files."),
 ("Mia","UI/UX Designer","Design","Write practical interface and user flow specifications."),
 ("Noah","Researcher","Research","Research questions and document sourced findings."),
 ("Emma","Data Analyst","Data","Analyze supplied data without inventing values."),
 ("Sophia","Marketing","Marketing","Create marketing strategy and copy."),
 ("Olivia","QA Engineer","Quality","Prepare and perform verifiable quality checks."),
 ("Liam","Finance","Finance","Estimate costs and track simulated project budgets.")]

def connect():
 class ClosingConnection(sqlite3.Connection):
  def __exit__(self, exc_type, exc, tb):
   try: return super().__exit__(exc_type,exc,tb)
   finally: self.close()
 c=sqlite3.connect(DB, timeout=15, factory=ClosingConnection); c.row_factory=sqlite3.Row; c.execute("PRAGMA foreign_keys=ON"); return c
def now(): return datetime.now(timezone.utc).isoformat()
def init():
 with connect() as c:
  c.executescript('''CREATE TABLE IF NOT EXISTS employees(id TEXT PRIMARY KEY,name TEXT,role TEXT,department TEXT,instructions TEXT,status TEXT DEFAULT 'Available',current_task TEXT,created_at TEXT);
  CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT,description TEXT,status TEXT,priority TEXT,created_at TEXT);
  CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),title TEXT,description TEXT,employee_id TEXT REFERENCES employees(id),status TEXT,created_at TEXT,updated_at TEXT,result TEXT);
  CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,project_id TEXT,employee_id TEXT REFERENCES employees(id),body TEXT,created_at TEXT);
  CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY,project_id TEXT,task_id TEXT,name TEXT,path TEXT,employee_id TEXT,created_at TEXT);
  CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,event TEXT,detail TEXT,created_at TEXT);
  CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY,title TEXT,agenda TEXT,starts_at TEXT,participants TEXT,status TEXT,created_at TEXT);''')
  for e in EMPLOYEES: c.execute("INSERT OR IGNORE INTO employees(id,name,role,department,instructions,status,created_at) VALUES(?,?,?,?,?,'Available',?)",(e[0].lower(),*e,now()))
  if c.execute('SELECT count(*) FROM projects').fetchone()[0]==0:
   pid='restaurant-website'; c.execute("INSERT INTO projects VALUES(?,?,?,?,?,?)",(pid,'Restaurant Website','Starter project for the Om AI Company workspace.','ACTIVE','NORMAL',now()))
   for who,title in [('noah','Research competitors'),('mia','Design homepage'),('alex','Build frontend'),('olivia','QA testing')]: c.execute("INSERT INTO tasks(id,project_id,title,description,employee_id,status,created_at,updated_at) VALUES(?,?,?,?,?,'TODO',?,?)",(uuid.uuid4().hex,pid,title,'Initial demo task. Assign or start it from the task board.',who,now(),now()))
def rows(c,sql,args=()): return [dict(x) for x in c.execute(sql,args).fetchall()]
def log(c,event,detail): c.execute('INSERT INTO activity VALUES(?,?,?,?)',(uuid.uuid4().hex,event,detail,now()))
def run_task(task_id):
 with LOCK, connect() as c:
  t=c.execute('SELECT * FROM tasks WHERE id=?',(task_id,)).fetchone()
  if not t or t['status'] not in ('TODO','BLOCKED','FAILED'): return
  c.execute("UPDATE tasks SET status='IN_PROGRESS',updated_at=? WHERE id=?",(now(),task_id)); c.execute("UPDATE employees SET status='Working',current_task=? WHERE id=?",(t['title'],t['employee_id'])); log(c,'task_started',t['title'])
  emp=c.execute('SELECT * FROM employees WHERE id=?',(t['employee_id'],)).fetchone()
  prompt=f"You are {emp['name']}, {emp['role']}. Do the assigned work: {t['title']}\nContext: {t['description']}\nWrite concrete, useful work. Do not claim actions you did not perform."
  key=os.getenv('OPENAI_API_KEY'); model=os.getenv('OPENAI_MODEL','gpt-4.1-mini')
  if not key:
   result='Blocked: OPENAI_API_KEY is not configured. Set it in .env and retry. No AI work was performed.'; status='BLOCKED'
  else:
   try:
    req=urllib.request.Request('https://api.openai.com/v1/responses',data=json.dumps({'model':model,'input':prompt}).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=90) as response: data=json.loads(response.read())
    result='\n'.join(x.get('text','') for o in data.get('output',[]) for x in o.get('content',[]) if x.get('type')=='output_text').strip()
    if not result: raise RuntimeError('Provider returned no text output')
    status='COMPLETED'
   except Exception as ex: result=f'Agent failed: {type(ex).__name__}: {ex}'; status='FAILED'
  c.execute('UPDATE tasks SET status=?,updated_at=?,result=? WHERE id=?',(status,now(),result,task_id)); c.execute("UPDATE employees SET status='Available',current_task=NULL WHERE id=?",(t['employee_id'],))
  c.execute('INSERT INTO messages VALUES(?,?,?,?,?)',(uuid.uuid4().hex,t['project_id'],t['employee_id'],result,now())); log(c,'task_'+status.lower(),t['title'])
  if status=='COMPLETED':
   path=ARTIFACTS/(task_id+'.md'); path.write_text('# '+t['title']+'\n\n'+result)
   c.execute('INSERT INTO artifacts VALUES(?,?,?,?,?,?,?)',(uuid.uuid4().hex,t['project_id'],task_id,path.name,str(path.relative_to(ROOT)),t['employee_id'],now())); log(c,'artifact_created',path.name)
def command(text):
 if not text.strip(): raise ValueError('Command cannot be empty')
 with connect() as c:
  prompt=text.strip(); title=' '.join(prompt.split())[:80]
  if 'restaurant' in prompt.lower() and any(x in prompt.lower() for x in ['build','website','site']): title="Om's Kitchen Website" if "om's kitchen" in prompt.lower() else 'Restaurant Website'
  pid=uuid.uuid4().hex; c.execute('INSERT INTO projects VALUES(?,?,?,?,?,?)',(pid,title,prompt,'ACTIVE','NORMAL',now())); log(c,'project_created',title)
  plan=[('james','Create project plan'),('noah','Research relevant examples'),('mia','Create interface specification'),('alex','Implement requested work'),('sophia','Create supporting marketing content'),('olivia','Prepare quality review'),('liam','Estimate simulated project costs')]
  tids=[]
  for who,name in plan:
   tid=uuid.uuid4().hex; tids.append(tid); c.execute('INSERT INTO tasks(id,project_id,title,description,employee_id,status,created_at,updated_at) VALUES(?,?,?,?,? ,\'TODO\',?,?)',(tid,pid,name,prompt,who,now(),now())); log(c,'task_created',name)
  c.execute('INSERT INTO messages VALUES(?,?,?,?,?)',(uuid.uuid4().hex,pid,'ava',f'Received CEO command: {prompt}\nProject created with {len(plan)} assigned tasks. Tasks require an OpenAI key to run.',now()))
 for tid in tids: threading.Thread(target=run_task,args=(tid,),daemon=True).start()
 return {'project_id':pid,'task_ids':tids,'message':'Project and tasks created; assigned agents are starting.'}

class Handler(BaseHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def respond(self,obj,status=200):
  b=json.dumps(obj).encode(); self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.send_header('Access-Control-Allow-Origin','*'); self.end_headers(); self.wfile.write(b)
 def do_OPTIONS(self): self.send_response(204); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','Content-Type'); self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS'); self.end_headers()
 def do_GET(self):
  if self.path=='/api/events':
   self.send_response(200); self.send_header('Content-Type','text/event-stream'); self.send_header('Cache-Control','no-cache'); self.send_header('Connection','keep-alive'); self.send_header('Access-Control-Allow-Origin','*'); self.end_headers(); cursor=now()
   try:
    while True:
     with connect() as c: events=rows(c,'SELECT * FROM activity WHERE created_at>? ORDER BY created_at LIMIT 50',(cursor,))
     if events:
      for event in events:
       cursor=event['created_at']; payload=json.dumps(event); self.wfile.write(f"id: {event['id']}\nevent: activity.created\ndata: {payload}\n\n".encode())
      self.wfile.flush()
     else: self.wfile.write(b': keep-alive\n\n'); self.wfile.flush()
     threading.Event().wait(1)
   except (BrokenPipeError,ConnectionResetError,OSError): return
  if self.path=='/' or self.path.startswith('/static/'):
   p=(ROOT/'frontend'/'index.html') if self.path=='/' else (ROOT/'frontend'/self.path.removeprefix('/static/'))
   try:
    body=p.read_bytes(); self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(str(p))[0] or 'application/octet-stream'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
   except OSError: return self.respond({'error':'Not found'},404)
  with connect() as c:
   routes={'/api/company':lambda:{'name':'Om AI Company','role':'CEO','time':now()},'/api/employees':lambda:rows(c,'SELECT e.*, (SELECT count(*) FROM tasks t WHERE t.employee_id=e.id) task_count FROM employees e ORDER BY name'),'/api/projects':lambda:rows(c,'SELECT p.*, (SELECT count(*) FROM tasks t WHERE t.project_id=p.id) task_count,(SELECT count(*) FROM tasks t WHERE t.project_id=p.id AND t.status=\'COMPLETED\') done FROM projects p ORDER BY created_at DESC'),'/api/tasks':lambda:rows(c,'SELECT t.*,e.name employee_name FROM tasks t LEFT JOIN employees e ON e.id=t.employee_id ORDER BY t.created_at DESC'),'/api/messages':lambda:rows(c,'SELECT m.*,COALESCE(e.name,\'CEO\') employee_name FROM messages m LEFT JOIN employees e ON e.id=m.employee_id ORDER BY m.created_at DESC LIMIT 100'),'/api/activity':lambda:rows(c,'SELECT * FROM activity ORDER BY created_at DESC LIMIT 100'),'/api/artifacts':lambda:rows(c,'SELECT * FROM artifacts ORDER BY created_at DESC'),'/api/meetings':lambda:rows(c,'SELECT * FROM meetings ORDER BY starts_at DESC')}
   if self.path in routes: return self.respond(routes[self.path]())
   if self.path.startswith('/workspace/'):
    p=(ROOT/self.path.removeprefix('/')).resolve()
    if ARTIFACTS.resolve() not in p.parents: return self.respond({'error':'Not found'},404)
    try: return self.respond({'name':p.name,'content':p.read_text()})
    except OSError: return self.respond({'error':'Not found'},404)
  self.respond({'error':'Not found'},404)
 def do_POST(self):
  try: data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
  except Exception: return self.respond({'error':'Invalid JSON'},400)
  try:
   if self.path=='/api/commands': return self.respond(command(str(data.get('command',''))),202)
   if self.path=='/api/projects':
    name=str(data.get('name','')).strip()
    if not name: raise ValueError('Project name cannot be empty')
    with connect() as c:
     pid=uuid.uuid4().hex; c.execute('INSERT INTO projects VALUES(?,?,?,?,?,?)',(pid,name[:120],str(data.get('description','')),'ACTIVE','NORMAL',now())); log(c,'project_created',name[:120]); return self.respond({'id':pid,'name':name[:120]},201)
   if self.path=='/api/messages':
    body=str(data.get('body','')).strip()
    if not body: raise ValueError('Message cannot be empty')
    with connect() as c:
     mid=uuid.uuid4().hex; c.execute('INSERT INTO messages VALUES(?,?,?,?,?)',(mid,data.get('project_id'),None,body[:4000],now())); log(c,'message_created','CEO posted to company updates'); return self.respond({'id':mid},201)
   if self.path=='/api/meetings':
    title=str(data.get('title','')).strip(); starts_at=str(data.get('starts_at','')).strip(); participants=data.get('participants',[])
    if not title or not starts_at: raise ValueError('Meeting title and start time are required')
    if not isinstance(participants,list): raise ValueError('Participants must be a list')
    with connect() as c:
     mid=uuid.uuid4().hex; c.execute('INSERT INTO meetings VALUES(?,?,?,?,?,?,?)',(mid,title[:160],str(data.get('agenda',''))[:3000],starts_at,json.dumps([str(x) for x in participants]),'SCHEDULED',now())); log(c,'meeting_scheduled',f'{title[:160]} · {starts_at}'); return self.respond({'id':mid},201)
   if self.path=='/api/reports/daily':
    with connect() as c:
     projects=rows(c,'SELECT * FROM projects ORDER BY created_at DESC'); tasks=rows(c,'SELECT t.*,e.name employee_name FROM tasks t LEFT JOIN employees e ON e.id=t.employee_id ORDER BY t.created_at DESC'); messages=rows(c,'SELECT m.*,COALESCE(e.name,\'CEO\') employee_name FROM messages m LEFT JOIN employees e ON e.id=m.employee_id ORDER BY m.created_at DESC LIMIT 12'); activity=rows(c,'SELECT * FROM activity ORDER BY created_at DESC LIMIT 15')
     counts={s:sum(1 for t in tasks if t['status']==s) for s in ['TODO','IN_PROGRESS','BLOCKED','IN_REVIEW','APPROVED','COMPLETED','FAILED','CANCELLED']}
     stamp=datetime.now(timezone.utc); lines=['# Om AI Company — Daily Executive Report', '',f'Generated from persisted workspace data at {stamp.isoformat()}.','', '## Company state',f'- Projects: {len(projects)}',f'- Tasks: {len(tasks)}',*[f'- {s.replace("_"," ").title()}: {n}' for s,n in counts.items()], '', '## Projects']
     lines += [f'- **{p["name"]}** ({p["status"]}) — {p["description"]}' for p in projects] or ['- No projects recorded.']
     lines += ['', '## Recent task records']
     lines += [f'- **{t["title"]}** — {t["status"]}; assigned to {t["employee_name"] or "unassigned"}.' for t in tasks[:20]] or ['- No tasks recorded.']
     lines += ['', '## Recent company messages']
     lines += [f'- {m["employee_name"]}: {m["body"].replace(chr(10)," ")}' for m in messages] or ['- No messages recorded.']
     lines += ['', '## Recent activity']
     lines += [f'- {a["event"].replace("_"," ")} — {a["detail"]} ({a["created_at"]})' for a in activity] or ['- No activity recorded.']
     path=ARTIFACTS/f'daily-report-{stamp.strftime("%Y%m%d-%H%M%S")}.md'; path.write_text('\n'.join(lines)+'\n'); rel=str(path.relative_to(ROOT)); aid=uuid.uuid4().hex
     c.execute('INSERT INTO artifacts VALUES(?,?,?,?,?,?,?)',(aid,None,None,path.name,rel,'ava',now())); log(c,'artifact_created',path.name); return self.respond({'id':aid,'name':path.name,'path':rel},201)
   if self.path.startswith('/api/tasks/') and self.path.endswith('/run'):
    tid=self.path.split('/')[-2]; threading.Thread(target=run_task,args=(tid,),daemon=True).start(); return self.respond({'message':'Task execution requested'},202)
   if self.path=='/api/tasks':
    with connect() as c:
     tid=uuid.uuid4().hex; stamp=now(); employee_id=data.get('employee_id') or None; title=str(data['title']).strip()
     if not title: raise ValueError('Task title cannot be empty')
     c.execute('INSERT INTO tasks(id,project_id,title,description,employee_id,status,created_at,updated_at) VALUES(?,?,?,?,?,\'TODO\',?,?)',(tid,data['project_id'],title[:180],str(data.get('description','')),employee_id,stamp,stamp)); log(c,'task_created',title[:180]);
     if employee_id: log(c,'task_assigned',f'{title[:180]} → {employee_id}')
     return self.respond({'id':tid},201)
   self.respond({'error':'Not found'},404)
  except (ValueError,KeyError) as e: self.respond({'error':str(e)},400)
 def log_message(self,*args): pass
if __name__=='__main__':
 init(); print('Om AI Company API listening on http://127.0.0.1:8000'); ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
