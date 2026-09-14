(function(){
  if (window.__NFPL_SYNC_HOTFIX_V2__) return;
  window.__NFPL_SYNC_HOTFIX_V2__ = true;

  function normalizedPayload(raw){
    try{
      const obj = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
      if (obj && obj.state){
        delete obj.state.tab;
        if (obj.state.clock){
          // Countdown drift is device-local display churn. Keep meaningful clock state,
          // but ignore volatile tick fields when deciding whether an auto-push is needed.
          delete obj.state.clock.left;
          delete obj.state.clock.last;
        }
      }
      return JSON.stringify(obj);
    }catch(e){ return String(raw||''); }
  }

  function install(){
    if (typeof window.syncPush !== 'function' || typeof window.syncPayload !== 'function'){
      return setTimeout(install,250);
    }
    if (window.__NFPL_SYNC_HOTFIX_INSTALLED_V2__) return;
    window.__NFPL_SYNC_HOTFIX_INSTALLED_V2__ = true;

    const originalPush = window.syncPush;
    const originalNow = typeof window.syncNow === 'function' ? window.syncNow : null;
    const originalPull = typeof window.syncPull === 'function' ? window.syncPull : null;

    // Maintain our own meaningful-state baseline because the app's internal sync variables
    // are block-scoped and are not available as window properties.
    let lastMeaningful = normalizedPayload(window.syncPayload());
    let allowOneMeaningfulPush = false;

    window.syncPush = function(force){
      try{
        const raw = window.syncPayload();
        const meaningful = normalizedPayload(raw);

        // Ignore timer-tick-only changes. They were causing both devices to push every
        // few seconds and collide forever.
        if (!force && meaningful === lastMeaningful && !allowOneMeaningfulPush){
          if (typeof window.setSyncMessage === 'function') window.setSyncMessage('Up to date','good');
          return;
        }

        lastMeaningful = meaningful;
        allowOneMeaningfulPush = false;
      }catch(e){}
      return originalPush.call(this,force);
    };

    // Explicit AMB Sync should prefer the shared copy first. This breaks an existing
    // conflict loop cleanly instead of trying to push a stale local revision again.
    if (originalNow && originalPull){
      window.syncNow = function(){
        try{
          if (typeof window.setSyncMessage === 'function') window.setSyncMessage('Checking shared copy…','');
          const result = originalPull.call(this,false);
          // After the pull has had time to apply, adopt that state as our baseline so it
          // is not immediately echoed back as a new push.
          setTimeout(()=>{
            try{ lastMeaningful = normalizedPayload(window.syncPayload()); }
            catch(e){}
          },1800);
          return result;
        }catch(e){
          return originalNow.call(this);
        }
      };
    }

    // Real user edits change the normalized payload; the next scheduled sync is allowed
    // to push them. Seed is refreshed periodically only when there has been no change.
    setInterval(()=>{
      try{
        const now = normalizedPayload(window.syncPayload());
        if (now !== lastMeaningful) allowOneMeaningfulPush = true;
      }catch(e){}
    },1000);

    if (typeof window.setSyncMessage === 'function') window.setSyncMessage('Sync ready','good');
  }

  install();
})();
