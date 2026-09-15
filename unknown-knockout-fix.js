(function(){
  if(window.__NFPL_UNKNOWN_KO_FIX__) return;
  window.__NFPL_UNKNOWN_KO_FIX__=true;

  function install(){
    if(typeof window.openKnockout!=='function' || typeof window.markOut!=='function'){
      return setTimeout(install,250);
    }
    if(window.__NFPL_UNKNOWN_KO_INSTALLED__) return;
    window.__NFPL_UNKNOWN_KO_INSTALLED__=true;

    const originalOpenKnockout=window.openKnockout;
    window.openKnockout=function(id){
      const result=originalOpenKnockout.apply(this,arguments);
      setTimeout(()=>{
        const overlay=document.getElementById('koOverlay');
        if(!overlay || overlay.querySelector('[data-unknown-ko="1"]')) return;
        const list=overlay.querySelector('.ko-list');
        if(!list) return;

        const btn=document.createElement('button');
        btn.className='ko-choice';
        btn.setAttribute('data-unknown-ko','1');
        btn.innerHTML='<span><b>Unknown / Not Recorded</b><small>Marks this player out without giving a knockout or bounty to anyone.</small></span>';
        btn.addEventListener('click',()=>{
          try{
            if(typeof window.closeKnockout==='function') window.closeKnockout();
            window.markOut(id);
            if(typeof window.toast==='function') window.toast('Saved as Unknown — no knockout or bounty credited');
          }catch(e){
            console.error(e);
          }
        });
        list.appendChild(btn);
      },0);
      return result;
    };
  }

  install();
})();
