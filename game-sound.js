/* Small synthesized game cues; AudioContext starts only after a player gesture. */
(function(root){
  let context=null, enabled=true, unlocked=false;
  function wake(){
    if(!enabled)return;
    const C=root.AudioContext||root.webkitAudioContext;
    if(!C)return;
    try{context=context||new C();if(context.state==='suspended')context.resume();unlocked=true;}catch(_){context=null;}
  }
  function tone(frequency,delay,duration,wave='sine',volume=.035){
    if(!enabled)return;
    if(!unlocked){wake();return;}
    try{
      const now=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
      osc.type=wave;osc.frequency.setValueAtTime(frequency,now);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+duration+.02);
    }catch(_){/* Audio never blocks a move. */}
  }
  const patterns={cardSelect:[[610,0,.045,'triangle',.018],[850,.025,.035,'sine',.01]],cardFlip:[[360,0,.055,'triangle',.015],[720,.045,.06,'sine',.018]],cardPlay:[[300,0,.06,'triangle',.022],[540,.045,.08,'sine',.025]],tap:[[540,0,.055,'triangle',.025]],deal:[[420,0,.07,'sine',.025],[620,.08,.09,'sine',.03]],move:[[330,0,.07,'triangle',.035],[520,.06,.09,'triangle',.035]],capture:[[180,0,.12,'sawtooth',.035],[420,.08,.13,'triangle',.04]],turn:[[660,0,.1,'sine',.03]],warning:[[820,0,.07,'square',.025],[620,.1,.1,'square',.025]],home:[[440,0,.08,'triangle',.03],[620,.1,.13,'triangle',.03]],safe:[[520,0,.1,'sine',.03],[700,.1,.12,'sine',.03],[880,.21,.18,'sine',.03]],teamCapture:[[210,0,.1,'triangle',.03],[360,.1,.14,'sine',.03]],discard:[[260,0,.1,'triangle',.03]],win:[[523,0,.16],[659,.13,.16],[784,.26,.25]],chat:[[720,0,.07,'sine',.025]],join:[[440,0,.09],[660,.09,.13]],reaction:[[740,0,.045,'sine',.014],[980,.045,.055,'triangle',.012]]};
  const marble=[
    [[760,0,.045,'triangle',.018],[1420,.004,.075,'sine',.012]],
    [[810,0,.042,'triangle',.017],[1510,.005,.068,'sine',.011]],
    [[705,0,.048,'triangle',.019],[1330,.006,.08,'sine',.012]],
    [[785,0,.044,'triangle',.018],[1465,.004,.071,'sine',.011]]
  ];
  let marbleIndex=0;
  function play(name){
    const pattern=name==='marble'?marble[marbleIndex++%marble.length]:(patterns[name]||patterns.tap);
    pattern.forEach(a=>tone(...a));
  }
  function setEnabled(value){enabled=!!value;if(!enabled&&context){context.suspend().catch(()=>{});}else if(enabled&&context&&unlocked)context.resume().catch(()=>{});return enabled;}
  root.JackarooSound={play,setEnabled,get enabled(){return enabled;},wake};
})(typeof window!=='undefined'?window:globalThis);
