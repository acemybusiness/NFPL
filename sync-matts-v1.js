/* NFPL Matt-style shared sync v1
   Sync-only overlay for the locked NFPL v14 root build.
   The Google/AMB record is the shared source; countdown-only ticks are local. */
(function(){
  'use strict';
  if(window.__NFPL_MATTS_SYNC_V1__)return;
  window.__NFPL_MATTS_SYNC_V1__=true;

  try{localStorage.removeItem(NFPL_SYNC_ENDPOINT_KEY);}catch(e){}
  syncEndpoint=function(){return String(window.NFPL_SYNC_ENDPOINT||'').trim();};

  function comparable(payloadJson){
    try{
      const pack=JSON.parse(payloadJson||syncPayload());
      if(pack&&pack.state){
        delete pack.state.tab;
        if(pack.state.clock){
          delete pack.state.clock.left;
          delete pack.state.clock.last;
        }
      }
      return JSON.stringify(pack);
    }catch(e){return String(payloadJson||'');}
  }

  function meaningfulDirty(){
    return !!nfplLastSyncedState && comparable(syncPayload())!==comparable(nfplLastSyncedState);
  }

  function catchUpClock(){
    try{
      if(!state||!state.clock||!state.clock.running)return;
      const last=Number(state.clock.last||0);
      if(!last)return;
      let elapsed=Math.max(0,Math.floor((Date.now()-last)/1000));
      if(!elapsed)return;
      const levels=Array.isArray(state.settings&&state.settings.blindLevels)?state.settings.blindLevels:[];
      if(!levels.length)return;
      let i=Math.max(0,Math.min(levels.length-1,Number(state.currentBlind||0)));
      let left=Math.max(0,Number(state.clock.left||0));
      if(left<=0)left=Math.max(1,Number((levels[i]&&levels[i].min)||state.settings.blindLevelDuration||15)*60);
      while(elapsed>=left&&i<levels.length-1){
        elapsed-=left;
        i++;
        left=Math.max(1,Number((levels[i]&&levels[i].min)||state.settings.blindLevelDuration||15)*60);
      }
      if(elapsed>=left&&i>=levels.length-1){
        left=0;
        state.clock.running=false;
      }else{
        left=Math.max(0,left-elapsed);
      }
      state.currentBlind=i;
      state.clock.left=left;
      state.clock.last=Date.now();
    }catch(e){}
  }

  scheduleAutoSync=function(){
    if(!nfplSync.autoSync||!syncHosted())return;
    clearTimeout(nfplAutoTimer);
    nfplAutoTimer=setTimeout(function(){
      if(nfplSyncBusy)return scheduleAutoSync();
      if(meaningfulDirty())syncPush(false);
    },900);
  };

  function acceptPush(res,payload){
    nfplConflict=false;
    nfplSync.revision=Number((res&&res.revision)||nfplSync.revision||0);
    nfplSync.lastCloudAt=(res&&res.updatedAt)||'';
    nfplLastSyncedState=payload;
    saveSyncConfig();
    setSyncMessage('Synced','good');
  }

  syncPush=function(force){
    if(nfplSyncBusy||!syncHosted())return;
    if(!force&&nfplLastSyncedState&&!meaningfulDirty())return;
    nfplSyncBusy=true;
    setSyncMessage('Syncing…','');
    const payload=syncPayload();

    function send(baseRevision,forceWrite,retried){
      cloudCall('nfplSyncPush',[
        nfplSync.linkId,
        nfplSync.deviceId,
        Number(baseRevision||0),
        payload,
        !!forceWrite
      ],function(res){
        if(res&&res.ok){
          nfplSyncBusy=false;
          acceptPush(res,payload);
          return;
        }
        if(res&&res.conflict&&!retried){
          nfplSync.revision=Number(res.revision||nfplSync.revision||0);
          saveSyncConfig();
          cloudCall('nfplSyncPull',[nfplSync.linkId],function(latest){
            if(!latest||!latest.ok){
              nfplSyncBusy=false;
              setSyncMessage('Sync failed','bad');
              return;
            }
            const latestRevision=Number(latest.revision||nfplSync.revision||0);
            if(latest.found&&comparable(latest.payload||'')===comparable(payload)){
              nfplSyncBusy=false;
              nfplSync.revision=latestRevision;
              nfplSync.lastCloudAt=latest.updatedAt||'';
              nfplLastSyncedState=payload;
              nfplConflict=false;
              saveSyncConfig();
              setSyncMessage('Synced','good');
              return;
            }
            /* One real local edit wins one revision race, then all clean devices pull it. */
            send(latestRevision,true,true);
          },function(){
            nfplSyncBusy=false;
            setSyncMessage('Sync failed','bad');
          });
          return;
        }
        nfplSyncBusy=false;
        setSyncMessage('Sync failed','bad');
      },function(){
        nfplSyncBusy=false;
        setSyncMessage('Sync failed','bad');
      });
    }

    send(Number(nfplSync.revision||0),!!force,false);
  };

  syncPull=function(silent){
    if(nfplSyncBusy||!syncHosted())return;
    if(silent&&meaningfulDirty())return;
    nfplSyncBusy=true;
    if(!silent)setSyncMessage('Syncing…','');

    cloudCall('nfplSyncPull',[nfplSync.linkId],function(res){
      nfplSyncBusy=false;
      if(!res||!res.ok){
        if(!silent)setSyncMessage('Sync failed','bad');
        return;
      }
      if(!res.found){
        nfplSync.revision=0;
        saveSyncConfig();
        nfplLastSyncedState=syncPayload();
        setSyncMessage('Ready','good');
        return;
      }
      try{
        const pack=JSON.parse(res.payload||'{}');
        if(!pack.state)throw new Error('Shared state is empty');
        const localTab=state&&state.tab?state.tab:'setup';
        /* A silent background refresh may update shared game data, but it must
           never replace the blind level/timer that is actively running on
           this device. Manual Sync Now can still intentionally load the
           shared clock when the local clock is paused. */
        const protectRunningClock=!!(silent&&state&&state.clock&&state.clock.running);
        const localBlind=protectRunningClock?Number(state.currentBlind||0):0;
        const localClock=protectRunningClock?Object.assign({},state.clock):null;
        state=deepMerge(defaultState(),pack.state);
        state.tab=localTab;
        if(protectRunningClock){
          const levels=Array.isArray(state.settings&&state.settings.blindLevels)?state.settings.blindLevels:[];
          state.currentBlind=Math.max(0,Math.min(Math.max(0,levels.length-1),localBlind));
          state.clock=Object.assign({},state.clock||{},localClock,{running:true,last:Date.now()});
        }
        normalize();
        if(!protectRunningClock)catchUpClock();
        if(Array.isArray(pack.eventLibrary))setEventLibraryNoSync(pack.eventLibrary);
        localStorage.setItem(KEY,JSON.stringify(state));
        nfplSync.revision=Number(res.revision||0);
        nfplSync.lastCloudAt=res.updatedAt||'';
        nfplConflict=false;
        saveSyncConfig();
        nfplLastSyncedState=syncPayload();
        render();
        setSyncMessage('Up to date','good');
      }catch(e){
        setSyncMessage('Shared data error','bad');
      }
    },function(){
      nfplSyncBusy=false;
      if(!silent)setSyncMessage('Sync failed','bad');
    });
  };

  syncNow=function(){
    if(meaningfulDirty())syncPush(false);
    else syncPull(false);
  };

  syncForcePush=function(){
    if(confirm('Overwrite the shared NFPL copy with this device?'))syncPush(true);
  };

  backgroundPull=function(){
    if(!nfplSync.autoSync||!syncHosted()||nfplSyncBusy||meaningfulDirty())return;
    syncPull(true);
  };

  /* Extra clean-device refresh. Original 6-second loop remains safe because
     its call to syncPush now ignores countdown-only changes. */
  setInterval(function(){backgroundPull();},5000);
  setTimeout(function(){if(syncHosted())syncPull(true);},100);
})();
