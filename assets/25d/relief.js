import * as THREE from 'three';
// Coordinates are normalized image coordinates (origin top left).
export const profiles={
 Block:{id:0,color:'#79dce7',cores:[[.393,.247,.075,.08]],warm:0,zones:[[.37,.26,.22,.27,.62],[.62,.27,.17,.25,.23],[.86,.61,.16,.23,.53],[.15,.63,.16,.23,.42],[.35,.83,.15,.19,.38],[.68,.83,.17,.19,.49]],description:'Masse stable, cœur cyan pulsé et respiration mécanique très lente.'},
 HashByte:{id:1,color:'#61c9ff',cores:[[.8,.27,.22,.2]],warm:0,zones:[[.79,.27,.19,.26,.65],[.64,.53,.22,.22,.55],[.85,.55,.17,.22,.7],[.32,.67,.3,.3,.23]],description:'Traînée ondulante et balayage lumineux dans les fragments de code.'},
 Miner:{id:2,color:'#ffb151',cores:[[.348,.37,.09,.09],[.51,.282,.06,.06],[.536,.357,.06,.06]],warm:1,zones:[[.36,.31,.3,.24,.5],[.76,.59,.17,.24,.85],[.22,.65,.17,.23,.4],[.65,.87,.22,.17,.4]],description:'Vibration contenue du châssis et chaleur variable des processeurs.'},
 LEDGER:{id:3,color:'#bd8bff',cores:[[.44,.25,.055,.045],[.526,.248,.055,.045]],warm:0,zones:[[.48,.32,.2,.3,.7],[.14,.4,.15,.24,.43],[.85,.43,.15,.28,.48],[.52,.76,.3,.3,.22]],description:'Légère suspension du registre et ondulation de ses filaments violets.'},
 Network:{id:4,color:'#8de7ff',cores:[[.58,.37,.07,.085],[.52,.109,.06,.05],[.594,.121,.05,.05]],warm:0,zones:[[.53,.2,.17,.23,.6],[.56,.44,.24,.28,.53],[.14,.32,.18,.22,.77],[.88,.48,.18,.22,.72],[.49,.8,.3,.3,.22]],description:'Impulsions qui parcourent les nœuds lumineux et souplesse des câbles.'},
 Genesis:{id:5,color:'#ffd08a',cores:[[.686,.444,.083,.085],[.19,.17,.2,.2]],warm:1,zones:[[.59,.19,.16,.22,.48],[.64,.49,.29,.3,.55],[.19,.38,.22,.27,.87],[.38,.87,.23,.22,.77]],description:'Cœur ambre lent et halo cyan autonome autour des cubes de la main.'}
};
const textures=new Map();
function texture(src){if(!textures.has(src))textures.set(src,new Promise((resolve,reject)=>new THREE.TextureLoader().load(src,t=>{t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;resolve(t)},undefined,reject)));return textures.get(src)}
const vertex=`varying vec2 vUv;uniform float time,strength,kind;uniform vec2 view;
void main(){vUv=uv;vec3 p=position;float anchor=smoothstep(.02,.35,uv.y);float t=time;float wave=sin(t*1.4);p.x+=view.x*p.z*.25*anchor*strength;p.y+=view.y*p.z*.11*anchor*strength;
float dx=0.;float dy=wave*.017*anchor;
if(kind>.5&&kind<1.5){float trail=pow(1.-uv.x,1.6);dx=sin(t*2.1+uv.y*9.)*.05*trail;dy=sin(t*1.5+uv.x*6.)*.035*trail+wave*.018;}
if(kind>1.5&&kind<2.5){dx=sin(t*10.)*.003*anchor;dy=sin(t*2.1)*.012*anchor;}
if(kind>2.5&&kind<3.5){float tails=1.-smoothstep(.1,.7,uv.y);dx=sin(t*1.8+uv.y*8.)*.045*tails;dy=sin(t*1.2)*.028*anchor;}
if(kind>3.5&&kind<4.5){dx=sin(t*1.2+uv.y*6.)*.018*(1.-uv.y);dy=sin(t*1.3)*.013*anchor;}
if(kind>4.5){dx=sin(t*1.1)*.012*anchor;dy=sin(t*1.1)*.017*anchor;}
p.x+=dx*strength*anchor;p.y+=dy*strength*anchor;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fragment=`precision highp float;varying vec2 vUv;uniform sampler2D art;uniform float time,strength,kind,warm;uniform vec4 cores[3];
void main(){vec4 c=texture2D(art,vUv);if(c.a<.01)discard;vec2 uv=vec2(vUv.x,1.-vUv.y);vec3 light=vec3(0.);for(int i=0;i<3;i++){vec4 core=cores[i];vec2 d=(uv-core.xy)/max(core.zw,vec2(.001));float f=exp(-dot(d,d)*1.9);float p=.45+.55*sin(time*(1.3+float(i)*.3)+float(i)*1.8);vec3 col=mix(vec3(.015,.15,.20),vec3(.19,.07,.005),warm);if(kind>4.5&&i==1)col=vec3(.01,.15,.2);light+=col*f*p;}
if((kind>.5&&kind<1.5)||(kind>3.5&&kind<4.5)){float band=pow(.5+.5*sin(vUv.y*16.-time*2.5+vUv.x*4.),12.);float cyan=smoothstep(.12,.5,c.b-c.r);light+=vec3(.01,.10,.15)*band*cyan;}
if(kind>2.5&&kind<3.5){float violet=smoothstep(.08,.4,c.b-c.g);light+=vec3(.08,.015,.14)*violet*(.5+.5*sin(time*1.6+vUv.y*7.));}
c.rgb+=light*strength;gl_FragColor=c;}`;
export class EntityRelief{
 constructor(host,resolveAsset){this.host=host;this.resolveAsset=resolveAsset;this.active=true;this.amount=.72;this.time=0;this.flat=false;this.pointer=new THREE.Vector2();this.smooth=new THREE.Vector2();this.serial=0;this.failed=false;this.img=host.querySelector('img');
 this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-3.5,3.5,3.5,-3.5,.1,30);this.camera.position.z=12;
 try{this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0,0);host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-hidden','true');this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.failed=true;this.img.style.opacity='1';host.dataset.render='fallback'});this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.failed=false;this.setEntity(this.name)});this.resize=new ResizeObserver(()=>{this.renderer.setSize(host.clientWidth,host.clientHeight,false);this.draw(0)});this.resize.observe(host)}catch{this.failed=true;host.dataset.render='fallback'}
 }
 async setEntity(name){const token=++this.serial;this.name=name;this.profile=profiles[name];this.img.src=this.resolveAsset(name);this.img.alt=name;this.img.style.opacity='1';this.host.dataset.entity=name;if(this.failed)return;
 try{const tex=await texture(this.resolveAsset(name));if(token!==this.serial)return;
 if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose()}
 const g=new THREE.PlaneGeometry(6.5,6.5,64,64),pos=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<pos.count;i++){let z=.12,x=uv.getX(i),y=1-uv.getY(i);for(const [cx,cy,sx,sy,h] of this.profile.zones)z+=h*Math.exp(-(((x-cx)/sx)**2)-(((y-cy)/sy)**2));pos.setZ(i,z)}
 const cores=this.profile.cores.map(c=>new THREE.Vector4(...c));while(cores.length<3)cores.push(new THREE.Vector4(-10,-10,.001,.001));
 this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{art:{value:tex},time:{value:this.time},strength:{value:this.amount},kind:{value:this.profile.id},warm:{value:this.profile.warm},view:{value:this.smooth},cores:{value:cores}},vertexShader:vertex,fragmentShader:fragment});this.mesh=new THREE.Mesh(g,this.material);this.scene.add(this.mesh);this.img.style.opacity='0';this.host.dataset.render='webgl';this.draw(0)
 }catch{this.host.dataset.render='fallback';this.img.style.opacity='1'}
 }
 draw(dt){if(!this.mesh||this.failed)return;if(this.active&&!this.flat)this.time+=dt;
 this.smooth.lerp(this.active&&!this.flat?this.pointer:new THREE.Vector2(),1-Math.exp(-Math.max(dt,.016)*8));this.material.uniforms.time.value=this.time;this.material.uniforms.strength.value=this.flat?0:this.amount;this.mesh.rotation.y=this.flat?0:this.smooth.x*.028*this.amount;this.mesh.rotation.x=this.flat?0:this.smooth.y*.012*this.amount;this.renderer.render(this.scene,this.camera)
 }
 dispose(){this.serial++;this.resize?.disconnect();if(this.mesh){this.mesh.geometry.dispose();this.material.dispose()}this.renderer?.dispose();this.renderer?.domElement.remove()}
}
