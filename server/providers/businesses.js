import { PhotonProvider } from './photon.js';
import { OSMProvider,buildQuery } from './osm.js';
export class BusinessProvider{
  constructor(options){this.photon=new PhotonProvider(options);this.overpass=new OSMProvider({...options,requestTimeoutMs:5000,maxAttempts:1});}
  async search(input){
    buildQuery(input);
    try{return await this.photon.search(input);}
    catch(error){if(error.code==='INPUT'||error.code==='LIMIT')throw error;return this.overpass.search(input);}
  }
  details(id){return this.overpass.details(id);}
}
