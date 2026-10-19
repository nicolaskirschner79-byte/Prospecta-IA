import { PhotonProvider } from './photon.js';
import { OSMProvider,buildQuery } from './osm.js';
import {OvertureProvider} from './overture.js';
export class BusinessProvider{
  constructor(options){this.overture=new OvertureProvider(options);this.photon=new PhotonProvider({...options,timeoutMs:2000});this.overpass=new OSMProvider({...options,requestTimeoutMs:1500,maxAttempts:1});}
  async search(input){
    buildQuery(input);
    try{return await this.overture.search(input);}
    catch(error){if(error.code==='INPUT'||error.code==='LIMIT')throw error;}
    try{return await this.photon.search(input);}
    catch(error){if(error.code==='INPUT'||error.code==='LIMIT')throw error;return this.overpass.search(input);}
  }
  details(input){const data=typeof input==='string'?{id:input}:input;return data.id?.startsWith('overture-')?this.overture.details(data):this.overpass.details(data.id);}
}
