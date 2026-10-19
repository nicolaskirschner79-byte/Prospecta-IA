export const photonCity=(state='São Paulo',extent=[-49.2,-23.5,-48.5,-24.2])=>({type:'Feature',geometry:{type:'Point',coordinates:[-48.88,-23.98]},properties:{osm_type:'R',osm_id:298034,name:'Itapeva',state,countrycode:'BR',extent}});
export const photonBusiness=(extra={})=>({type:'Feature',geometry:{type:'Point',coordinates:[-48.88,-23.98]},properties:{osm_type:'N',osm_id:42,name:'Café do fluxo de teste',osm_key:'amenity',osm_value:'cafe',city:'Itapeva',state:'São Paulo',countrycode:'BR',...extra}});
export function photonResponse(url,properties={}){
  const params=new URL(String(url)).searchParams;
  return Response.json({features:params.has('bbox')?[photonBusiness(properties)]:[photonCity('Minas Gerais'),photonCity()]});
}
