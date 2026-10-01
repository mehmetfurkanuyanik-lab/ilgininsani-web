import * as THREE from './three.module.js';
const host=document.querySelector('#city-canvas'),journey=document.querySelector('.journey');
if(host&&journey){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{document.documentElement.classList.add('no-webgl');}
 if(renderer){
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#e4f0ed',45,95);
 const camera=new THREE.PerspectiveCamera(34,1,.1,160);
 scene.add(new THREE.HemisphereLight('#e5f9ff','#7d8571',2.7));
 const sun=new THREE.DirectionalLight('#fff1d7',4.2);sun.position.set(-12,24,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.normalBias=.04;scene.add(sun);
 const fill=new THREE.DirectionalLight('#77bfff',1.2);fill.position.set(15,8,-9);scene.add(fill);
 const city=new THREE.Group();scene.add(city);
 const mat=(color,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const stone=mat('#eee3cb'),stoneDark=mat('#cebfa3'),roof=mat('#6c9397',.38,.28),terracotta=mat('#c98469'),white=mat('#f8efdd'),road=mat('#d4d7c8'),green=mat('#598c76'),trunk=mat('#8a7455'),glass=mat('#1d6178',.2,.2),blue=mat('#31a6bd',.2,.3),pink=mat('#d6a0b5');
 function mesh(geo,material,x,y,z,parent=city){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function box(w,h,d,m,x,y,z,parent=city){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);}
 function cyl(rt,rb,h,m,x,y,z,n=48,parent=city){return mesh(new THREE.CylinderGeometry(rt,rb,h,n),m,x,y,z,parent);}
 const base=cyl(14,13.4,1.25,stoneDark,0,-.75,0,96);cyl(14.04,14.04,.24,stone,0,-.06,0,96);cyl(13.96,14.04,.12,mat('#9bbbaf'),0,-.2,0,96);
 // An illustrated Ilgın-inspired square; no invented claim of a surveyed digital twin.
 box(4.2,.08,23,road,1,.1,0);box(22,.08,2.1,road,0,.11,2);
 const mosque=new THREE.Group();mosque.position.set(-3,0,-1);city.add(mosque);
 box(4.4,2.6,4.4,stone,0,1.4,0,mosque);box(4.7,.22,4.7,stoneDark,0,2.73,0,mosque);
 cyl(1.95,1.95,.6,stone,0,3,0,48,mosque);
 const dome=mesh(new THREE.SphereGeometry(2,48,24,0,Math.PI*2,0,Math.PI/2),roof,0,3.3,0,mosque);dome.scale.y=.75;
 cyl(.045,.065,.55,stoneDark,0,5,0,12,mosque);mesh(new THREE.SphereGeometry(.13,12,8),stoneDark,0,5.28,0,mosque);
 for(let i=-1;i<=1;i++){box(1.25,1.9,1.2,stone,i*1.43,.99,2.7,mosque);mesh(new THREE.SphereGeometry(.72,24,12,0,Math.PI*2,0,Math.PI/2),roof,i*1.43,2,2.7,mosque);box(.52,1.05,.025,glass,i*1.43,.87,3.32,mosque);}
 for(let side of [-1,1])for(let i=-1;i<=1;i++){box(.025,.7,.42,glass,side*2.215,1.65,i*1.05,mosque);box(.4,.65,.025,glass,i*1.1,1.65,-2.215,mosque);}
 cyl(.36,.49,5.9,stone,-2.8,3,-1.7,24,mosque);cyl(.6,.44,.21,stoneDark,-2.8,4.4,-1.7,24,mosque);cyl(.3,.36,1.4,stone,-2.8,6.5,-1.7,24,mosque);cyl(0,.4,1.3,roof,-2.8,7.82,-1.7,24,mosque);
 box(6.6,1.45,2.1,stone,-2.7,.8,-6);for(let i=0;i<7;i++){mesh(new THREE.SphereGeometry(.48,20,10,0,Math.PI*2,0,Math.PI/2),roof,-5.4+i*.9,1.55,-6);box(.45,.85,.04,glass,-5.4+i*.9,.7,-4.93);}
 function building(x,z,w,h,d,color){const g=new THREE.Group();g.position.set(x,0,z);city.add(g);box(w,h,d,color,0,h/2+.16,0,g);const r=mesh(new THREE.ConeGeometry(w*.8,.75,4),terracotta,0,h+.48,0,g);r.rotation.y=Math.PI/4;r.scale.z=d/w;for(let floor=.8;floor<h-.15;floor+=.8)for(let col=-w*.28;col<=w*.3;col+=.7){box(.25,.38,.035,glass,col,floor,d/2+.02,g);}box(.5,.8,.045,stoneDark,0,.48,d/2+.03,g);return g;}
 const positions=[[-9,-5,2.1,3.2,2],[-9,-1,2.2,2.6,2.4],[-9,4,2.4,2,2.1],[-6,6,2,2.8,2.2],[-2,7,2,2,2],[-5,10,1.8,1.7,1.9],[3,-8,2.3,2.8,2.2],[6,-7,2,3.3,2],[9,-5,2.1,2,2],[6,-3,2,2.5,1.8],[4,0,1.8,1.8,1.7],[7,1,1.8,2.5,2],[1,10,1.8,1.9,1.8]];
 positions.forEach((a,i)=>building(...a,[white,stone,pink,mat('#abd0cc')][i%4]));
 function tree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,.2,z);g.scale.setScalar(scale);city.add(g);cyl(.09,.14,1.3,trunk,0,.65,0,8,g);const top=mesh(new THREE.IcosahedronGeometry(.7,2),green,0,1.65,0,g);top.scale.set(.85,1.2,.85);}
 [[-11,0],[-11,2],[-7,3],[-4,4],[-2,4],[0,5],[2,5],[4,5],[5,6],[9,0],[10,-2],[-1,-9],[-4,-9],[-7,-8],[3,9],[7,9],[10,6]].forEach((p,i)=>tree(...p,.75+(i%3)*.16));
 const lake=mesh(new THREE.CircleGeometry(3.6,64),blue,8,.2,6);lake.rotation.x=-Math.PI/2;lake.scale.set(1,1.35,1);
 for(let i=0;i<5;i++){const ripple=mesh(new THREE.TorusGeometry(.9+i*.38,.014,5,64),mat('#aadfd9',.35),8,.22,6);ripple.rotation.x=Math.PI/2;ripple.scale.y=1.35;}
 for(let i=0;i<7;i++){const angle=i*.6;tree(8+Math.cos(angle)*4.1,6+Math.sin(angle)*4.1,1);}
 const fountain=cyl(.8,.8,.24,stoneDark,0,.26,1,32);cyl(.68,.68,.06,blue,0,.42,1,32);cyl(.12,.22,.65,stone,0,.75,1,20);
 for(let i=0;i<4;i++){const bench=box(1.1,.12,.34,terracotta,-1+i*1.4,.5,3.8);box(.1,.4,.3,stoneDark,-1.4+i*1.4,.26,3.8);box(.1,.4,.3,stoneDark,-.6+i*1.4,.26,3.8);}
 const ground=mesh(new THREE.PlaneGeometry(200,200),mat('#dcebe6'),0,-1.42,0,scene);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 // Camera travels from an aerial view through the square toward the lake.
 const cameras=[[25,22,31],[14,13,20],[-1,9,17],[19,12,20]];
 const targets=[[0,1,0],[-3,2,0],[-2,1,2],[6,1,5]];
 const copy=[...document.querySelectorAll('.journey-copy')];const photos=[...document.querySelectorAll('.journey-photo')];
 let progress=0,current=0,frame=0,visible=true,pointerX=0,pointerY=0;
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();requestPaint();}
 function read(){const r=journey.getBoundingClientRect();progress=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-innerHeight)));requestPaint();}
 function requestPaint(){if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(draw);}
 function draw(){frame=0;const delta=progress-current;current=reduced.matches?0:Math.abs(delta)<.0005?progress:current+delta*.09;const span=current*3,index=Math.min(2,Math.floor(span)),t=span-index,smooth=t*t*(3-2*t);const mobile=innerWidth<760;
  const p=new THREE.Vector3(...cameras[index]).lerp(new THREE.Vector3(...cameras[index+1]),smooth);if(mobile)p.multiplyScalar(1.25);p.x+=pointerX*.7;p.y+=pointerY*.4;camera.position.copy(p);const aim=new THREE.Vector3(...targets[index]).lerp(new THREE.Vector3(...targets[index+1]),smooth);if(!mobile)aim.x-=5.5*(1-current*.4);else aim.y+=3.2;camera.lookAt(aim);
  city.rotation.y=-.15+current*.35;renderer.render(scene,camera);
  const active=reduced.matches?0:Math.min(3,Math.floor(current*3.99));copy.forEach((el,i)=>{el.classList.toggle('active',i===active);el.inert=i!==active;el.setAttribute('aria-hidden',String(i!==active));});photos.forEach((el,i)=>el.classList.toggle('active',i+1===active));journey.style.setProperty('--journey-progress',current);
  if(Math.abs(progress-current)>.0005&&!reduced.matches)requestPaint();
 }
 window.addEventListener('scroll',read,{passive:true});window.addEventListener('resize',resize,{passive:true});
 host.addEventListener('pointermove',e=>{if(reduced.matches||innerWidth<760)return;pointerX=e.clientX/innerWidth-.5;pointerY=e.clientY/innerHeight-.5;requestPaint();});host.addEventListener('pointerleave',()=>{pointerX=pointerY=0;requestPaint();});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)read();},{rootMargin:'100px'}).observe(journey);
 document.addEventListener('visibilitychange',requestPaint);reduced.addEventListener('change',()=>{document.documentElement.classList.toggle('journey-reduced',reduced.matches);read();});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.documentElement.classList.add('no-webgl');});
 document.documentElement.classList.add('webgl-ready');document.documentElement.classList.toggle('journey-reduced',reduced.matches);resize();read();
 }
}
