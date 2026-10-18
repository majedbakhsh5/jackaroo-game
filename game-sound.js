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
  const patterns={tap:[[540,0,.055,'triangle',.025]],deal:[[420,0,.07,'sine',.025],[620,.08,.09,'sine',.03]],move:[[330,0,.07,'triangle',.035],[520,.06,.09,'triangle',.035]],capture:[[180,0,.12,'sawtooth',.035],[420,.08,.13,'triangle',.04]],turn:[[660,0,.1,'sine',.03]],win:[[523,0,.16],[659,.13,.16],[784,.26,.25]],chat:[[720,0,.07,'sine',.025]],join:[[440,0,.09],[660,.09,.13]]};
  function play(name){(patterns[name]||patterns.tap).forEach(a=>tone(...a));}
  function setEnabled(value){enabled=!!value;if(!enabled&&context){context.suspend().catch(()=>{});}else if(enabled&&context&&unlocked)context.resume().catch(()=>{});return enabled;}
  root.JackarooSound={play,setEnabled,get enabled(){return enabled;},wake};
})(typeof window!=='undefined'?window:globalThis);
