// @ts-nocheck -- untyped prototype code, kept verbatim; the typed surface is in ../timeline.ts and ../index.ts
/* eslint-disable */
// Moved unchanged from the handAnimation prototype (index.html). Hand-tuned: change with care and check
// poses visually. See packages/player/README.md.
// ---------------------------------------------------------------- tiny vec math
const D = Math.PI/180;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]), norm=a=>mul(a,1/(len(a)||1));
const rot=(v,k,ang)=>{const c=Math.cos(ang),s=Math.sin(ang);return add(add(mul(v,c),mul(cross(k,v),s)),mul(k,dot(k,v)*(1-c)));};

// ---------------------------------------------------------------- hand rig (right-hand local: thumb -x, fingers +y, dorsal +z)
const FING=[ // index, middle, ring, pinky: knuckle, phalanx lengths, radii, natural splay
  {k:[-2.2,8.4,.1],  l:[4.1,2.5,2.0], r:[.92,.83,.75,.66], s:7},
  {k:[-.68,8.85,.12],l:[4.6,2.9,2.1], r:[.94,.85,.77,.68], s:0},
  {k:[.86,8.5,.1],   l:[4.3,2.7,2.0], r:[.9,.81,.73,.64], s:-6},
  {k:[2.3,7.7,0],    l:[3.4,2.1,1.8], r:[.8,.72,.65,.58], s:-13},
];
const THUMB={b:[-1.85,1.5,-.7], l:[4.0,3.0,2.4], r:[1.3,1.03,.93,.8], twist:-55};
const HN=33; // params per hand: pos3 dir3 palmNormal3 | 4 fingers x [spread,mcp,pip,dip] | thumb [spread,abd,cmc,mcp,ip] | forearm dir3

function chain(base,ax,lens,rads,curls,out){
  let [x,y,z]=ax, p=base;
  for(let j=0;j<3;j++){
    const a=-curls[j]*D, c=Math.cos(a), s=Math.sin(a);
    [y,z]=[add(mul(y,c),mul(z,s)),sub(mul(z,c),mul(y,s))];
    const q=add(p,mul(y,lens[j])); out.push([p,q,rads[j],rads[j+1]]); p=q;
  }
}
function buildHand(P,mirror){
  const pos=P.slice(0,3), Y=norm(P.slice(3,6)), n=P.slice(6,9);
  let Z=mul(sub(n,mul(Y,dot(n,Y))),-1); if(len(Z)<1e-4) Z=[0,0,1]; Z=norm(Z);
  const X=cross(Y,Z);
  const W=v=>add(pos,add(add(mul(X,v[0]*mirror),mul(Y,v[1])),mul(Z,v[2])));
  const segs=[];
  // thumb
  const t=P.slice(25,30);
  let ax=[[1,0,0],[0,1,0],[0,0,1]].map(v=>rot(v,[0,1,0],THUMB.twist*D)).map(v=>rot(v,[1,0,0],-t[1]*D)).map(v=>rot(v,[0,0,1],t[0]*D));
  chain(THUMB.b,ax,THUMB.l,THUMB.r,t.slice(2),segs);
  FING.forEach((F,i)=>{
    const g=P.slice(9+i*4,13+i*4), s=(F.s+g[0])*D;
    chain(F.k,[[Math.cos(s),Math.sin(s),0],[-Math.sin(s),Math.cos(s),0],[0,0,1]],F.l,F.r,g.slice(1),segs);
  });
  const wr=W([0,-.6,0]), el=add(wr,mul(norm(P.slice(30,33)),60));   // long enough that its end never shows when orbiting
  const TL=add(mul(X,ax[0][0]),mul(add(mul(Y,ax[0][1]),mul(Z,ax[0][2])),mirror));   // thumb bend axis for the shader
  return {X,Y,Z,TL,pos,segs:segs.map(([a,b,ra,rb])=>[W(a),W(b),ra,rb]),arm:[wr,1.85,el,3.2],hc:W([0,-2,0]),palm:W([0,4.6,0])};
}
function bound(h){ // bounding spheres for the shader's culling, taken after contacts have moved the fingers
  const fb=[];
  for(let f=0;f<5;f++){
    const pts=h.segs.slice(f*3,f*3+3).flatMap(s=>[[s[0],s[2]],[s[1],s[3]]]);
    const c=mul(pts.reduce((a,[p])=>add(a,p),[0,0,0]),1/pts.length);
    fb.push([c,Math.max(...pts.map(([p,r])=>len(sub(p,c))+r))]);
  }
  const hr=Math.max(len(sub(h.arm[0],h.hc))+4,...fb.map(([c,r])=>len(sub(c,h.hc))+r+1.2));
  h.bounds=[[h.hc,hr],...fb]; h.tip=h.segs[5][1]; /* middle fingertip */ return h;
}

// ---------------------------------------------------------------- poses (first-person: x right, y up, z toward viewer)
const RELAX={i:[0,12,16,8],m:[0,14,18,10],r:[0,16,22,12],k:[0,18,26,14],t:[38,30,5,10,10]};
function hand(c,f,n,o={}){ // c = palm centre; wrist placed 4.6 behind it along f; o.e = forearm direction (wrist->elbow)
  const g={...RELAX,...o}, fn=norm(f);
  return [...sub(c,mul(fn,4.6)),...fn,...n,...g.i,...g.m,...g.r,...g.k,...g.t,...norm(o.e||mul(fn,-1))];
}
const both=(R,L)=>[...R,...L];

// ASL fingerspelling, right hand. Palm is turned to the camera so letters read the way an audience facing the
// signer sees them; the left hand rests low. Letter keys double as ?seal= names (a..z, j2, z1..z4).
// Camera = an audience facing the signer, whose face (outline) is behind the hands. The signer's right hand works
// in front of their right shoulder (screen-left of the face); forearms run back/down toward the body.
const CAM={tgt:[13,12,-14],yaw:.2,pitch:.12,dist:85}, FACE=[13,21,-14];   // aimed at the figure: it sits centre-frame
const TOCAM=[Math.sin(CAM.yaw)*Math.cos(CAM.pitch),Math.sin(CAM.pitch),Math.cos(CAM.yaw)*Math.cos(CAM.pitch)], SR=[Math.cos(CAM.yaw),0,-Math.sin(CAM.yaw)];
const TIGHT=[0,88,100,55], ACROSS=[25,40,30,25,15], RE=[-.25,-.85,-.45];
// signer space (see ASL word signs below): x = signer's left (screen right), y up, z toward the viewer, cm from the face centre
const TH=[Math.sin(CAM.yaw),0,Math.cos(CAM.yaw)], SV=v=>add(add(mul(SR,v[0]),[0,v[1],0]),mul(TH,v[2]));
const ELB=[[-15,-34,0],[15,-34,0]];
function sp(h,c,f,n,s,e){ const C=add(FACE,SV(c)), F=norm(SV(f));
  return hand(C,F,norm(SV(n)),{...s,e:e?SV(e):sub(add(FACE,SV(ELB[h])),sub(C,mul(F,4.6)))}); }
const L_LOW=sp(1,[10,-31,12],[-.25,.35,.9],[-.6,.75,-.2],{});   // left hand at rest: low, out of the signing space
const letter=(o,n=TOCAM,c=[3,9,2],f=[0,.98,-.12],e=RE)=>both(hand(c,f,n,{e,...o}),L_LOW);
// G H: pointing across, palm down. (Palm facing away is ~160deg from the other letters' palm-to-camera: blending
// through it collapses the palm normal and the hand flips in one frame.)
const side=o=>letter(o,[0,-1,0],[0,9,2],SR,[-.5,-.6,-.6]);
const down=o=>letter(o,[0,-.45,-.9],[2.5,8,2],[.15,-.85,.5],[-.6,-.3,-.75]);   // P Q: hand hangs down off the forearm
// handshapes, right-hand local (the left hand mirrors them): the alphabet plus shapes the word signs use
const HS={
  A:{i:TIGHT,m:TIGHT,r:TIGHT,k:TIGHT,t:[5,-5,0,0,0]},
  B:{i:[-3,2,2,0],m:[0,2,2,0],r:[2,2,2,0],k:[4,2,2,0],t:[10,40,45,30,20]},
  C:{i:[-4,35,55,35],m:[0,35,55,35],r:[3,35,55,35],k:[6,35,55,35],t:[40,50,10,15,15]},
  D:{i:[0,0,0,0],m:[0,55,70,25],r:[0,55,70,25],k:[0,55,70,25],t:[30,50,30,25,20]},
  E:{i:[0,15,95,75],m:[0,15,95,75],r:[0,15,95,75],k:[0,15,95,75],t:[25,45,55,35,25]},
  F:{i:[0,50,70,40],m:[-4,2,2,0],r:[2,2,2,0],k:[8,2,2,0],t:[30,45,20,20,25]},
  G:{i:[0,0,0,0],m:TIGHT,r:TIGHT,k:TIGHT,t:[20,0,0,0,0]},
  H:{i:[-2,0,0,0],m:[2,0,0,0],r:TIGHT,k:TIGHT,t:[10,20,55,40,30]},
  I:{i:TIGHT,m:TIGHT,r:TIGHT,k:[-5,0,0,0],t:ACROSS},
  K:{i:[0,0,0,0],m:[0,40,0,0],r:TIGHT,k:TIGHT,t:[15,30,10,5,0]},
  L:{i:[0,0,0,0],m:TIGHT,r:TIGHT,k:TIGHT,t:[85,0,0,0,0]},
  M:{i:[0,75,80,30],m:[0,75,80,30],r:[0,75,80,30],k:TIGHT,t:[30,50,60,20,10]},
  N:{i:[0,75,80,30],m:[0,75,80,30],r:TIGHT,k:TIGHT,t:[30,50,50,20,10]},
  O:{i:[-4,55,75,50],m:[0,55,75,50],r:[3,55,75,50],k:[6,55,75,50],t:[45,60,25,30,30]},   // tips close onto the thumb
  R:{i:[-8,0,0,0],m:[10,0,0,0],r:TIGHT,k:TIGHT,t:ACROSS},
  S:{i:TIGHT,m:TIGHT,r:TIGHT,k:TIGHT,t:[30,50,30,20,10]},
  T:{i:[0,70,90,40],m:TIGHT,r:TIGHT,k:TIGHT,t:[25,40,20,10,10]},
  U:{i:[-3,0,0,0],m:[3,0,0,0],r:TIGHT,k:TIGHT,t:ACROSS},
  V:{i:[8,0,0,0],m:[-8,0,0,0],r:TIGHT,k:TIGHT,t:ACROSS},
  W:{i:[10,0,0,0],m:[0,0,0,0],r:[-10,0,0,0],k:TIGHT,t:[30,45,30,30,20]},
  X:{i:[0,10,90,60],m:TIGHT,r:TIGHT,k:TIGHT,t:ACROSS},
  Y:{i:TIGHT,m:TIGHT,r:TIGHT,k:[-15,0,0,0],t:[70,0,0,0,0]},
  ONE:{i:[0,0,0,0],m:TIGHT,r:TIGHT,k:TIGHT,t:ACROSS},
  FLAT:{i:[-3,2,2,0],m:[0,2,2,0],r:[2,2,2,0],k:[4,2,2,0],t:[10,10,10,5,5]},             // B, thumb alongside
  FIVE:{i:[-12,0,0,0],m:[-3,0,0,0],r:[5,0,0,0],k:[14,0,0,0],t:[60,10,0,0,0]},
  FO:{i:[0,55,30,15],m:[0,55,30,15],r:[0,55,30,15],k:[0,55,30,15],t:[40,60,20,15,10]},    // flat O
  BENT:{i:[-2,80,5,0],m:[0,80,5,0],r:[2,80,5,0],k:[4,80,5,0],t:[20,20,10,5,5]},
  CLAW:{i:[-12,40,60,40],m:[-3,40,60,40],r:[5,40,60,40],k:[14,40,60,40],t:[55,20,20,20,20]},
  ILY:{i:[0,0,0,0],m:TIGHT,r:TIGHT,k:[-15,0,0,0],t:[85,0,0,0,0]},
  OPEN8:{i:[-12,0,0,0],m:[0,45,10,5],r:[5,0,0,0],k:[14,0,0,0],t:[60,10,0,0,0]},
  EIGHT:{i:[-8,10,5,0],m:[0,50,55,30],r:[4,10,5,0],k:[12,10,5,0],t:[40,55,25,25,20]},
  NO1:{i:[-4,0,0,0],m:[4,0,0,0],r:TIGHT,k:TIGHT,t:[50,40,0,0,0]},
  NO2:{i:[0,45,35,20],m:[0,45,35,20],r:TIGHT,k:TIGHT,t:[35,55,20,20,15]},
  VB:{i:[8,40,50,20],m:[-8,40,50,20],r:TIGHT,k:TIGHT,t:ACROSS},                           // bent V
  SNAP:{i:[-4,20,20,10],m:[0,85,95,50],r:[4,60,70,40],k:[10,60,70,40],t:[50,30,0,0,0]},
  THREE:{i:[6,0,0,0],m:[-6,0,0,0],r:TIGHT,k:TIGHT,t:[60,10,0,0,0]},
  FOUR:{i:[-6,0,0,0],m:[-2,0,0,0],r:[3,0,0,0],k:[9,0,0,0],t:[10,40,45,30,20]},
  SEVEN:{i:[-6,0,0,0],m:[0,0,0,0],r:[0,45,40,20],k:[8,0,0,0],t:[35,55,20,20,15]},
};
const ASL={C:letter(HS.C,SR), O:letter(HS.O,SR), G:side(HS.G), H:side(HS.H), J:letter(HS.I),
  J2:letter(HS.I,[-.6,.1,.8],[2.3,7.6,2],[-.4,.85,-.3]),                                     // pinky hooks a J
  P:down(HS.K), Q:down(HS.G),
  Z1:letter(HS.ONE,TOCAM,[1.5,10.5,2]), Z2:letter(HS.ONE,TOCAM,[4.5,10.5,2]),                // index draws a Z
  Z3:letter(HS.ONE,TOCAM,[1.5,8,2]), Z4:letter(HS.ONE,TOCAM,[4.5,8,2])};
for(const k of 'ABDEFIKLMNRSTUVWXY') ASL[k]=letter(HS[k]);
const NEUTRAL=letter({}), RREST=NEUTRAL.slice(0,HN);   // relaxed open hand (fingerspelling spot), left hand low

// ---------------------------------------------------------------- ASL word signs (both hands)
// Signer space, relative to the face centre (cm): x = signer's left (screen right), y up, z toward the viewer.
// Landmarks: forehead y 6, eyes 1.3, nose -2.8, mouth -5.3, chin -9, neck -12, chest -22; neutral space z ~12.
// A hand = (palm centre, finger dir, palm normal, handshape[, forearm dir]); the forearm otherwise aims at an
// elbow below the shoulder. Palm centre -> fingertips ~13.5 (flat), ~12.4 (index), ~10 (flat O).
// A key = [right, left (0 = rest), hold s]. Citation forms, simplified: movement is what keyframes can show.
const R_=(...a)=>sp(0,...a), L_=(...a)=>sp(1,...a), mx=v=>[-v[0],v[1],v[2]];
const SYM=(c,f,n,s,hold)=>[R_(c,f,n,s),L_(mx(c),mx(f),mx(n),s),hold];                        // left mirrors right
const {FLAT,FIVE,FO,BENT,CLAW,ONE}=HS, LPALM=L_([2,-23,12],[-.3,0,.95],[0,1,0],FLAT);       // flat base palm up
const rep=(n,fn)=>Array.from({length:n},(_,j)=>fn(j%2,j));
const SIGNS={
  HELLO:[[R_([-9,-7.5,6],[.3,.95,0],[0,0,1],FLAT),0,.3],[R_([-17,-8,12],[.05,1,0],[-.3,0,.95],FLAT),0,.4]],   // salute off the temple
  'THANK YOU':[[R_([-2,-22.5,4],[0,1,0],[0,0,-1],FLAT),0,.55],[R_([-10,-19,16],[-.1,.35,.93],[0,.93,-.35],FLAT),0,.8]],   // chin, out
  GOOD:[[R_([-2,-22.5,4],[0,1,0],[0,0,-1],FLAT),0,.4],[R_([-3,-20,13],[.1,.3,.95],[0,.95,-.3],FLAT),LPALM,.5]],
  'I LOVE YOU':[[R_([-9,-13,12],[0,1,0],[.1,0,1],HS.ILY),0,.9]],
  YES:rep(4,j=>[R_([-9,-15,12],j?[0,.6,.8]:[0,1,0],j?[.2,-.8,.6]:[.3,0,.95],HS.S),0,.15]),               // fist nods
  NO:rep(4,j=>[R_([-9,-14,12],[.35,.3,.88],[0,-1,.3],j?HS.NO2:HS.NO1),0,.15]),                          // fingers snap shut
  PLEASE:rep(5,(_,j)=>[R_([-3+2.2*Math.cos(j*1.57),-23+2.2*Math.sin(j*1.57),7],[.7,.7,0],[0,0,-1],FLAT),0,.13]),   // circle on chest
  SORRY:rep(5,(_,j)=>[R_([-3+2.2*Math.cos(j*1.57),-23+2.2*Math.sin(j*1.57),7],[.3,.95,0],[0,0,-1],HS.A),0,.13]),
  LOVE:[[R_([2,-21,9.5],[.75,.66,0],[0,0,-1],HS.S),L_([-2,-21,8],[-.75,.66,0],[0,0,-1],HS.S),.3],
        [R_([4,-22,9.5],[.75,.66,0],[0,0,-1],HS.S),L_([-4,-22,8],[-.75,.66,0],[0,0,-1],HS.S),.6]],      // arms crossed on chest
  I:[[R_([-2,-21,9],[0,1,0],[1,0,0],HS.I),0,.45]],
  ME:[[R_([-4.3,-17,17],[.35,-.25,-.9],[0,-.96,.27],ONE),0,.45]],
  MY:[[R_([-3,-23,7],[.6,.8,0],[0,0,-1],FLAT),0,.45]],
  YOU:[[R_([-7,-17,10],[.1,.15,.98],[0,-.99,.15],ONE),0,.45]],
  YOUR:[[R_([-7,-17,10],[0,1,.15],[0,-.15,1],FLAT),0,.2],[R_([-7,-17,14],[0,1,.15],[0,-.15,1],FLAT),0,.3]],
  NAME:rep(4,j=>[R_([-8.6,j?-17.5:-15.5,11.6],[.9,0,.45],[0,-1,0],HS.H),L_([6,-19,12],[-.92,0,.4],[0,-1,0],HS.H),.15]),   // H taps H
  WHAT:rep(3,j=>SYM([-9-1.5*j,-21,13],[-.2,.25,.95],[0,1,-.26],FIVE,.25)),
  FRIEND:[[R_([-4,-17,13],[.95,0,.3],[0,-1,0],HS.X),L_([4,-19,13],[-.95,0,.3],[0,1,0],HS.X),.4],
          [R_([-4,-19,13],[.95,0,.3],[-.1,.94,.32],HS.X),L_([4,-17,13],[-.95,0,.3],[.1,-.94,.32],HS.X),.5]],   // hooked index, swap
  HELP:[0,4].map(y=>[R_([0,-19+y,13],[.3,0,.95],[.95,0,-.3],HS.A),L_([2,-23+y,12],[-.3,0,.95],[0,1,0],FLAT),y?.45:.3]),
  MORE:rep(4,j=>SYM([j?-4.5:-7.5,-18,12],[.25,.55,.8],[1,0,-.2],FO,.15)),                             // flat-O tips tap
  EAT:rep(4,j=>[R_(j?[-3.5,-10,11.2]:[-5,-12,14],[.35,.45,-.82],[0,-.88,-.48],FO),0,.15]),
  DRINK:[[R_([-2,-13,8],[0,1,0],[1,0,0],HS.C),0,.3],[R_([-2,-11,9],[0,.8,-.6],[1,0,0],HS.C),0,.45]],
  WATER:rep(4,j=>[R_([-2,-19+j,8-j],[0,1,0],[1,0,.2],HS.W),0,.15]),
  HOME:[[R_([-6.5,-10.5,11.2],[.35,.45,-.82],[0,-.88,-.48],FO),0,.3],[R_([-8,-6,11.2],[.35,.45,-.82],[0,-.88,-.48],FO),0,.4]],
  HAPPY:rep(4,j=>[R_([-3,j?-21:-25,7],[.7,.7,0],[0,0,-1],FLAT),0,.15]),
  SAD:[SYM([-4,-14,9],[0,1,0],[0,0,-1],FIVE,.3),SYM([-4,-20,9],[0,1,0],[0,0,-1],FIVE,.45)],
  STOP:[[R_([-1,-13,13],[0,.2,.98],[1,0,0],FLAT),LPALM,.2],[R_([-1,-18.5,13],[0,.2,.98],[1,0,0],FLAT),LPALM,.4]],
  GO:[SYM([-8,-17,9],[0,1,0],[0,0,-1],ONE,.25),SYM([-9,-18,15],[0,.3,.95],[0,.95,-.3],ONE,.4)],
  WANT:[SYM([-8,-20,16],[0,.2,.98],[0,.98,-.2],CLAW,.25),SYM([-7,-19,10],[0,.2,.98],[0,.98,-.2],CLAW,.4)],
  LIKE:[[R_([-3,-24,7],[.3,.95,0],[0,0,-1],HS.OPEN8),0,.25],[R_([-4,-23,14],[.3,.95,0],[0,0,-1],HS.EIGHT),0,.4]],
  SIGN:rep(4,(_,j)=>{ const a=j*1.57; return [R_([-6,-16+3*Math.sin(a),11+3*Math.cos(a)],[.4,.9,0],[0,0,1],ONE),
    L_([6,-16-3*Math.sin(a),11-3*Math.cos(a)],[-.4,.9,0],[0,0,1],ONE),.14]; }),                         // alternating circles
  LEARN:[[R_([0,-19,13],[.3,-.2,.93],[0,-1,-.2],FIVE),LPALM,.3],[R_([0,-19,13],[.3,-.2,.93],[0,-1,-.2],FO),LPALM,.2],
         [R_([-4,1,12],[.3,.5,-.8],[0,-.85,-.53],FO),LPALM,.45]],                                       // pick up, to forehead
  WORLD:[[-7,-15,12],[-2,-12,16],[3,-14,14]].map((c,j)=>[R_(c,[0,1,0],[1,0,0],HS.W),L_([5,-20,12],[0,1,0],[-1,0,0],HS.W),j<2?.18:.4]),
  PEACE:[[R_([-1.5,-17,12],[.55,.83,0],[.83,-.55,0],FLAT),L_([1.5,-17,12],[-.55,.83,0],[-.83,-.55,0],FLAT),.35],
         SYM([-11,-21,13],[-.25,0,.97],[0,-1,0],FLAT,.5)],
  BYE:rep(4,j=>[R_([-12,-10,10],[0,1,0],[.2,0,1],j?BENT:FLAT),0,.15]),                                  // wave
  FAMILY:[SYM([-3.5,-17,12],[0,1,0],[0,0,1],HS.F,.25),SYM([-10,-18,10],[0,1,0],[-.7,0,.7],HS.F,.2),SYM([-3.5,-19,7],[0,1,0],[-.5,0,-.87],HS.F,.4)],
  DEAF:[[R_([-8.7,-7.2,13],[.3,.5,-.81],[0,-.85,-.52],ONE),0,.3],[R_([-6.2,-12.2,13],[.3,.5,-.81],[0,-.85,-.52],ONE),0,.4]],
  UNDERSTAND:[[R_([-9,1,7],[.2,.98,0],[0,0,-1],HS.S),0,.3],[R_([-9,1,7],[.2,.98,0],[0,0,-1],ONE),0,.45]],   // index flicks up
  FINISH:[SYM([-8,-15,10],[0,1,0],[.3,0,-.95],FIVE,.25),SYM([-11,-16,12],[0,1,0],[-.75,0,.66],FIVE,.4)],
  WORK:rep(4,j=>[R_([8,j?-19:-17,10],[.8,0,.6],[0,-1,0],HS.S),L_([5,-21,12],[-.85,0,.5],[0,-1,0],HS.S),.15]),
  SCHOOL:rep(4,j=>[R_([-1,j?-20.5:-16,13],[.3,0,.95],[0,-1,0],FLAT),LPALM,.15]),                         // clap twice
  MEET:[SYM([-11,-17,12],[0,1,0],[1,0,0],ONE,.25),SYM([-3,-17,12],[0,1,0],[1,0,0],ONE,.45)],
  NICE:[[R_([-1,-19.5,9],[.3,0,.95],[0,-1,0],FLAT),LPALM,.25],[R_([-1,-19.5,16],[.3,0,.95],[0,-1,0],FLAT),LPALM,.35]],
  FAST:[SYM([-6,-18,14],[.1,.2,.97],[1,0,-.1],HS.L,.2),SYM([-7,-18,9],[.1,.2,.97],[1,0,-.1],HS.X,.35)],   // index snaps to X
  BROWN:[[R_([-8.5,-12,6],[0,1,0],[.15,0,1],HS.B),0,.25],[R_([-8.5,-17,6],[0,1,0],[.15,0,1],HS.B),0,.4]],  // B down the cheek
  FOX:rep(3,j=>[R_([-2,-10,9],j?[.35,.9,.25]:[.15,.9,.4],j?[.93,-.3,-.2]:[1,0,-.375],HS.F),0,.25]),      // F twists at the nose
  JUMP:rep(3,j=>[R_([-.4,-17+3*j,6.3],[.15,-.7,.7],[0,-.7,-.7],j?HS.VB:HS.V,[-.8,-.45,-.4]),L_([3,-27.2,13],[-.2,0,.98],[0,1,0],FLAT),j?.2:.25]),   // V legs hop on the palm
  OVER:[[-9,-18,12],[-1,-15,13],[7,-17,12]].map((c,j)=>[R_(c,[.9,0,.43],[0,-1,0],FLAT),L_([5,-20,12],[-.9,0,.43],[0,-1,0],FLAT),j<2?.18:.3]),
  LAZY:rep(4,j=>[R_([5,-24+j,7+j],[.4,.9,0],[0,0,-1],HS.L),0,.15]),                                     // L taps the shoulder
  DOG:rep(4,j=>[R_([-10,-21,12],[0,1,.2],[.3,0,.95],j?HS.SNAP:HS.EIGHT),0,.18]),                         // finger snaps
};
// ---------------------------------------------------------------- compact sign lexicon (LEX), compiled on demand
// One line per sign: WORD[,SYNONYM…]=<handshape> <location[:contact]> <fingers>.<palm> [moves…] [| two-hand]
//  location: face/body TOP FH FHS EY NS CK ER MO CH JW NK SH SHX CS CSS CSX ST; neutral space N NH NHC NL NC NF SD
//    (palm centre goes there); on the base hand P palm, BK back, BU above, BT fingertips, BI inner edge, WR wrist.
//    Contact = fingertip (palm on chest/shoulders), or :p palm, :bk back of hand, :th thumb tip — measured on the rig.
//  directions: U D F (toward viewer) B (toward body) M (medial, toward the other hand) L (lateral); combine: UM
//  moves: Dn Up Fw Bk In Out (6 cm, s- prefix 3 cm), T tap, C/Ch/Cs circle (front/horizontal/side plane), Tw twist,
//    Nd wrist nod, Sh shake, Wg wiggle, a location = move there, o:F.N = turn, >HS = handshape at the end of the
//    move; a trailing digit repeats (Dn2, T1).   two-hand: 2 mirrored, 2a alternating, b[:HS:F.N] static base hand.
// Citation forms, simplified to what keyframes show; not checked by a fluent signer.
const LEX=`
# people
HE,SHE,IT,HIM,HER=ONE N FL.D
THEY,THEM=ONE N FL.D Out
WE,US=ONE CSS BU.D CSX
OUR=C CSS U.M CSX
MYSELF=A CS F.M T
YOURSELF,SELF=A N F.M sFw
HIS,ITS=FLAT N U.F sFw
THEIR=FLAT N U.F Out
WHO=ONE MO U.B sC
WHERE=ONE NH U.F Sh
WHEN=ONE BT D.F C | b:ONE:U.M
WHY=BENT FHS UM.B Fw>Y
HOW=BENT NC D.B o:U.F | 2
WHICH=A N F.M Up | 2a
MAN,MEN=FIVE FH:th U.M CS:th
WOMAN,WOMEN=FIVE CH:th U.M CS:th
BOY=FO FHS FM.D >BENT >FO
GIRL=A CK:th F.M sDn
BABY=FLAT NL FM.U Sh | 2
CHILD,KID=FLAT N F.D sDn
CHILDREN,KIDS=FLAT N F.D sDn Out sDn
PERSON=K N F.D Dn | 2
PEOPLE=K N F.D Ch | 2a
MOTHER,MOM=FIVE CH:th U.M T
FATHER,DAD=FIVE FH:th U.M T
PARENTS=FIVE FH:th U.M CH:th
GRANDMOTHER,GRANDMA=FIVE CH:th U.M Fw2
GRANDFATHER,GRANDPA=FIVE FH:th U.M Fw2
SISTER=L CK:th F.M BU | b:L:F.M
BROTHER=L FHS:th F.M BU | b:L:F.M
AUNT=A CK U.F Tw2
UNCLE=U FHS U.F Tw2
COUSIN=C CK U.M Sh
NIECE=N CK U.M Tw2
NEPHEW=N FHS U.M Tw2
SON=BENT FHS M.D BU | b:FLAT:M.U
DAUGHTER=BENT CH M.D BU | b:FLAT:M.U
HUSBAND=C FHS F.M NC | b:C:F.M
WIFE=C CH F.M NC | b:C:F.M
TEACHER=FO FHS F.M Fw | 2
STUDENT=FIVE P D.B >FO o:UM.B FH
DOCTOR=M WR D.B T
NURSE=U WR D.B T
POLICE,COP=C SHX F.M T
BOSS=CLAW SH D.B T
KING=K SHX U.B CSS
HEARING=ONE MO M.B sC2
# time
WELCOME,INVITE=FLAT N FM.U In
SEE,SAW,SEEN=V EY U.B Fw
LATER=L N U.F sTw
MORNING=FLAT NL F.U Up | b:FLAT:M.D
AFTERNOON=FLAT N U.F sDn | b:FLAT:M.D
NIGHT,TONIGHT=BENT BK FM.D sDn | b:FLAT:M.D
DAY=ONE N U.M In | b:FLAT:M.D
NOW,TODAY=BENT NL F.U sDn | 2
TOMORROW=A CK:th U.M Fw
YESTERDAY=Y CK:th U.F Bk
WEEK=ONE P F.D In
MONTH=ONE BI D.M Dn | b:ONE:U.M
YEAR=S NC F.M Cs | b:S:F.M
TIME=ONE WR D.B T | b:S:FM.D
HOUR=ONE P F.M C | b:FLAT:U.M
MINUTE=ONE P:p U.M sTw | b:FLAT:U.M
ALWAYS=ONE N UF.U C
NEVER=FLAT N U.M Dn Out
SOMETIMES=ONE P D.B T
OFTEN=BENT P D.B T
AGAIN,REPEAT=BENT N UM.U o:D.B P
BEFORE=FLAT N U.B Bk | b:FLAT:U.F
AFTER=FLAT N M.D Fw | b:FLAT:M.B
READY=R N F.D Out | 2
WAIT=FIVE N UM.U Wg | 2
START,BEGIN=ONE BI F.M Tw | b:FLAT:F.M
END=FLAT BT F.D Fw | b:FLAT:F.M
SOON=F CH UM.B sFw
LATE=FLAT SD D.B Sh
EARLY=OPEN8 BK F.D Fw | b:FLAT:F.D
PARTY=Y N U.F Sh | 2
VACATION,HOLIDAY=FIVE CS:th U.M Wg | 2
SUMMER=X FH M.B Out
WINTER=W N U.F Sh | 2
SPRING=FO P:p U.M Up>FIVE | b:C:F.M
FALL,AUTUMN=FLAT BK F.D Dn | b:ONE:UM.M
MONDAY=M N U.F sC
TUESDAY=T N U.F sC
WEDNESDAY=W N U.F sC
THURSDAY=H N U.F sC
FRIDAY=F N U.F sC
SATURDAY=S N U.F sC
SUNDAY=FLAT N U.F C | 2
FIRST=ONE BI F.M T1 | b:A:F.M
LAST=I BT F.D T1 | b:I:F.M
# numbers
ONE=ONE NH U.B
TWO=V NH U.B
THREE=THREE NH U.B
FOUR=FOUR NH U.B
FIVE=FIVE NH U.B
SIX=W NH U.F
SEVEN=SEVEN NH U.F
EIGHT=EIGHT NH U.F
NINE=F NH U.F
TEN=A NH F.M Tw2
# verbs
KNOW,KNEW=BENT FHS UM.B T
THINK,THOUGHT=ONE FHS U.B T1
FEEL,FELT=OPEN8 CS U.B Up
REMEMBER=A FH:th F.M BU | b:A:F.M
FORGET,FORGOT=FLAT FH M.B Out>A
BELIEVE=ONE FHS U.B NC>C | b:C:F.M
NEED,MUST,SHOULD=X N F.D Dn2
HAVE,HAS,HAD=BENT CS M.B T1 | 2
GIVE,GAVE=FO N F.M Fw | 2
TAKE,TOOK=CLAW NF F.D Bk>S
GET,GOT,RECEIVE=CLAW N F.M Bk>S | 2
MAKE,MADE=S NC F.M Tw2 | b:S:F.M
DO,DOES,DID=C N F.D Sh | 2
SAY,SAID=ONE MO U.B Fw
TELL,TOLD=ONE CH U.B Fw
TALK,SPEAK,SPOKE=ONE MO U.M Fw2
ASK=ONE N U.F Bk>X
ANSWER,REPLY=ONE MO U.M Fw | 2
SHOW=ONE P F.M Fw | b:FLAT:U.F
LOOK,WATCH=V EY F.D Fw
READ=V P D.B Dn | b:FLAT:U.B
WRITE,WROTE=FO P F.D In
DRAW,ART=I P D.B Dn2 | b:FLAT:U.B
PLAY=Y N U.F Tw2 | 2
RUN,RAN=L N F.M Fw | 2
WALK=FLAT N F.D Fw2 | 2a
SIT,SAT,SEAT=H BU F.D T1 | b:H:FM.D
STAND,STOOD=V P D.B T1
COME,CAME=ONE N U.B Bk | 2
LEAVE=FIVE N F.D Bk>A | 2
STAY=Y N F.D sDn
LIVE,LIFE=A CSS U.B Up | 2
DIE,DEAD=FLAT NC F.D Tw | 2a
SLEEP,SLEPT=FIVE FH U.B Dn>FO
WAKE=G EY M.F >L | 2
COOK=FLAT P F.D o:F.U
BUY,BOUGHT=FO P:bk F.U Fw
SELL,SOLD,STORE,SALE=FO N D.B Tw2 | 2
PAY,PAID=ONE P DF.B Fw
COST,PRICE=X P D.M Dn | b:FLAT:U.M
MONEY=FO P:bk F.U T
STUDY=FIVE P D.B Wg
TEACH,TAUGHT=FO FHS F.M Fw | 2
SPELL,FINGERSPELL=FIVE N U.F Out Wg
HATE=EIGHT N U.F Fw>FIVE | 2
CRY=ONE EY U.B Dn2 | 2a
LAUGH=L MO U.B Out2 | 2
SMILE=BENT CK U.B Up | 2
OPEN=FLAT NC F.D Out o:F.M | 2
CLOSE,SHUT=FLAT N F.M In o:F.D | 2
BRING=FLAT N FM.U In | 2
PUT=FO N F.D Fw | 2
MOVE=FO N F.D Out | 2
TRY=S N F.M Fw | 2
USE=U BU F.M sC | b:S:F.D
FIND,FOUND=FIVE N F.D Up>F
LOSE,LOST=FO NC F.U Dn>FIVE | 2
WIN,WON=FIVE NH FM.D BU>S | b:S:F.M
CALL,PHONE=Y ER U.M T1
TEXT=A NL F.U Wg | 2
CHANGE=X NC U.M Tw | 2
FIX=FO NC F.D T | 2a
BREAK,BROKE=S NC F.D Dn | 2
BUILD,BUILT=BENT NC F.D Up2 | 2a
CUT=V BT F.D Fw | b:FLAT:F.D
CLEAN=FLAT P F.D Fw2
WASH=A BU F.D Ch | b:A:F.U
DRIVE,CAR=S N F.M Up | 2a
FLY,AIRPLANE,PLANE=ILY NH F.D Fw
SWIM=FLAT N F.D Out | 2
DANCE=V P D.B Sh
SING,SONG,MUSIC=FLAT P F.M Out2
LISTEN=C ER UF.F T1
HEAR,HEARD=ONE ER U.M T1
SHOP,SHOPPING=FO P:bk F.U Fw2
CAN,ABLE=S N F.D Dn | 2
CANT=ONE BI F.D Dn | b:ONE:F.D
WILL,FUTURE=FLAT FHS U.M Fw
MAYBE,PERHAPS=FLAT N F.U Up | 2a
NOT,WONT,ISNT,ARENT,DIDNT,DOESNT,WASNT=A CH:th F.M Fw
DONT=FLAT NC U.F Out | 2
NONE,NOTHING=O N U.F Out | 2
ARRIVE=BENT P F.D Fw
BORROW=V N F.M Bk | 2
LEND=V N F.M Fw | 2
CATCH=CLAW NF U.F Bk>S
THROW=S NH F.M Fw>FIVE
PUSH=FLAT N U.F Fw | 2
PULL=CLAW NF F.U Bk>S | 2
CHOOSE,PICK=F NF U.F Bk
DECIDE=F FHS U.M Dn | 2
AGREE=ONE FHS U.B NC | 2
ALLOW,LET=FLAT N F.M Fw | 2
FOLLOW=A N F.M Fw | b:A:F.M
MISS=ONE CH U.B T1
JOIN=H BI F.D Fw | b:C:F.M
PRACTICE=A BI F.D Out2 | b:ONE:F.M
SEARCH=C EY U.M C
SHARE=FLAT BI F.M Sh | b:FLAT:F.M
SEND=BENT BK F.D Fw>FLAT | b:FLAT:F.D
SMELL=FLAT NS U.B Up2
TASTE=OPEN8 MO U.B T1
TOUCH=OPEN8 BK D.B T1 | b:FLAT:F.D
WISH=C CS M.B Dn
TRAVEL,TRIP=VB N D.F Cs
CELEBRATE=X NH U.F Ch | 2
COPY=FIVE P F.D Bk>FO | b:FLAT:F.M
CONTINUE=A N F.M Fw | 2
DREAM=X FHS U.B Out Wg
ENTER=FLAT BI F.D Fw | b:FLAT:F.D
EXPLAIN,DESCRIBE=F N F.M Fw2 | 2a
FEED=FO N F.U Fw | 2
FIGHT=S N F.M In2 | 2
GROW=FO P:p U.M Up>FIVE | b:C:F.M
GUESS=C FHS M.B In>S
HIT=S BU F.M In | b:ONE:U.M
IMAGINE=I FHS U.B Out
KEEP=K BU F.M T1 | b:K:F.M
KNOCK=A N U.B T
LIE=BENT CH F.D In
PAINT=FLAT P F.D Up2 | b:FLAT:U.B
PLAN,PREPARE=FLAT N F.M Out | 2
PRAY=FLAT NC U.M Up | 2
PROMISE=ONE MO U.M o:F.D BU:p>FLAT | b:S:F.M
QUIT=H BI F.D Up | b:C:F.M
REST,RELAX=BENT CS U.B T1 | 2
SAVE=V BK F.M T1 | b:S:F.M
SPEND=FO P:bk F.U Fw>FIVE | b:FLAT:F.U
STEAL=V BK F.D Bk>VB | b:FLAT:F.D
SUPPORT=S BU F.M Up | b:S:F.M
VOTE=F BI D.B T1 | b:FO:F.M
WARN=FLAT BK F.D T | b:FLAT:F.D
WONDER=ONE FHS U.B sC
ACCEPT=FIVE N F.D Bk>FO | 2
CARE=K BU F.M Ch | b:K:F.M
CHAT=FIVE N U.F In2 | 2a
CHECK=ONE EY U.B o:D.B P
COUNT=FO P F.D Fw
DISCUSS=ONE P D.M T | b:FLAT:U.M
ERASE=A P F.D Sh
HAPPEN=ONE NC F.U o:F.D | 2
HOLD=S N F.M Bk | 2
HURRY=H N F.M Up2 | 2
INTRODUCE=FLAT N FM.U In | 2
KILL=ONE P F.D In | b:FLAT:F.M
LOCK=S BK F.D Tw | b:S:F.D
MIX=CLAW NC F.D Ch | 2a
NOTICE=BENT P F.D T1 | b:FLAT:F.M
PROTECT=S NC F.M Fw | b:S:F.M
REMOVE=A P F.D Out>FIVE
RESPECT=R FHS U.M Dn
RETURN=ONE N B.D Bk | 2
RIDE=VB BU D.B Fw | b:C:F.M
SMOKE=V MO U.B T1
SUCCEED,SUCCESS=ONE FHS U.B Up | 2
TURN=ONE N F.D Ch
TYPE=FIVE N F.D Wg | 2
# feelings & qualities
BAD=FLAT CH U.B o:F.D sDn
BIG,LARGE=L N F.M Out | 2
SMALL,LITTLE=FLAT N F.M In | 2
TALL=FLAT NH F.D Up
SHORT=FLAT N F.D Dn
LONG=ONE WR F.M Up | b:FLAT:FM.D
HOT=CLAW MO U.B o:D.F Out
COLD=S N F.M Sh | 2
WARM=FO MO U.B Up>FIVE
COOL=FIVE CH UM.B Wg
NEW=BENT P F.U In
OLD=S CH F.M Dn
YOUNG=BENT CS U.B Up2 | 2
SLOW=FLAT BK F.D Up | b:FLAT:FM.D
EASY=BENT BT F.U Up2 | b:BENT:F.U
HARD,DIFFICULT=VB BU F.D T1 | b:VB:F.D
BEAUTIFUL,PRETTY=FIVE NS U.B C>FO
UGLY=X NS M.B Out
ANGRY,MAD=CLAW NS U.B Fw
SCARED,AFRAID=S CS UM.B In>FIVE | 2
TIRED=BENT CS U.B o:D.B sDn | 2
SICK,ILL=OPEN8 FH U.B T1
HUNGRY=C CS M.B Dn
THIRSTY=ONE NK U.B Dn
FULL=FLAT NK F.D T1
BORED,BORING=ONE NS U.B Tw
BUSY=B BU:p U.F Sh | b:S:F.D
FUNNY,FUN=H NS U.B sDn2
IMPORTANT=F NC U.F Up | 2
RIGHT,CORRECT=ONE BU F.M T1 | b:ONE:F.M
WRONG=Y CH U.B T1
TRUE,REAL,REALLY,SURE=ONE MO U.M Fw
SAME,ALSO,TOO=ONE N F.D In | 2
DIFFERENT,BUT=ONE NC F.D Out | 2
FINE=FIVE CS:th U.M sFw
ALL,EVERYTHING=FLAT P F.U C | b:FLAT:U.B
MANY,LOTS=S N F.U >FIVE | 2
LESS=FLAT BU F.D Dn | b:FLAT:F.U
SOME=FLAT P F.M Bk
EVERY,EACH=A BU F.M Dn | b:A:F.M
ENOUGH=FLAT BU F.D Fw | b:S:F.M
DIRTY=FIVE CH F.D Wg
WET=FIVE CH U.B >FO
DRY=X CH F.D Out
QUIET=FLAT MO U.M Out | 2
LOUD,NOISE=ONE ER U.M Out | 2
DARK=FLAT FH U.B Dn | 2
LIGHT,BRIGHT=FO NH F.D Up>FIVE | 2
HEAVY=FLAT N F.U Dn | 2
STRONG=S SH U.B Fw | 2
WEAK=CLAW P D.B T
RICH=FO P F.U Up>CLAW
POOR=CLAW BK D.B Dn>FO | b:FLAT:F.D
HURT,PAIN=ONE NC F.M In T | 2
EXCITED,EXCITING=OPEN8 CS U.B Up2 | 2a
PROUD=A ST:th F.M Up
SURPRISED,SURPRISE=S EY UF.B >L | 2
WORRY,WORRIED=FLAT FH UM.B C | 2a
ENJOY=FLAT CS UM.B C | 2a
BEST,BETTER=FLAT CH U.B Out>A
FAVORITE=OPEN8 CH U.B T
FRIENDLY=FIVE CK U.B Wg | 2
HONEST=H P F.M Fw
PATIENT=A CH:th F.M Dn
SMART=ONE FHS U.B Fw
CUTE=H CH U.B sDn2
WONDERFUL=FIVE NH U.F Fw | 2
FREE=F NC U.B Out | 2
TOGETHER=A NC F.M Ch | 2
ALONE=ONE N U.B sC
AWAY=BENT N F.D Fw>FLAT
OKAY,OK=O N U.M >K
WOW=W N U.F Sh
# colours
COLOR=FIVE CH U.B Wg
RED=ONE MO U.B sDn2
BLUE=B N U.F Tw2
GREEN=G N U.F Tw2
YELLOW=Y N U.F Tw2
ORANGE=S CH F.M >C >S
PURPLE=K N F.D Tw2
PINK=K MO D.B sDn2
BLACK=ONE FH M.D Out
WHITE=FIVE CS U.B Fw>FO
GRAY,GREY=FIVE NC U.B Sh | 2
GOLD=Y ER U.M Out
# food
APPLE=X CK F.M Tw2
BANANA=FO BT D.B Dn2 | b:ONE:U.M
BREAD=BENT BK M.B T | b:FLAT:M.B
BUTTER=H P F.D Bk2
CANDY,SWEET=ONE CK B.M Tw2
CHEESE=FLAT P F.D Tw2 | b:FLAT:F.U
CHICKEN=G MO F.M >ONE >G
COFFEE=S BU F.M Ch | b:S:F.M
COOKIE=CLAW P D.B Tw2
EGG=H BU F.D Dn | b:H:F.D
FISH=FLAT N F.M Sh
FRUIT=F CK F.M Tw
HAMBURGER=C P M.D o:M.U | b:C:M.U
ICE CREAM,ICECREAM=S MO F.M sDn2
MEAT=FO BI F.D Sh | b:FLAT:F.M
MILK=C N F.M >S >C >S
SALAD=CLAW NC F.U In2 | 2
SALT=V BU F.D Wg | b:V:F.D
SANDWICH=FLAT MO B.D sBk
SOUP=H P F.U Up2
SUGAR=U CH U.B sDn2
TEA=FO BU D.B Ch | b:O:F.M
VEGETABLE=V CK U.F Tw
WINE=W CK U.F sC
BEER=B CK U.F sDn2
RESTAURANT=R MO U.M sC
KITCHEN=K P F.D o:F.U | b:FLAT:F.U
# places & things
HOUSE=FLAT NHC UM.DM Out Dn | 2
ROOM,BOX=FLAT N F.M Out | 2
BED=FLAT CK:p U.M T1
BATHROOM,TOILET=T N U.F Sh
DOOR=B NC U.F o:UL.F | b:B:U.F
WINDOW=B BU M.B T1 | b:B:M.B
TABLE,DESK=FLAT BU F.D T | b:FLAT:M.D
CHAIR=H BU F.D T | b:H:FM.D
BUS=B N U.M Out | b:B:U.M
TRAIN=H BU F.D Fw2 | b:H:F.D
BICYCLE,BIKE=S N F.D Cs | 2a
BOAT=BENT N F.U Fw | 2
CHURCH=C BK F.D T1 | b:S:F.D
HOSPITAL=H SHX U.B Dn In
LIBRARY=L N U.F sC
CITY,TOWN=FLAT NC UM.B T | 2a
COUNTRY=Y BK F.D sC | b:FLAT:M.D
AMERICA=FIVE NC UM.B Ch | 2
IN,INSIDE=FO P D.B Dn | b:C:F.M
OUT,OUTSIDE=FIVE P D.B Up>FO | b:C:F.M
HERE=FLAT NL F.U Ch | 2
THERE=ONE N FL.D Fw
UP=ONE N U.F Up
DOWN=ONE N D.B Dn
ON=FLAT BU F.D T1 | b:FLAT:FM.D
OFF=FLAT BU F.D Up | b:FLAT:FM.D
UNDER,BELOW=A NL U.M sCh | b:FLAT:FM.D
NEAR=BENT N U.B In | b:BENT:U.B
FAR=A N F.M Fw | b:A:F.M
NEXT=BENT N M.B Fw | b:BENT:M.B
LEFT=L N U.F In
FRONT=FLAT NH U.F sDn
BEHIND,BACK=A N F.M Bk | b:A:F.M
BETWEEN=FLAT BI F.M Sh | b:FLAT:F.M
MIDDLE=BENT P D.B Ch
FLOOR=FLAT NL F.D Out | 2
WALL=FLAT NC U.F Out | 2
ROAD,STREET,WAY=FLAT N F.M Fw | 2
FARM=FIVE CH:th U.M Out
KEY=X P F.D Tw | b:FLAT:F.M
BAG=S N F.M Dn
BALL=CLAW N UM.M In | 2
CUP,GLASS=C P F.M T1
BOTTLE=C P F.M Up
GUN=L N F.M sUp
KNIFE=H BI F.M Fw2 | b:H:F.M
LINE=I NC U.B Out | 2
MACHINE=FIVE NC M.B Dn2 | 2
MIRROR=FLAT EY U.B Tw
PENCIL=FO MO F.M BU
PLACE=K NC U.F Ch | 2
RING=ONE BI F.D Tw | b:FIVE:F.D
ROCK,STONE=S BK F.D T | b:S:F.D
TICKET=VB BI F.D T1 | b:FLAT:F.M
PROBLEM=VB NC F.D Tw | 2
SECRET=A MO:th F.M T
THING,THINGS=FLAT N F.U Out2
SOMETHING,SOMEONE,SOMEBODY=ONE N U.F sC
TEAM=T NC U.F Ch | 2
PET=FLAT BK F.D Bk2 | b:FLAT:F.D
CAMERA=L EY F.M T1 | 2
CLOUD=C NHC U.F Ch | 2
# animals & nature
CAT=F CK:th U.F Out2 | 2
BIRD=G MO F.M >FO >G
HORSE=U FHS U.F Nd
COW=Y FHS:th U.F Tw
PIG=FLAT CH F.D Nd
MOUSE,MICE=ONE NS U.M Sh
RABBIT,BUNNY=H FHS U.B Nd | 2
BEAR=CLAW CS UM.B Dn2 | 2
LION=CLAW FH U.B Bk
MONKEY=CLAW CSS U.B Up2 | 2
ELEPHANT=BENT NS F.D Dn Fw
SNAKE=VB MO F.D Fw
DUCK=NO1 MO F.D >NO2 >NO1
ANIMAL=BENT CS U.B Nd | 2
DEER=FIVE FHS:th U.F T1 | 2
TURTLE=A BU F.M Wg | b:FLAT:F.D
SUN,SUNNY=CLAW NH F.D >FIVE
MOON=C FHS U.M Up
STAR,STARS=ONE NH U.F Up2 | 2a
RAIN,RAINING=CLAW NH F.D Dn2 | 2
SNOW=FIVE NH F.D Dn Wg | 2
WIND,WINDY=FIVE NH U.F Sh | 2
TREE=FIVE BU:p U.F Tw2 | b:FLAT:M.D
FLOWER=FO NS U.B In
FIRE=FIVE NL U.B Up Wg | 2
WEATHER=W N U.F Wg | 2
SKY=FLAT NH U.F Out
MOUNTAIN=S BU F.D Up | b:S:F.D
OCEAN,SEA,WAVE=FLAT N F.D Fw2 | 2
EARTH=FIVE BU F.D Sh | b:S:F.D
# school & work
CLASS=C N U.F Ch | 2
BOOK=FLAT NC FM.M o:F.U | 2
PAPER=FLAT P F.D In2
PEN=FO P F.D Sh
COMPUTER=C BK F.M Up | b:FLAT:FM.D
TEST,EXAM=X NH U.F Dn>ONE | 2
QUESTION=ONE NH U.F Fw>X
IDEA=I FHS U.B Up
NUMBER=FO NC M.D Tw | 2
WORD=G BI F.M T1 | b:ONE:U.M
LETTER,MAIL=A MO:th F.M BU
STORY=F NC U.F Out2 | 2
LANGUAGE=L NC U.F Out Wg | 2
SENTENCE=F NC U.F Out | 2
ENGLISH=FLAT BK F.D Bk | b:FLAT:F.D
MEETING=FIVE NC U.F In>FO | 2
# body & everyday
HEAD=BENT FHS M.B JW
FACE=ONE NS U.B C
EYE,EYES=ONE EY U.B T1
EAR=ONE ER U.M T1
NOSE=ONE NS U.B T1
MOUTH=ONE MO U.B sC
HAIR=FO FHS U.M Sh
HAND,HANDS=FLAT BK F.D Bk | b:FLAT:F.D
BODY=FLAT CS U.B Dn | 2
HEART=OPEN8 CS U.B T1
TOOTH,TEETH=X MO M.B Sh
MEDICINE=OPEN8 P D.B sC
BLOOD=FIVE BK F.D Dn Wg | b:FLAT:F.D
EXERCISE=S SH F.D Up2 | 2
SHOWER=FO NH F.D >FIVE >FO >FIVE
BATH=A CS UM.B Dn2 | 2
GLASSES=G EY F.M T1 | 2
CLOTHES,WEAR,DRESS=FIVE CS U.B Dn2 | 2
SHIRT=FO CSS U.B T
SHOES=S NC F.D T | 2
HAT=FLAT TOP:p F.D T
COAT,JACKET=A SH F.M Dn In | 2
MOVIE,FILM=FIVE P:p U.F Sh | b:FLAT:U.B
GAME=A NC F.M T | 2
PICTURE,PHOTO=C EY F.M BU | b:FLAT:U.M
# little words
AND=FIVE N F.M Out>FO
OR=L BT F.M T | b:L:U.M
BECAUSE=ONE FHS U.B Out>A
WITH=A NC F.M In | 2
WITHOUT=A NC F.M Out>FIVE | 2
FOR=ONE FHS U.B o:F.D Fw
FROM=X BI F.M Bk | b:ONE:U.M
ABOUT=ONE BT F.M C | b:FO:F.M
VERY=V NC U.F Out | 2
ONLY=ONE N U.F Tw
STILL=Y N F.D Fw
EXCUSE,FORGIVE=BENT P F.D Fw2
MARRY,MARRIED=C NC F.D Dn | b:C:F.U
GIFT,PRESENT=X N F.M Fw | 2
VISIT=V N U.F Ch | 2a
KISS=FO MO U.B CK
HUG=A SH UM.B In | 2
`;
const LOC={TOP:[0,11,1],FH:[0,6,3],FHS:[-5.5,4.5,2],EY:[-3,.3,3],NS:[0,-2.8,4],CK:[-4.5,-3,2.5],ER:[-7.5,0,.5],
  MO:[0,-5.3,3.5],CH:[0,-9,3],JW:[-5,-7,2],NK:[0,-12.5,2.5],SH:[-9,-15.5,2.5],SHX:[8,-15.5,2.5],CS:[0,-21,5],
  CSS:[-5,-21,5],CSX:[5,-21,5],ST:[0,-27,6],N:[-6,-18,13],NH:[-7,-11,12],NHC:[0,-11,12],NL:[-6,-24,12],NC:[0,-18,13],
  NF:[-6,-17,18],SD:[-14,-16,9]};
const NEU=new Set(['N','NH','NHC','NL','NC','NF','SD']), BODY=new Set(['CS','CSS','CSX','ST','SH','SHX']), BASEC=new Set(['P','BK','BU','BT','BI','WR']), BASEAT=[2,-22,12];
const DIRS={U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1],M:[1,0,0],L:[-1,0,0]}, dir=s=>norm([...s].reduce((a,c)=>add(a,DIRS[c]),[0,0,0]));
const MV={Dn:[0,-1,0],Up:[0,1,0],Fw:[0,0,1],Bk:[0,0,-1],In:[1,0,0],Out:[-1,0,0]}, toSig=v=>[dot(v,SR),v[1],dot(v,TH)];
function contact(h,f,n,s,pt){   // signer-space offset palm centre -> contact point, measured on the rig
  if(pt==='p'||pt==='bk') return mul(norm(sub(n,mul(f,dot(n,f)))),pt==='p'?1.1:-1.3);
  const H=buildHand(sp(h,[0,0,0],f,n,s),h?-1:1), F=norm(SV(f)), pts=pt==='th'?[H.segs[2][1]]:[2,5,8,11,14].map(i=>H.segs[i][1]);
  return toSig(sub(pts.reduce((a,p)=>dot(sub(p,a),F)>0?p:a),H.palm));
}
function compile(spec){   // LEX line -> SIGNS keys [right, left|0, hold]
  let [main,two='']=spec.split('|').map(x=>x.trim()); const tk=main.split(/\s+/), [loc,part]=tk[1].split(':'), [fc,nc]=(tk[2]||'').split('.');
  const s0=HS[tk[0]]; if(!s0||!fc||!nc||!(LOC[loc]||BASEC.has(loc))) throw `bad head "${main}"`;
  const par=(x,y)=>Math.abs(dot(dir(x),dir(y)))>.85;   // palm can't face the way the fingers point
  if(!two&&tk.slice(1).some(t=>BASEC.has(t.split(/[:>]/)[0]))) two='b';   // any base location implies the default base hand
  let base=null, bs, bf, bn;
  if(two[0]==='b'){ const [,bh='FLAT',bo='FM.U']=two.split(':'), [x,y]=bo.split('.'); bs=HS[bh]; if(!bs) throw `bad base "${two}"`;
    bf=mx(dir(x)); bn=mx(dir(y)); base=L_(BASEAT,bf,bn,bs); }
  const bpt=c=>{ if(!base) throw `"${c}" needs a base hand`;
    return c==='P'?add(BASEAT,mul(bn,1.2)):c==='BK'?sub(BASEAT,mul(bn,1.4)):c==='BU'?add(BASEAT,[0,2.8,0]):c==='BI'?add(BASEAT,[-2.6,0,0])
      :c==='WR'?sub(sub(BASEAT,mul(bf,4.6)),mul(bn,1.2)):add(BASEAT,contact(1,bf,bn,bs,'t')); };
  const sym=two==='2'||two==='2a', mid=sym&&(loc==='NC'||loc==='NHC')?[-3.5,0,0]:[0,0,0];   // mirrored hands at the centre sit side by side
  const place=(c,pt,f,n,s)=>NEU.has(c)?add(LOC[c],mid):sub(LOC[c]||bpt(c),contact(0,f,n,s,pt||(BODY.has(c)?'p':'t')));
  const away=BASEC.has(loc)?[0,2.5,0]:NEU.has(loc)?(sym?[-2.5,0,0]:[0,2.5,0]):[0,0,2.5];   // tap lifts off this way
  if(par(fc,nc)) throw `fingers and palm both ${fc}/${nc}`;
  const f0=dir(fc), n0=dir(nc); let cur={c:place(loc,part,f0,n0,s0),f:f0,n:n0,s:s0,hold:.22}; const K=[cur];
  const put=o=>{ cur={...cur,...o}; K.push(cur); };
  for(const t of tk.slice(3)){
    const [body,to]=t.split('>'), m=body.match(/^(s?)(o:[A-Z]+\.[A-Z]+|[A-Za-z]*(?::[a-z]+)?)(\d?)$/);
    if(!m) throw `bad move "${t}"`;
    const [,sm,op,rp]=m, a=cur, r=+rp, [lc,lp]=op.split(':');
    if(op==='') put({hold:.18});
    else if(MV[op]){ const v=add(a.c,mul(MV[op],sm?3:6)); for(let i=0;i<(r||1);i++){ put({c:v,hold:r>1?.14:.26}); if(i<r-1) put({c:a.c,hold:.14}); } }
    else if(op==='T') for(let i=0;i<(r||2);i++){ put({c:add(a.c,away),hold:.12}); put({c:a.c,hold:.12}); }
    else if(op==='C'||op==='Ch'||op==='Cs') for(let i=0;i<4*(r||1);i++){ const th=(i+1)*Math.PI/2, u=Math.cos(th)-1, v=Math.sin(th);
      put({c:add(a.c,mul(op==='C'?[u,v,0]:op==='Ch'?[u,0,v]:[0,v,u],sm?1.2:2.5)),hold:.12}); }
    else if(op==='Tw') for(let i=0;i<(r||1);i++){ put({n:rot(a.n,a.f,1),hold:.16}); if(i<r-1) put({n:a.n,hold:.16}); }
    else if(op==='Nd'){ const k=norm(cross(a.f,a.n)); for(let i=0;i<(r||2);i++){ put({f:rot(a.f,k,.6),n:rot(a.n,k,.6),hold:.14}); put({f:a.f,n:a.n,hold:.14}); } }
    else if(op==='Sh'){ const d=sm?1:2; for(let i=0;i<(r||2);i++){ put({c:add(a.c,[d,0,0]),hold:.12}); put({c:add(a.c,[-d,0,0]),hold:.12}); } put({c:a.c,hold:.12}); }
    else if(op==='Wg'){ const cv=(x,d)=>[x[0],x[1]+d,x[2]+d*.6,x[3]];
      for(let i=0;i<(r||2);i++){ put({s:{...a.s,i:cv(a.s.i,30),r:cv(a.s.r,30)},hold:.12}); put({s:{...a.s,m:cv(a.s.m,30),k:cv(a.s.k,30)},hold:.12}); } put({s:a.s,hold:.12}); }
    else if(op.startsWith('o:')){ const [x,y]=op.slice(2).split('.'); if(par(x,y)) throw `turn ${x}/${y}`; put({f:dir(x),n:dir(y),hold:.26}); }
    else if(LOC[lc]||BASEC.has(lc)) put({c:place(lc,lp,a.f,a.n,a.s),hold:.28});
    else throw `bad move "${t}"`;
    if(to){ if(!HS[to]) throw `bad shape "${to}"`; cur={...cur,s:HS[to]}; K[K.length-1]=cur; }
  }
  K[K.length-1]={...cur,hold:cur.hold+.2};
  const c0=K[0].c, L=two==='2'?K.map(k=>L_(mx(k.c),mx(k.f),mx(k.n),k.s))
    :two==='2a'?K.map(k=>L_(mx(sub(c0,sub(k.c,c0))),mx(k.f),mx(k.n),k.s)):base?K.map(()=>base):null;
  return K.map((k,j)=>[R_(k.c,k.f,k.n,k.s),L?L[j]:0,k.hold]);
}
const LEXM={}; for(const ln of LEX.split('\n')){ const t=ln.trim(); if(!t||t[0]==='#') continue;
  const [names,spec]=t.split('='); for(const nm of names.split(',')) LEXM[nm.trim()]=spec.trim(); }
const GLOSS={HI:'HELLO',HEY:'HELLO',THANKS:'THANK YOU',THANKYOU:'THANK YOU',THX:'THANK YOU',ILOVEYOU:'I LOVE YOU',
  QUICK:'FAST',QUICKLY:'FAST',GOODBYE:'BYE','GOOD BYE':'BYE',MINE:'MY',FOOD:'EAT',ATE:'EAT',BREAKFAST:'EAT',LUNCH:'EAT',
  DINNER:'EAT',DRANK:'DRINK',LOVED:'LOVE',LUV:'LOVE',SIGNING:'SIGN',FINISHED:'FINISH',DONE:'FINISH',ALREADY:'FINISH',
  YEAH:'YES',YEP:'YES',YUP:'YES',NOPE:'NO',NAH:'NO',PLS:'PLEASE',PLZ:'PLEASE',U:'YOU',UR:'YOUR',YOURE:'YOU',IM:'I',
  IVE:'I',THEYRE:'THEY',GREAT:'GOOD',AWESOME:'GOOD',GLAD:'HAPPY',UPSET:'SAD',WENT:'GO',GONE:'GO',WANNA:'WANT',
  GONNA:'WILL',UNDERSTOOD:'UNDERSTAND',MET:'MEET'};
const SKIP=new Set(['THE','A','AN','IS','ARE','AM','BE','TO','OF','WAS','WERE','BEEN']);   // ASL drops articles and the copula
const MULTI=[...Object.keys(SIGNS),...Object.keys(LEXM),...Object.keys(GLOSS)].filter(k=>k.includes(' ')).sort((a,b)=>b.length-a.length);
const JOYW=new Set(['HELLO','THANK YOU','GOOD','I LOVE YOU','LOVE','HAPPY','LIKE','FRIEND','PEACE','BYE','NICE','MEET','FAMILY',
  'WELCOME','SMILE','LAUGH','FUNNY','ENJOY','PARTY','CELEBRATE','KISS','HUG','BEAUTIFUL','WONDERFUL','FRIENDLY','EXCITED','CUTE']);
// word -> sign key: as typed, then simple English endings (dogs, babies, walked, running); LEX lines compile on first use
const stems=w=>[w,...(w.length<4?[]:[w.replace(/IES$/,'Y'),w.replace(/ES$/,''),w.replace(/S$/,'')]),
  ...(w.length<5?[]:[w.replace(/IED$/,'Y'),w.replace(/(.)\1(ED|ING)$/,'$1'),w.replace(/(ED|ING)$/,'E'),w.replace(/(ED|ING)$/,'')])];
function signOf(w){ for(const x of stems(w)){ const g=GLOSS[x]||x; if(SIGNS[g]) return g;
  if(LEXM[g]) try{ return SIGNS[g]=compile(LEXM[g]), g; }catch(e){ console.warn(g,e); } } }

// hand orientation (finger dir + palm normal) is eased as a rotation (quaternion slerp): lerping the two vectors
// separately can pass the palm normal through the finger axis, and the hand then flips over in one frame
const qFrom=(f,n)=>{ const Y=norm(f), Z=norm(mul(sub(n,mul(Y,dot(n,Y))),-1)), X=cross(Y,Z), tr=X[0]+Y[1]+Z[2];
  if(tr>0){const s=Math.sqrt(tr+1)*2; return [.25*s,(Y[2]-Z[1])/s,(Z[0]-X[2])/s,(X[1]-Y[0])/s];}
  if(X[0]>Y[1]&&X[0]>Z[2]){const s=Math.sqrt(1+X[0]-Y[1]-Z[2])*2; return [(Y[2]-Z[1])/s,.25*s,(Y[0]+X[1])/s,(Z[0]+X[2])/s];}
  if(Y[1]>Z[2]){const s=Math.sqrt(1+Y[1]-X[0]-Z[2])*2; return [(Z[0]-X[2])/s,(Y[0]+X[1])/s,.25*s,(Z[1]+Y[2])/s];}
  const s=Math.sqrt(1+Z[2]-X[0]-Y[1])*2; return [(X[1]-Y[0])/s,(Z[0]+X[2])/s,(Z[1]+Y[2])/s,.25*s]; };
const qRot=(q,v)=>{ const u=q.slice(1), c=cross(u,v); return add(v,add(mul(c,2*q[0]),mul(cross(u,c),2))); };
function slerp(a,b,u){ let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]; if(d<0){b=b.map(x=>-x);d=-d;}
  if(d>.9995){const r=a.map((x,i)=>x+(b[i]-x)*u), m=Math.hypot(...r); return r.map(x=>x/m);}
  const th=Math.acos(d), sa=Math.sin((1-u)*th)/Math.sin(th), sb=Math.sin(u*th)/Math.sin(th); return a.map((x,i)=>x*sa+b[i]*sb); }

// ---------------------------------------------------------------- spring dynamics (2nd-order, overshoot + follow-through)
const coef=(f,z,r)=>({k1:z/(Math.PI*f),k2:1/((2*Math.PI*f)**2),k3:r*z/(2*Math.PI*f)});

export { D, add, sub, mul, dot, cross, len, norm, rot, HN, buildHand, bound, CAM, FACE, NEUTRAL, RREST, L_LOW,
  ASL, HS, SIGNS, LEXM, GLOSS, SKIP, MULTI, JOYW, signOf, compile, qFrom, qRot, slerp, coef };
