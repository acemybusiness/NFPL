(function(){
  if (window.__NFPL_SYNC_HOTFIX_V1__) return;
  window.__NFPL_SYNC_HOTFIX_V1__ = true;

  function normalizedPayload(raw){
    try{
      const obj = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
      if (obj && obj.state && obj.state.clock){
        delete obj.state.clock.left;
        delete obj.state.clock.last;
      }
      if (obj && obj.state) delete obj.state.tab;
      return JSON.stringify(obj);
    }catch(e){ return String(raw||''); }
  }

  function install(){
    if (typeof window.syncPush !== 'function' || typeof window.syncPayload !== 'function'){
      return setTimeout(install,250);
    }
    if (window.__NFPL_SYNC_HOTFIX_INSTALLED__) return;
    window.__NFPL_SYNC_HOTFIX_INSTALLED__ = true;

    const originalPush = window.syncPush;
    const originalNow = typeof window.syncNow === 'function' ? window.syncNow : null;

    window.syncPush = function(force){
      try{
        const current = window.syncPayload();
        const baseline = window.nfplLastSyncedState || '';

        // Timer countdown ticks are local display updates, not meaningful shared edits.
        if (!force && baseline && normalizedPayload(current) === normalizedPayload(baseline)){
          window.nfplLastSyncedState = current;
          if (typeof window.setSyncMessage === 'function') window.setSyncMessage('Up to date','good');
          return;
        }

        // Never keep hammering the backend while a newer cloud revision is waiting.
        if (!force && window.nfplConflict){
          if (typeof window.setSyncMessage === 'function') window.setSyncMessage('Newer copy available','warn');
          return;
        }
      }catch(e){}
      return originalPush.call(this,force);
    };

    if (originalNow){
      window.syncNow = function(){
        try{
          const current = window.syncPayload();
          const baseline = window.nfplLastSyncedState || '';
          const timerOnly = baseline && normalizedPayload(current) === normalizedPayload(baseline);
          if (timerOnly && typeof window.syncPull === 'function'){
            return window.syncPull(false);
          }
        }catch(e){}
        return originalNow.call(this);
      };
    }

    if (typeof window.setSyncMessage === 'function') window.setSyncMessage('Sync ready','good');
  }

  install();
})();
