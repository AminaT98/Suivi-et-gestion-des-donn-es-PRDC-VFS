const $ = id => document.getElementById(id);
const labels={all:'Vue d’ensemble',infrastructures:'Infrastructures',interconnexion:'Interconnexion transfrontalière',social:'Cohésion sociale'};
const colors={'École':'#309329','Poste de santé':'#c83d42','Marché':'#e2b52c','Piste rurale':'#277da1','Autre':'#7b61a8','Non renseigné':'#6b7280','Interconnexion transfrontalière':'#2477a8','Cohésion sociale':'#8b5cf6'};
let data={infrastructures:[],interconnexion:[],social:[]},active='all',filtered=[],map=null,markerRefs=[],selectedId=null;
function allRecords(){return Object.entries(data).flatMap(([ds,items])=>items.map(r=>({...r,dataset:ds})))}
function dateFor(r){return r.date||''}
function yearFor(r){const value=dateFor(r);if(value!==null&&value!==undefined&&String(value).trim()!==''){const d=String(value).trim();const iso=d.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);if(iso)return iso[1];const parsed=new Date(d);if(!Number.isNaN(parsed.getTime()))return String(parsed.getFullYear())}return r.dateColumnExists?'En cours':'2025'}
function validGPS(r){if(r.lat===null||r.lat===undefined||r.lon===null||r.lon===undefined||String(r.lat).trim()===''||String(r.lon).trim()==='')return false;const lat=Number(r.lat),lon=Number(r.lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0)}
function niceDate(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}
function esc(v){return String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function displayType(r){return r.type||r.name||labels[r.dataset]}
function getFiltered(){const q=$('search').value.toLocaleLowerCase('fr'),y=$('year').value,w=$('wilaya').value,t=$('type').value;return allRecords().filter(r=>(active==='all'||r.dataset===active)&&(!q||[r.name,r.type,r.wilaya,r.moughataa,r.commune,r.village,...Object.values(r.fields||{})].join(' ').toLocaleLowerCase('fr').includes(q))&&(!y||yearFor(r)===y)&&(!w||r.wilaya===w)&&(!t||displayType(r)===t))}
function refreshOptions(){const records=allRecords().filter(r=>active==='all'||r.dataset===active);const keep={wilaya:$('wilaya').value,type:$('type').value};for(const [id,key] of [['wilaya','wilaya'],['type',null]]){const vals=[...new Set(records.map(r=>key?r[key]:displayType(r)).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'fr'));const sel=$(id),first=id==='wilaya'?'Toutes les wilayas':'Tous les types';sel.innerHTML='<option value="">'+first+'</option>'+vals.map(v=>'<option>'+esc(v)+'</option>').join('');if(vals.includes(keep[id]))sel.value=keep[id]}}
function renderStats(rs){const gps=rs.filter(validGPS).length,years=new Set(rs.map(yearFor).filter(y=>y!=='Non précisée'));const stats=[['Sous-projets',rs.length,'Dans la sélection actuelle'],['Avec coordonnées GPS',gps,rs.length?Math.round(gps/rs.length*100)+' % géolocalisés':'Aucune donnée'],['Années couvertes',years.size - 1,'Selon les dates disponibles'],['Formulaires',new Set(rs.map(r=>r.dataset)).size,'Types de formulaires présents']];$('stats').innerHTML=stats.map(x=>'<div class="stat"><div class="statlabel">'+x[0]+'</div><div class="num">'+x[1]+'</div><div class="hint">'+x[2]+'</div></div>').join('')}
function renderDetails(r){
 const status=$('detail-status'), title=$('detail-title');
 if(!r){$('details').innerHTML='<div class="empty">Cliquez sur un point de la carte pour afficher les informations disponibles.</div>';if(status)status.textContent='Cliquez sur un point de la carte';if(title)title.textContent='Nom / désignation du projet';return}
 if(title)title.textContent=r.name||'Nom / désignation du projet';
 if(status)status.textContent=validGPS(r)?'Point GPS affiché sur la carte':'Coordonnées GPS non disponibles';
 const values=[
  ['Date retenue',niceDate(dateFor(r))],
  ['Type / activité',displayType(r)],
  ['Wilaya',r.wilaya||'—'],
  ['Moughataa',r.moughataa||'—'],
  ['Commune',r.commune||'—'],
  ['Village/Localité',r.village||'—']
 ];
 let h='<div class="record-detail"><div class="fieldgrid">';
 h+=values.map(([k,v])=>'<div class="field"><b>'+esc(k)+'</b><span>'+esc(v)+'</span></div>').join('');
 h+='</div>';
 const photos=(r.photos||[]).filter(p=>p.url);
 if(photos.length){h+='<h3 class="photos-title">Photos</h3><div class="gallery">'+photos.map(p=>'<a href="'+esc(p.url)+'" target="_blank" rel="noopener" title="'+esc(p.name||'Photo')+'"><img loading="lazy" src="'+esc(p.url)+'" alt="'+esc(p.name||'Photo du projet')+'"></a>').join('')+'</div>'}
 else {h+='<div class="photos-empty">Aucune photo disponible pour cet élément.</div>'}
 const extraEntries=Object.entries(r.fields||{});
 if(extraEntries.length){
  h+='<button type="button" class="btn secondary see-more-btn" id="see-more-btn" aria-expanded="false">Voir plus de détails <span aria-hidden="true">＋</span></button>';
  h+='<div class="all-data hidden" id="all-data"><h3 class="photos-title">Toutes les données du sous-projet</h3><div class="fieldgrid">';
  h+=extraEntries.map(([k,v])=>'<div class="field"><b>'+esc(k)+'</b><span>'+esc(typeof v==='object'?JSON.stringify(v):v)+'</span></div>').join('');
  h+='</div></div>';
 }
 h+='</div>';$('details').innerHTML=h;
 const more=$('see-more-btn'),allData=$('all-data');
 if(more&&allData)more.addEventListener('click',()=>{const open=allData.classList.toggle('hidden')===false;more.setAttribute('aria-expanded',open?'true':'false');more.innerHTML=open?'Voir moins <span aria-hidden="true">−</span>':'Voir plus de détails <span aria-hidden="true">＋</span>';});
}
function selectRecord(key){const [ds,id]=key.split(':');const r=(data[ds]||[]).find(x=>String(x.id)===String(id));if(!r)return;selectedId=key;renderDetails({...r,dataset:ds});if(map&&validGPS(r))map.flyTo({center:[Number(r.lon),Number(r.lat)],zoom:12})}
let didInitialFit=false;function updateMap(rs){if(!map)return;const features=rs.filter(validGPS).map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[Number(r.lon),Number(r.lat)]},properties:{key:r.dataset+':'+r.id,name:r.name||displayType(r),type:displayType(r),dataset:r.dataset,year:yearFor(r),color:colors[displayType(r)]||colors[r.dataset]||'#309329'}}));const fc={type:'FeatureCollection',features};const src=map.getSource('records');if(src){src.setData(fc);if(features.length&&!didInitialFit){const bounds=new maplibregl.LngLatBounds();features.forEach(f=>bounds.extend(f.geometry.coordinates));map.fitBounds(bounds,{padding:55,maxZoom:8,duration:0});didInitialFit=true;}}$('map-count').textContent=features.length+' point(s) GPS';const status=$('load-status');if(status&&data.infrastructures.length+data.interconnexion.length+data.social.length>0&&features.length===0){status.className='load-status error';status.textContent='Les fichiers sont chargés, mais aucune coordonnée GPS valide n’a été reconnue. Vérifiez les colonnes de coordonnées dans les fichiers Excel.'}}
function updateYearButtons(){const current=$('year').value;document.querySelectorAll('#year-buttons [data-year]').forEach(b=>{const selected=current===b.dataset.year;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected?'true':'false')})}
function render(){updateYearButtons();refreshOptions();filtered=getFiltered();renderStats(filtered);updateMap(filtered);if(selectedId){const [ds,id]=selectedId.split(':');const r=(data[ds]||[]).find(x=>String(x.id)===String(id));if(r&&filtered.some(x=>x.dataset===ds&&String(x.id)===String(id)))renderDetails({...r,dataset:ds});else{selectedId=null;renderDetails(null)}}else renderDetails(null)}
function initMap(){
 if(!window.maplibregl){$('map').innerHTML='<div class="empty">La bibliothèque cartographique n’a pas pu être chargée. Vérifiez votre connexion.</div>';return}
 map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[-12.5,16],zoom:5.3});
 map.addControl(new maplibregl.NavigationControl(),'top-right');
 map.on('error',e=>{const status=$('load-status');if(status&&e?.error){status.className='load-status error';status.textContent='Erreur cartographique : '+(e.error.message||'impossible de charger le fond de carte. Vérifiez la connexion Internet.')}});
 map.on('load',()=>{
  map.addSource('records',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'records-points',type:'circle',source:'records',paint:{'circle-color':['get','color'],'circle-radius':8,'circle-stroke-color':'#fff','circle-stroke-width':2,'circle-opacity':0.95}});
  map.on('click','records-points',e=>{
   const f=e.features&&e.features[0];if(!f)return;const p=f.properties;
   new maplibregl.Popup({offset:12,maxWidth:'300px'}).setLngLat(f.geometry.coordinates).setHTML('<b>'+esc(p.name)+'</b><br><span>'+esc(labels[p.dataset]||p.dataset)+' · '+esc(p.year)+'</span><br><button class="open-popup-record" style="margin-top:7px;padding:5px 8px;cursor:pointer">Ouvrir la fiche</button>').addTo(map);
   selectRecord(p.key);
  });
  map.on('mouseenter','records-points',()=>map.getCanvas().style.cursor='pointer');
  map.on('mouseleave','records-points',()=>map.getCanvas().style.cursor='');
  map.resize();updateMap(getFiltered());
 });
}
function normalizeImported(row,ds,idx,photoMap){
 const fields={};for(const [k,v] of Object.entries(row))if(v!==undefined&&v!==null&&v!=='')fields[k]=v instanceof Date?v.toISOString().slice(0,10):v;
 const pick=(...keys)=>{for(const k of keys)if(fields[k]!==undefined&&fields[k]!==null&&String(fields[k]).trim()!=='')return fields[k];return null};
 let name,type,date,dateKeys;
 if(ds==='infrastructures'){
  name=pick("Nom / désignation de l'infrastructure","Nom de l'infrastructure","Nom de l’infrastructure","Nom / Désignation")||'Infrastructure importée';
  type=pick("Type d’infrastructure concernée","Type d’infrastructure");
  dateKeys=["3. Date d’achèvement des travaux","Date d’achèvement des travaux"];
  date=pick(...dateKeys);
 }else if(ds==='social'){
  name=pick("1. Type d’activité réalisée","1. Thème de la formation suivie","2. Activité de cohésion sociale concernée")||'Activité de cohésion sociale';
  type=name;
  dateKeys=["2. Date de réalisation de l’activité","2. Date de la formation"];
  date=pick(...dateKeys);
 }else{
  name=pick("1. Nom ou intitulé du plan","1. Type d’infrastructure","Dans le cadre de l’interconnexion transfrontalière, quels domaines d’impact souhaitez-vous documenter ?")||'Interconnexion transfrontalière';
  type=pick("1. Type d’infrastructure","Dans le cadre de l’interconnexion transfrontalière, quels domaines d’impact souhaitez-vous documenter ?")||name;
  dateKeys=["3. Date d’élaboration du plan","5. Date de début de mise en œuvre"];
  date=pick(...dateKeys);
 }
 const dateColumnExists=dateKeys.some(k=>Object.prototype.hasOwnProperty.call(row,k));
 const id=String(pick('_id','id')||('import-'+Date.now()+'-'+idx));const pid=String(pick('_id','id')||'');
 let lat=pick('_Coordonnée GPS_latitude','Coordonnée GPS_latitude','latitude','lat'),lon=pick('_Coordonnée GPS_longitude','Coordonnée GPS_longitude','longitude','lon');
 const gpsText=pick('Coordonnée GPS','GPS','coordonnees_gps');if((lat===null||lon===null)&&gpsText){const nums=String(gpsText).match(/-?\d+(?:[.,]\d+)?/g)||[];if(nums.length>=2){lat=lat===null?nums[0]:lat;lon=lon===null?nums[1]:lon}}
 const asCoordinate=v=>v===null||v===undefined||String(v).trim()===''?null:Number(String(v).replace(',','.'));
 return{id,index:idx,name:String(name),wilaya:String(pick('Wilaya')||'Non renseigné'),moughataa:pick('Moughataa'),commune:pick('Commune'),village:pick('Village/Localité :','Village','Localité'),type:String(type||'Non précisé'),date:date===null?'':String(date),dateColumnExists,lat:asCoordinate(lat),lon:asCoordinate(lon),photos:photoMap[pid]||[],fields,dataset:ds}
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.ds;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));selectedId=null;render()}));
['search','year','wilaya','type'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>render()));
document.querySelectorAll('#year-buttons [data-year]').forEach(b=>b.addEventListener('click',()=>{$('year').value=($('year').value===b.dataset.year?'':b.dataset.year);render()}));
async function loadFixedWorkbook(filename,ds){
 const response=await fetch(filename,{cache:'no-store'});
 if(!response.ok)throw new Error(filename+' introuvable (HTTP '+response.status+')');
 const wb=XLSX.read(await response.arrayBuffer(),{type:'array',cellDates:true});
 const mainName=wb.SheetNames.find(n=>!/^photo/i.test(n))||wb.SheetNames[0];
 const rows=XLSX.utils.sheet_to_json(wb.Sheets[mainName],{defval:null,raw:false});
 const photoMap={};
 for(const sn of wb.SheetNames.filter(n=>/^photo/i.test(n))){
  for(const pr of XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:null,raw:false})){
   const pid=String(pr._submission__id||'');
   if(pid){photoMap[pid]=photoMap[pid]||[];const photoUrl=pr.Photo_URL||pr.photo_URL;const photoName=pr.Photo||pr.photo||'Photo';if(photoUrl)photoMap[pid].push({name:photoName,url:photoUrl})}
  }
 }
 if(!rows.length)throw new Error(filename+' ne contient aucune ligne exploitable');
 data[ds]=rows.map((r,i)=>normalizeImported(r,ds,i+1,photoMap));
 return data[ds].length;
}
async function loadAllFixedFiles(){
 const status=$('load-status');
 if(!window.XLSX){status.className='load-status error';status.textContent='La bibliothèque Excel n’a pas pu être chargée. Vérifiez la connexion Internet.';return}
 if(location.protocol==='file:'){
  status.className='load-status error';
  status.textContent='Pour afficher les points GPS à partir des fichiers Excel actualisés, ouvrez le tableau de bord avec le lanceur Ouvrir_PRDC_VFS.bat. Le navigateur bloque la lecture automatique des fichiers Excel par double-clic sur le HTML.';
  render();return;
 }
 status.className='load-status';status.textContent='Chargement automatique des trois fichiers Excel…';
 const jobs=[
  ['Infrastructures.xlsx','infrastructures'],
  ['Interconnexion_transfrontalière.xlsx','interconnexion'],
  ['Activités_de_cohésion_sociale.xlsx','social']
 ];
 const results=await Promise.allSettled(jobs.map(([filename,ds])=>loadFixedWorkbook(filename,ds)));
 const errors=[];let total=0;
 results.forEach((result,i)=>{if(result.status==='fulfilled')total+=result.value;else errors.push(jobs[i][0]+': '+(result.reason?.message||'erreur de lecture'))});
 render();
 if(errors.length){status.className='load-status error';status.textContent='Chargement incomplet. '+errors.join(' · ');}
 else{status.className='load-status success';status.textContent='Données actualisées depuis les fichiers Excel : '+total+' enregistrement(s). Remplacez simplement les classeurs Excel pour mettre à jour les données.';}
}
render();
initMap();
loadAllFixedFiles();
