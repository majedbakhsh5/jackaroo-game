import subprocess,time,urllib.request,urllib.error,json,base64,pathlib,sys
p=subprocess.Popen(['java','-jar',sys.argv[1],'--host','127.0.0.1','--port','9001'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
base='http://127.0.0.1:9001/'
def token(uid):
 e=lambda v:base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
 return e({'alg':'none','typ':'JWT'})+'.'+e({'sub':uid,'user_id':uid,'aud':'demo-jackaroo','iss':'https://securetoken.google.com/demo-jackaroo','iat':int(time.time()),'exp':int(time.time())+3600,'firebase':{'sign_in_provider':'anonymous'}})+'.'
def req(path,method='GET',data=None,uid=None,admin=False):
 url=base+path+'.json?ns=demo-jackaroo'
 headers={'Content-Type':'application/json'}
 if admin:headers['Authorization']='Bearer owner'
 elif uid:url+='&auth='+token(uid)
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
try:
 for i in range(100):
  try:
   s,_=req('.settings/rules','PUT',json.loads(pathlib.Path('database.rules.json').read_text()),admin=True);break
  except OSError:time.sleep(.1)
 assert s==200,(_,s)
 now=int(time.time()*1000); room='v2rooms/security-test/'
 checks=[('unauthenticated read',req(room+'meta')[0],401),('create metadata',req(room+'meta','PUT',{'host':'host','schema':2,'created':now,'expires':now+600000},'host')[0],200),('host seat',req(room+'seats/0','PUT','host','host')[0],200),('guest seat',req(room+'seats/1','PUT','guest','guest')[0],200),('duplicate seat denied',req(room+'seats/2','PUT','guest','guest')[0],401),('steal seat denied',req(room+'seats/1','PUT','other','other')[0],401),('host private state',req(room+'hostState','PUT','{"hands":[]}','host')[0],200),('hostState hidden',req(room+'hostState',uid='guest')[0],401),('own view write by host',req(room+'views/guest','PUT',{'hand':['AS']},'host')[0],200),('own view read',req(room+'views/guest',uid='guest')[0],200),('opponent view denied',req(room+'views/guest',uid='other')[0],401),('forged public write denied',req(room+'public','PUT',{'turn':1},'guest')[0],401)]
 for name,actual,wanted in checks:
  print(name,actual);assert actual==wanted,(name,actual,wanted)
 print('PASS: 12 real database rule checks')
finally:p.terminate();p.wait()
