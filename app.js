const $ = id => document.getElementById(id);
const labels={all:'Vue d’ensemble',infrastructures:'Infrastructures',interconnexion:'Interconnexion transfrontalière',social:'Cohésion sociale'};
const colors={'École':'#309329','Poste de santé':'#c83d42','Marché':'#e2b52c','Piste rurale':'#277da1','Autre':'#7b61a8','Non renseigné':'#6b7280','Interconnexion transfrontalière':'#2477a8','Cohésion sociale':'#8b5cf6'};
let data={infrastructures:[],interconnexion:[],social:[]},active='all',filtered=[],map=null,markerRefs=[],selectedId=null;
function allRecords(){return Object.entries(data).flatMap(([ds,items])=>items.map(r=>({...r,dataset:ds})))}
function dateFor(r){if(r.dataset==='infrastructures')return r.fields?.['3. Date d’achèvement des travaux']||r.date||'';if(r.dataset==='social')return r.fields?.['2. Date de réalisation de l’activité']||r.date||r.fields?._submission_time||r.fields?.start||'';return r.fields?.['3. Date d’élaboration du plan']||r.fields?.['5. Date de début de mise en œuvre']||r.date||r.fields?._submission_time||r.fields?.start||''}
function yearFor(r){const value=dateFor(r);if(value===null||value===undefined||String(value).trim()==='')return 'Non précisée';const d=String(value).trim();const iso=d.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);if(iso)return iso[1];const parsed=new Date(d);return Number.isNaN(parsed.getTime())?'Non précisée':String(parsed.getFullYear())}
function validGPS(r){return Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lon))&&Math.abs(Number(r.lat))<=90&&Math.abs(Number(r.lon))<=180&&!(Number(r.lat)===0&&Number(r.lon)===0)}
function niceDate(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}
function esc(v){return String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function displayType(r){return r.type||r.name||labels[r.dataset]}
function getFiltered(){const q=$('search').value.toLocaleLowerCase('fr'),y=$('year').value,w=$('wilaya').value,t=$('type').value;return allRecords().filter(r=>(active==='all'||r.dataset===active)&&(!q||[r.name,r.type,r.wilaya,r.moughataa,r.commune,r.village,...Object.values(r.fields||{})].join(' ').toLocaleLowerCase('fr').includes(q))&&(!y||yearFor(r)===y)&&(!w||r.wilaya===w)&&(!t||displayType(r)===t))}
function refreshOptions(){const records=allRecords().filter(r=>active==='all'||r.dataset===active);const keep={wilaya:$('wilaya').value,type:$('type').value};for(const [id,key] of [['wilaya','wilaya'],['type',null]]){const vals=[...new Set(records.map(r=>key?r[key]:displayType(r)).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'fr'));const sel=$(id),first=id==='wilaya'?'Toutes les wilayas':'Tous les types';sel.innerHTML='<option value="">'+first+'</option>'+vals.map(v=>'<option>'+esc(v)+'</option>').join('');if(vals.includes(keep[id]))sel.value=keep[id]}}
function renderStats(rs){const gps=rs.filter(validGPS).length,years=new Set(rs.map(yearFor).filter(y=>y!=='Non précisée'));const stats=[['Enregistrements',rs.length,'Dans la sélection actuelle'],['Avec coordonnées GPS',gps,rs.length?Math.round(gps/rs.length*100)+' % géolocalisés':'Aucune donnée'],['Années couvertes',years.size,'Selon les dates disponibles'],['Formulaires',new Set(rs.map(r=>r.dataset)).size,'Types de formulaires présents']];$('stats').innerHTML=stats.map(x=>'<div class="stat"><div class="statlabel">'+x[0]+'</div><div class="num">'+x[1]+'</div><div class="hint">'+x[2]+'</div></div>').join('')}
function renderDetails(r){
 const status=$('detail-status');
 if(!r){$('details').innerHTML='<div class="empty">Cliquez sur un point de la carte pour afficher les informations disponibles.</div>';if(status)status.textContent='Cliquez sur un point de la carte';return}
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
 h+='</div>';$('details').innerHTML=h;
}
function selectRecord(key){const [ds,id]=key.split(':');const r=(data[ds]||[]).find(x=>String(x.id)===String(id));if(!r)return;selectedId=key;renderDetails({...r,dataset:ds});if(map&&validGPS(r))map.flyTo({center:[Number(r.lon),Number(r.lat)],zoom:12})}
function updateMap(rs){if(!map)return;const features=rs.filter(validGPS).map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[Number(r.lon),Number(r.lat)]},properties:{key:r.dataset+':'+r.id,name:r.name||displayType(r),type:displayType(r),dataset:r.dataset,year:yearFor(r),color:colors[displayType(r)]||colors[r.dataset]||'#309329'}}));const src=map.getSource('records');if(src)src.setData({type:'FeatureCollection',features});$('map-count').textContent=features.length+' point(s) GPS';}
function updateYearButtons(){const current=$('year').value;document.querySelectorAll('#year-buttons [data-year]').forEach(b=>{const selected=current===b.dataset.year;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected?'true':'false')})}
function render(){updateYearButtons();refreshOptions();filtered=getFiltered();renderStats(filtered);updateMap(filtered);if(selectedId){const [ds,id]=selectedId.split(':');const r=(data[ds]||[]).find(x=>String(x.id)===String(id));if(r&&filtered.some(x=>x.dataset===ds&&String(x.id)===String(id)))renderDetails({...r,dataset:ds});else{selectedId=null;renderDetails(null)}}else renderDetails(null)}
function initMap(){if(!window.maplibregl){$('map').innerHTML='<div class="empty">La bibliothèque cartographique n’a pas pu être chargée. Vérifiez votre connexion.</div>';return}map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[-12.5,16],zoom:5.3});map.addControl(new maplibregl.NavigationControl(),'top-right');map.on('load',()=>{map.addSource('records',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterRadius:45,clusterMaxZoom:13});map.addLayer({id:'clusters',type:'circle',source:'records',filter:['has','point_count'],paint:{'circle-color':'#309329','circle-radius':['step',['get','point_count'],17,10,22,30,28],'circle-stroke-width':2,'circle-stroke-color':'#fff'}});map.addLayer({id:'cluster-count',type:'symbol',source:'records',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Open Sans Semibold','Arial Unicode MS Bold'],'text-size':12},paint:{'text-color':'#fff'}});map.addLayer({id:'unclustered',type:'circle',source:'records',filter:['!',['has','point_count']],paint:{'circle-color':['get','color'],'circle-radius':7,'circle-stroke-color':'#fff','circle-stroke-width':2}});map.on('click','clusters',e=>{const f=map.queryRenderedFeatures(e.point,{layers:['clusters']})[0],cid=f.properties.cluster_id;map.getSource('records').getClusterExpansionZoom(cid,(err,z)=>{if(!err)map.easeTo({center:f.geometry.coordinates,zoom:z})})});map.on('click','unclustered',e=>{const p=e.features[0].properties;const popup=new maplibregl.Popup().setLngLat(e.lngLat).setHTML('<b>'+esc(p.name)+'</b><br><span>'+esc(labels[p.dataset]||p.dataset)+' · '+esc(p.year)+'</span><br><button class="open-popup-record" style="margin-top:7px;padding:5px 8px;cursor:pointer">Ouvrir la fiche</button>').addTo(map);popup.on('open',()=>{const btn=popup.getElement().querySelector('.open-popup-record');if(btn)btn.addEventListener('click',()=>selectRecord(p.key))});selectRecord(p.key)});map.on('mouseenter','unclustered',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','unclustered',()=>map.getCanvas().style.cursor='');updateMap(getFiltered())})}
function normalizeImported(row,ds,idx,photoMap){const fields={};for(const [k,v] of Object.entries(row))if(v!==undefined&&v!==null&&v!=='')fields[k]=v instanceof Date?v.toISOString().slice(0,10):v;const pick=(...keys)=>{for(const k of keys)if(fields[k]!==undefined&&fields[k]!==null&&String(fields[k]).trim()!=='')return fields[k];return null};let name,type,date;if(ds==='infrastructures'){name=pick("Nom / désignation de l'infrastructure","Nom de l'infrastructure","Nom de l’infrastructure")||'Infrastructure importée';type=pick("Type d’infrastructure concernée","Type d’infrastructure");date=pick("3. Date d’achèvement des travaux","Date d’achèvement des travaux")}else if(ds==='social'){name=pick("1. Type d’activité réalisée","1. Thème de la formation suivie","2. Activité de cohésion sociale concernée")||'Activité de cohésion sociale';type=name;date=pick("2. Date de réalisation de l’activité","2. Date de la formation","_submission_time","start")}else{name=pick("1. Nom ou intitulé du plan","1. Type d’infrastructure","Dans le cadre de l’interconnexion transfrontalière, quels domaines d’impact souhaitez-vous documenter ?")||'Interconnexion transfrontalière';type=pick("1. Type d’infrastructure","Dans le cadre de l’interconnexion transfrontalière, quels domaines d’impact souhaitez-vous documenter ?")||name;date=pick("3. Date d’élaboration du plan","5. Date de début de mise en œuvre","_submission_time","start")}const id=String(pick('_id','id')||('import-'+Date.now()+'-'+idx));const pid=String(pick('_id','id')||'');const lat=pick('_Coordonnée GPS_latitude','latitude','lat'),lon=pick('_Coordonnée GPS_longitude','longitude','lon');return{id,index:idx,name:String(name),wilaya:String(pick('Wilaya')||'Non renseigné'),moughataa:pick('Moughataa'),commune:pick('Commune'),village:pick('Village/Localité :','Village','Localité'),type:String(type||'Non précisé'),date:String(date||''),lat:lat===null?null:Number(lat),lon:lon===null?null:Number(lon),photos:photoMap[pid]||[],fields,dataset:ds}}
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
  status.textContent='Le navigateur bloque la lecture automatique des fichiers Excel lorsque le HTML est ouvert par double-clic. Ouvrez ce dossier via une adresse HTTP/HTTPS pour actualiser les données automatiquement.';
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
