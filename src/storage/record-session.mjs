import { createEmulatorRecordTransport } from './firestore-record-transport.mjs';
import { createRecordCloudStore } from './cloud-records.mjs';
import { createRecordSync } from './record-sync.mjs';
import { storageError } from './period-projections.mjs';

// This adapter is intentionally opt-in and local-only until a separate production cutover.
export function installRecordSessions(root,{getLocalStore,applicationProjection,readLegacyImports,prepareState,onAdopt,validateIncoming}){
  root.FinizeCloudRecords={
    async createEmulatorSession(options){
      if(!['localhost','127.0.0.1'].includes(root.location.hostname))throw storageError('emulator-only','Een recordsessie vereist de lokale testapplicatie.');
      const localStore=getLocalStore();
      if(options.householdId!==localStore.scope)throw storageError('household-scope','De testsessie hoort bij een ander huishouden.');
      const transport=createEmulatorRecordTransport(options),cloudStore=createRecordCloudStore({...options,transport,applicationProjection,readLegacyImports});
      const sync=createRecordSync({localStore,cloudStore,prepareState,onAdopt,validateIncoming,onStatus:status=>{root.CloudAdapter.status=status;root.renderCloudStatus?.();}});
      return {...sync,transport,
        async attach({automatic=true,periodLoading=true}={}){
          if(getLocalStore().scope!==localStore.scope)throw storageError('household-scope','Het actieve huishouden is gewijzigd.');
          await cloudStore.context();
          const cloud=root.CloudAdapter;cloud.unsubscribe?.();cloud.unsubscribe=null;
          clearTimeout(cloud.saveTimer);clearTimeout(cloud.retryTimer);
          Object.assign(cloud,{recordSession:sync,recordAutomatic:automatic,db:null,docRef:null,initialSyncComplete:true,conflict:false,status:'Testcloud verbonden'});
          if(periodLoading){
            await cloudStore.preparePeriodStorage();
            const state=await localStore.load(),snapshot=await localStore.readCloudSnapshot();
            if(!state.__finizePartialHistory&&snapshot.operations.length){
              if((await sync.establishBase()).outcome!=='matched')throw storageError('cloud-conflict','De bestaande administratie moet eerst veilig worden bevestigd.');
              await sync.sync();
            }
            const result=await sync.openMonth(state.meta.selectedMonth||new Date().toISOString().slice(0,7));
            if(result.outcome!=='committed')throw storageError('period-incomplete','De actieve maand kan nog niet veilig worden geopend.');
            cloud.pendingState=null;
          }
          return sync;
        }
      };
    }
  };
}
