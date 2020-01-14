import store from '../../store';
import {Map} from 'immutable';

export const all = () =>{
    let list = [...store.getState().runs.byId.values()]
    list.sort((a,b)=>a.start - b.start);
    return list;
}
export const testRuns = (id) => ()=>{
    let list = [...store.getState().runs.byTest.get(id,Map({})).values()]
    list.sort((a,b)=>a.id - b.id);
    return list;    
}
export const get = (id) => ()=>{
    return store.getState().runs.byId.get(id) || false;
}
export const filter = () => {
   const filteredIds = store.getState().runs.filteredIds
   if (filteredIds == null) {
      return all();
   }
   const byId = store.getState().runs.byId
   let list = [...byId.filter((v, k) => filteredIds.includes(k)).values()]
   list.sort((a,b)=>a.id - b.id);
   return list;
}