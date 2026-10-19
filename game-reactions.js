/* Shared catalog for the lightweight multiplayer reaction layer. */
(function(root){
  'use strict';
  const items=[
    {emoji:'😂',key:'laughing',label:'ضحك',hint:'تفاعل ضاحك'},
    {emoji:'👏',key:'applause',label:'تصفيق',hint:'تفاعل تصفيق'},
    {emoji:'🤩',key:'excitement',label:'حماس',hint:'تفاعل حماس'},
    {emoji:'😮',key:'surprise',label:'مفاجأة',hint:'تفاعل مفاجأة'},
    {emoji:'👋',key:'greeting',label:'تحية',hint:'تفاعل تحية'},
    {emoji:'🎉',key:'celebration',label:'احتفال',hint:'تفاعل احتفال'}
  ];
  const byEmoji=new Map(items.map(item=>[item.emoji,item]));
  function normalize(value){
    const emoji=typeof value==='string'?value:value?.emoji;
    const item=byEmoji.get(emoji);
    return item?{...item}:null;
  }
  function seatPosition(seat,localSeat){
    const p=Number(seat),local=Number(localSeat);
    if(!Number.isInteger(p)||p<0||p>3)return 'center';
    const offset=(p-(Number.isInteger(local)&&local>=0?local:0)+4)%4;
    return ['br','bl','tl','tr'][offset];
  }
  const api={items:Object.freeze(items.map(item=>Object.freeze({...item}))),normalize,seatPosition,
    isAllowed:value=>!!normalize(value)};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JackarooReactions=api;
})(typeof window!=='undefined'?window:globalThis);
