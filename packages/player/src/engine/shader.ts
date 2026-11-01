// Moved unchanged from the handAnimation prototype (index.html). Hand-tuned: change with care and check
// poses visually. See packages/player/README.md.
// WebGL2 fragment shader: sphere-traced SDF hands, forearms and the painted avatar + backdrop.
export const FS = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uCam, uCR, uCU, uCF;
uniform vec3 uFace, uExpr;   // figure centre (world, camera-facing plane); expression: x = joy (smile), y = eye openness
uniform float uAv;          // avatar: 0 deco portrait, 1 hanfu, 2 crimson hijab
uniform vec4 uSeg[60];     // 2 hands x 5 fingers x 3 segs x (a,ra)(b,rb)
uniform vec4 uBnd[12];     // per hand: hand sphere + 5 finger spheres
uniform mat3 uHR[2]; uniform vec3 uHP[2];
uniform vec3 uTL[2];       // thumb bend axis per hand (sign-fixed so cross(uTL, bone) = dorsal on both hands)
uniform vec4 uArm[4];       // forearm cone per hand (wrist,r)(elbow,r)

float hash12(vec2 p){vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float smax(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return max(a,b)+h*h*k*.25;}
float cone(vec3 p,vec3 a,vec3 b,float ra,float rb){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}
float rbox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}

// palm + wrist, in hand-local space (right-hand layout, thumb on -x, fingers +y, back of hand +z)
// metacarpal heads: low flattened ellipsoids on the palm's dorsal-distal edge, so a flat hand shows faint
// bumps and a fist shows a soft ridge of knuckles with grooves between (under FING knuckles)
const vec4 KN[4]=vec4[4](vec4(-2.2,8.6,.85,.68),vec4(-.68,9.05,.87,.7),vec4(.86,8.7,.85,.66),vec4(2.3,7.9,.77,.6));
float ell(vec3 p,vec3 r){float k0=length(p/r);return k0*(k0-1.)/length(p/(r*r));}
float palm(vec3 q){
  vec3 b=q-vec3(0.,4.6,0.);
  b.x*=mix(1.22,1.,clamp(q.y/7.5,0.,1.));
  float d=rbox(b,vec3(2.3,3.3,.3),.95)/1.22;
  // pads are skipped (exactly: smin is a no-op) when their bounding sphere is beyond the blend range
  vec3 e=q-vec3(-1.3,2.7,-.62);
  if(length(e)-2.<d+1.2) d=smin(d,ell(e,vec3(1.3,2.,.92)),1.2);   // thenar pad (fleshy thumb base)
  if(length(q-vec3(0,7.8,.6))-3.1<d+.55){
    float kb=1e5; for(int i=0;i<4;i++) kb=min(kb,ell(q-KN[i].xyz,KN[i].w*vec3(.95,.85,.66)));
    d=smin(d,kb,.45);                                              // soft dorsal knuckle bumps
  }
  vec3 w=q; w.z*=1.3;
  return smin(d,cone(w,vec3(0,-.8,0),vec3(0,1.6,0),1.72,1.85)/1.3,1.6);
}
float arm(vec3 p,int h){return cone(p,uArm[h*2].xyz,uArm[h*2+1].xyz,uArm[h*2].w,uArm[h*2+1].w);}
vec3 toLocal(vec3 p,int h){vec3 q=transpose(uHR[h])*(p-uHP[h]);q.x*=h==0?1.:-1.;return q;}

// one phalanx in its bone frame (q = p - start joint, u = unit bone, lat = the finger's bend axis).
// Section = asymmetric ellipse: dorsal side flatter, palmar side full; iq's ellipsoid bound keeps it a valid-ish
// distance. Shafts are plain tapered tubes (a waist made the joints read knobbly); the distal
// one (tip=1) flattens dorsally toward the nail and gets a palmar pad, both settled by 70% of its length so the tip
// itself is a plain round cone. Returns (round-capped, open tube) distances.
vec2 phal(vec3 q,vec3 u,float L,vec3 lat,float ra,float rb,float tip){
  float x=dot(q,u);
  vec3 D=cross(lat,u); float y=dot(q,D)*inversesqrt(dot(D,D)+1e-8);
  float qq=dot(q,q), z2=max(qq-x*x-y*y,0.), sl=(ra-rb)/L;
  // project along the taper's side normal (round cone): end caps are tangent to the shaft, so a tapered tip stays
  // convex and shows no ring where the cap starts (the plain clamp left a kink there that read as a ball on a stick)
  float hc=clamp((x-sl*sqrt(max(qq-x*x,0.)/(1.-sl*sl)))/L,0.,1.), ex=x-L*hc, eo=x>L*.5?ex*tip:0.;
  float r=mix(ra,rb,hc), e=tip*smoothstep(0.,.7,hc);
  float E=y>0.?1.15+.4*e:1.-.08*e;
  float y1=y*E, y2=y1*E, s=z2+y1*y1, t=z2+y2*y2;
  float A=sqrt(s+ex*ex), B=sqrt(t+ex*ex), Ao=sqrt(s+eo*eo), Bo=sqrt(t+eo*eo);
  return vec2((A-r)*A/max(B,1e-6),(Ao-r)*Ao/max(Bo,1e-6));
}

float map(vec3 p){
  float d=1e5;
  for(int h=0;h<2;h++){
    vec4 hb=uBnd[h*6];
    float db=length(p-hb.xyz)-hb.w;
    float da=arm(p,h);   // forearm is long (runs off-screen), so it sits outside the hand's culling sphere
    if(db>2.5){d=min(d,min(db,da));continue;}
    float dp=smin(palm(toLocal(p,h)),da,1.4), dh=dp;
    for(int f=0;f<5;f++){
      vec4 fb=uBnd[h*6+1+f];
      if(length(p-fb.xyz)-fb.w>dh+1.6)continue;
      int i=(h*15+f*3)*2;
      vec3 J0=uSeg[i].xyz,J1=uSeg[i+2].xyz,J2=uSeg[i+4].xyz,J3=uSeg[i+5].xyz;
      // plain capsule chain first: the detailed finger stays within it + .25, so away from the surface it is
      // enough on its own and the detailed shape is only paid for close up (mixed in over a band: continuous)
      float ca=cone(p,J0,J1,uSeg[i].w,uSeg[i+1].w), cb=cone(p,J1,J2,uSeg[i+2].w,uSeg[i+3].w), cc=cone(p,J2,J3,uSeg[i+4].w,uSeg[i+5].w);
      float df=min(ca,min(cb,cc))-.25;
      if(df<1.){
        // joints: each phalanx = half round capsule end, half open tube mitred at the bisector plane, so a bent
        // joint gets a soft angular knuckle outside and a crease inside, and a straight one stays a smooth tube
        vec3 u0=J1-J0,u1=J2-J1,u2=J3-J2;
        float L0=length(u0),L1=length(u1),L2=length(u2); u0/=L0; u1/=L1; u2/=L2;
        vec3 lat=f==0?uTL[h]:uHR[h][0], n1=normalize(u0+u1), n2=normalize(u1+u2);
        float s1=dot(p-J1,n1), s2=dot(p-J2,n2);
        vec2 a=phal(p-J0,u0,L0,lat,uSeg[i].w,uSeg[i+1].w,0.);
        vec2 b=phal(p-J1,u1,L1,lat,uSeg[i+2].w,uSeg[i+3].w,0.);
        vec2 c=phal(p-J2,u2,L2,lat,uSeg[i+4].w,uSeg[i+5].w*.88,1.);
        // mitre clips are smooth (smax K) and the halves re-joined with smin M*K: on a straight finger the two
        // cancel exactly (seamless tube); on a bent one the knuckle corner is rounded by ~K. The mitre share M
        // shrinks past ~90 deg so the knuckle never pokes out more than ~1.1r (no wedges at sharp curls)
        const float K=.6;
        // bent joints fall back to the round-capped tube: a smooth arc over the knuckle, like a real finger (the mitre
        // ridge read as a hard pipe elbow); near-straight joints keep the mitre, which cancels the seam exactly
        float c1=dot(n1,u0), c2=dot(n2,u1), M1=min(.5,.12*c1/(1.-c1+1e-4))*smoothstep(.9,.99,c1), M2=min(.5,.12*c2/(1.-c2+1e-4))*smoothstep(.9,.99,c2);
        float Mb=dot(p-J1,u1)<L1*.5?M1:M2;   // shafts' middles are plain tubes, so the switch is seamless
        float dd=smin(mix(a.x,smax(max(a.y,-dot(p-J0,u0)),s1,K),M1),mix(b.x,smax(smax(b.y,-s1,K),s2,K),Mb),M1*K+.15*(1.-dot(u0,u1)));
        dd=smin(dd,mix(c.x,smax(c.y,-s2,K),M2),M2*K+.15*(1.-dot(u1,u2)));
        df=mix(dd,df,smoothstep(.5,1.,df));
      }
      // palm webbing only around the knuckle phalanx: curled tips resting on the palm stay separate shapes
      float kp=mix(.15,f==0?1.4:.85,smoothstep(-1.,1.,min(cb,cc)-ca));
      dh=min(dh,smin(dp,df,kp));
    }
    d=smin(d,dh,.04);   // hair-thin fillet where the hands press together: fingers of the two hands stay separate
  }
  return d;
}

// gradient palettes: A = forearm -> palm -> fingers -> tip, B = thumb (sampled from the reference)
// per avatar, drawn from her illustration (stops: far forearm, wrist, heel, palm/fingers, finger tone, tip)
vec3 pal6(float t,vec3 a,vec3 b,vec3 c,vec3 d,vec3 e,vec3 f){
  vec3 x=mix(a,b,smoothstep(.0,.3,t)); x=mix(x,c,smoothstep(.31,.42,t)); x=mix(x,d,smoothstep(.42,.6,t));
  x=mix(x,e,smoothstep(.6,.8,t)); return mix(x,f,smoothstep(.76,1.,t)); }
vec3 palA(float t){
  return uAv<.5?pal6(t,vec3(.93,.92,.92),vec3(.97,.86,.8),vec3(.95,.68,.59),vec3(.87,.71,.74),vec3(.79,.73,.83),vec3(.96,.94,.95))  // deco: milky peach -> coral -> grey-lilac
    :uAv<1.5?pal6(t,vec3(.86,.9,.97),vec3(.98,.93,.93),vec3(.97,.8,.83),vec3(.88,.82,.94),vec3(.78,.85,.96),vec3(.97,.97,1.))      // hanfu: sky sleeve, porcelain, lilac, pale-blue tips
    :pal6(t,vec3(.58,.08,.2),vec3(.84,.59,.47),vec3(.78,.47,.39),vec3(.75,.51,.42),vec3(.7,.45,.38),vec3(.76,.44,.38));          // hijabi: crimson sleeve, warm skin
}
vec3 palB(float t){   // thumb
  vec3 a=uAv<.5?vec3(.95,.68,.59):uAv<1.5?vec3(.97,.82,.85):vec3(.78,.47,.39), b=uAv<.5?vec3(.97,.81,.74):uAv<1.5?vec3(.9,.86,.96):vec3(.8,.54,.45),
       c=uAv<.5?vec3(.97,.93,.91):uAv<1.5?vec3(.97,.97,1.):vec3(.76,.45,.39);
  return mix(mix(a,b,smoothstep(.45,.75,t)),c,smoothstep(.75,1.,t));
}
vec3 matColor(vec3 p){
  vec3 acc=vec3(0); float ws=1e-4;
  for(int h=0;h<2;h++){
    vec3 q=toLocal(p,h);
    float tp=.28+.32*clamp(q.y/8.5,0.,1.);
    float w=exp(-max(palm(q),0.)*5.); acc+=w*palA(tp); ws+=w;
    vec3 a=uArm[h*2].xyz,ba=uArm[h*2+1].xyz-a;
    float ha=clamp(dot(p-a,ba)/dot(ba,ba),0.,1.);
    w=exp(-max(arm(p,h),0.)*5.); acc+=w*palA(.28-.28*smoothstep(0.,.15,ha)); ws+=w;
    for(int f=0;f<5;f++){
      int i0=(h*15+f*3)*2;
      float tot=uSeg[i0+5].w;                       // gradient runs by arc length, tip cap included
      for(int s=0;s<3;s++)tot+=length(uSeg[i0+s*2+1].xyz-uSeg[i0+s*2].xyz);
      float run=0.;
      for(int s=0;s<3;s++){
        int i=i0+s*2; vec3 a=uSeg[i].xyz,b=uSeg[i+1].xyz,pa=p-a,ba=b-a;
        float ls=length(ba), x=dot(pa,ba)/ls, hh=clamp(x/ls,0.,1.);
        float d=length(pa-ba*hh)-mix(uSeg[i].w,uSeg[i+1].w,hh);
        float t=(run+clamp(x,0.,s==2?ls+uSeg[i+1].w:ls))/tot; run+=ls;
        w=exp(-max(d,0.)*5.);
        vec3 col=f==0?palB(.45+.55*t):palA(.6+.4*t);
        if(s>0){
          vec3 D=normalize(cross(f==0?uTL[h]:uHR[h][0],ba)), v=pa-ba*hh;
          float cs=dot(v,D)/(length(v)+1e-4);                           // +1 dorsal .. -1 palmar
          col*=1.-.07*exp(-x*x*20.)*smoothstep(-.2,-.6,cs);                // soft palmar crease at PIP / DIP
          if(s==2) col=mix(col,uAv<.5?vec3(.98,.86,.89):uAv<1.5?vec3(1.,.92,.95):vec3(.72,.1,.18),(uAv>1.5?.75:.35)*smoothstep(.72,.9,cs)*smoothstep(.3,.5,hh));   // nail (hijabi: red polish)
        }
        acc+=w*col; ws+=w;
      }
    }
  }
  return acc/ws;
}
vec3 nor(vec3 p){const vec2 k=vec2(1,-1);const float e=.04;
  return normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));}
float ao(vec3 p,vec3 n){float o=0.,s=1.;for(int i=0;i<5;i++){float h=.12+.55*float(i);o+=(h-map(p+n*h))*s;s*=.72;}return clamp(1.-o*.3,.35,1.);}

vec3 shade(vec3 p,vec3 rd){
  vec3 n=nor(p), base=matColor(p);
  float oc=ao(p,n);
  vec3 L=normalize(vec3(-.45,.75,.5));
  float dif=smoothstep(0.,1.,dot(n,L)*.5+.5);          // very soft wrap light
  // gentle tinted darkening: a small power lift keeps shade from going grey, low-chroma mauve tints do the rest
  float sh=(1.-oc)*.8+(1.-dif)*.42;
  vec3 c=pow(base,vec3(1.+.55*sh));
  vec3 st=uAv<.5?vec3(.85,.81,.88):uAv<1.5?vec3(.86,.87,.97):vec3(.8,.64,.64);                 // shadow tint per avatar
  c*=mix(st,vec3(1.02,1.01,1.01),dif)*mix(st+.02,vec3(1),oc);
  c=mix(c,vec3(1.,.97,.97),.12*dif*dif*oc);            // airbrushed sheen on the lit side
  return c;
}

// forearms dissolve into the background a little past the wrist, so no end cap shows from any orbit angle
float armFade(vec3 p){
  float f=1.;
  for(int h=0;h<2;h++){
    vec3 a=uArm[h*2].xyz, ax=normalize(uArm[h*2+1].xyz-a);
    if(arm(p,h)<.4) f=min(f,1.-smoothstep(12.,22.,dot(p-a,ax)));
  }
  return f;
}

// ---- figure: airbrushed illustration on a camera-facing plane behind the hands (units = cm, y up)
float curve(vec2 p,vec2 c,float w,float k){   // parabola y=k*x^2 over |x|<=w: distance (approx, fine for thin strokes)
  p-=c; float x=clamp(p.x,-w,w); return abs(p.x)>w?length(p-vec2(x,k*x*x)):abs(p.y-k*x*x)/sqrt(1.+4.*k*k*x*x); }
float line2(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
float spray(float a,float n){return clamp(a+(n-.5)*1.3*a*(1.-a),0.,1.);}   // airbrush stipple on soft edges
float cap2(vec2 p,vec2 a,vec2 b,float ra,float rb){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}
float ink(float d,float w){return 1.-smoothstep(w,w+.08,d);}                // stroke coverage, half-width w
const vec3 GOLD=vec3(.93,.78,.5), SKL=vec3(.97,.85,.8), SKM=vec3(.9,.68,.7), SKD=vec3(.4,.27,.46);
// figure behind the hands (user refs: blue veiled figure, then a warm art-deco portrait; asked for friendly): sun-disc
// halo, sleek hair cap, gold headpiece + forehead gem, smiling closed eyes with winged liner, coral lips, pearl +
// teardrop earrings, long neck with a graphic diagonal shadow, fan collar with a soft rainbow sheen, sprayed grain.
// Painted over the bg colour on a camera-facing plane (cm, y up); uExpr.x = THANK YOU (smile widens, gem brightens)
vec3 face(vec2 p,vec3 col){
  float n=hash12(floor(gl_FragCoord.xy)), sm=uExpr.x, ax=abs(p.x);
  float r=length(p-vec2(0,2));
  col=mix(col,vec3(.25,.15,.22),.8*exp(-r*r/800.));                                    // dusky plum aura -> charcoal
  col=mix(col,mix(vec3(.93,.62,.6),vec3(.93,.5,.38),smoothstep(-8.,12.,p.y)),
      spray(.92*(1.-smoothstep(12.8,14.3,r))*mix(1.,.3,smoothstep(6.,-12.,p.y)),n));     // sun disc, fading low down
  // neck + sloped shoulders: skin above the collar, cloth below (violet in shade -> rose -> warm yellow in the light)
  float s=max(-13.-p.y,0.), bw=2.55+.06*max(-6.-p.y,0.)+14.*(1.-exp(-s*.35))+.4*s, bf=.2+.06*s;   // slim neck, soft shoulders
  float body=p.y>-2.?0.:spray(1.-smoothstep(-bf,bf,ax-bw),n)*smoothstep(-36.,-22.,p.y);
  float shd=smoothstep(-.1,.1,dot(p-vec2(-3.5,-7.),vec2(.79,.61)));                     // 0 = in the diagonal neck shadow
  vec3 cloth=mix(mix(vec3(.45,.38,.72),vec3(.88,.58,.66),smoothstep(-14.,2.,p.x)),vec3(.96,.84,.62),smoothstep(2.,16.,p.x));
  float rc=length(p-vec2(0,-10.5)), sk=max(1.-smoothstep(4.8,5.,rc),smoothstep(-12.6,-12.,p.y));
  col=mix(col,mix(cloth,mix(SKD,mix(SKM,SKL,smoothstep(-2.,3.,p.x)),shd),sk),body);
  float ca=atan(p.x,-p.y-10.5), af=body*(1.-smoothstep(1.25,1.45,abs(ca)));             // fan collar
  col=mix(col,(.8+.16*cos(6.283*(ca*.3+vec3(.1,.43,.77))))*mix(.6,1.,shd),.85*af*smoothstep(4.95,5.05,rc)*(1.-smoothstep(8.55,8.65,rc)));
  float st=rc<6.8?.2:.1, cg=min(min(abs(rc-5.),abs(rc-6.8)),min(abs(rc-8.6),rc*abs(ca-st*round(ca/st))));
  col=mix(col,GOLD,af*smoothstep(4.8,4.88,rc)*(1.-smoothstep(8.72,8.8,rc))*ink(cg,.035));
  vec2 q=p-vec2(0,1), h=q; h.x*=mix(1.,1.32,smoothstep(2.,-10.,h.y));                  // egg: jaw narrows to the chin
  float eg=(length(h/vec2(7.3,10.6))-1.)*7.3, hd=1.-smoothstep(-.1,.1,eg);
  col=mix(col,SKD,.65*body*sk*smoothstep(-3.,-6.,p.y)*smoothstep(0.,.3,eg)*(1.-smoothstep(.3,2.5,eg)));   // chin's shadow on the neck
  vec2 ea=vec2(ax,p.y)-vec2(7.1,.5);                                                     // ears
  col=mix(col,mix(SKD,SKM,p.x>0.?.9:.5),1.-smoothstep(-.05,.1,(length(ea/vec2(.95,1.9))-1.)*.95));
  float lt=smoothstep(7.5,0.,p.y)*mix(.7,1.,smoothstep(-6.,4.,p.x));                     // lit from below, left a touch darker
  vec3 skin=mix(SKD,mix(SKM,SKL,smoothstep(.45,1.,lt)),smoothstep(0.,.5,lt));
  float hm=smoothstep(.98,1.04,length((p-vec2(0,1.8))/vec2(6.4,5.3)))*smoothstep(1.,2.6,p.y);    // sleek hair cap, tapers at the temples
  vec3 hair=mix(vec3(.17,.12,.25),vec3(.44,.32,.55),exp(-(p.x-2.8)*(p.x-2.8)/4.)*smoothstep(3.,9.,p.y));
  col=mix(col,mix(skin,hair,hm),spray(1.-smoothstep(-.12,.2,eg),n));
  for(int i=0;i<2;i++){ float sx=i==0?-1.:1.; vec2 m=vec2(p.x*sx,p.y)-vec2(3.,1.3);
    vec2 es=(m-vec2(.1,.6))/vec2(1.8,.8); col=mix(col,vec3(.68,.52,.76),.35*hd*exp(-dot(es,es)*2.));   // lilac eyeshadow
    vec2 ck=(m-vec2(.5,-2.2))/vec2(1.6,1.); col=mix(col,vec3(.93,.55,.6),spray(.3*exp(-dot(ck,ck)*1.5),n));   // rosy cheeks
    // open almond eye: lower lid a touch lifted (friendly), outer corner tilts up; uExpr.y = openness (blink)
    float ex=m.x/1.35, ew=max(1.-ex*ex,0.), yl=-.3*ew+.06*m.x+.06*sm*ew, yu=mix(yl,.5*ew+.1*m.x,uExpr.y);
    float shade=smoothstep(.28,0.,yu-m.y), id=length(m);
    vec3 ec=mix(vec3(.96,.93,.93),vec3(.76,.68,.78),.55*shade);                                // sclera, shadowed under the lid
    ec=mix(ec,mix(vec3(.36,.2,.21),vec3(.64,.43,.33),smoothstep(.3,-.4,m.y))*mix(1.,.65,shade),1.-smoothstep(.47,.52,id));   // warm iris
    ec=mix(ec,vec3(.12,.07,.1),1.-smoothstep(.18,.22,id));                                     // pupil
    vec2 hl=m-vec2(-.16,.17); ec=mix(ec,vec3(1),max(1.-smoothstep(.07,.1,length(hl)),1.-smoothstep(.03,.05,length(m-vec2(.15,-.14)))));   // catchlights
    col=mix(col,ec,step(abs(ex),1.)*smoothstep(0.,.04,min(yu-m.y,m.y-yl)));
    col=mix(col,SKD,.35*step(abs(ex),1.)*ink(abs(m.y-yl),.012));                               // lower lid
    float d=min(abs(ex)<1.?abs(m.y-yu):1e5,cap2(m,vec2(1.3,yu+.02),vec2(1.95,.5*uExpr.y+.1),.06,.01));   // upper lid liner + wing
    col=mix(col,vec3(.2,.11,.2),.9*ink(d,.025+.05*smoothstep(-1.35,1.35,m.x)));
    vec2 b=m-vec2(.2,3.+.3*sm);
    col=mix(col,vec3(.3,.18,.3),.8*ink(curve(b,vec2(0),1.8,-.13),.02+.04*smoothstep(1.8,-1.,b.x)));   // thin arched brows
  }
  float nt=clamp((1.2-p.y)/3.9,0.,1.);                                                   // graphic nose shadow + tip
  col=mix(col,SKD,.4*smoothstep(-.04,.04,p.x+.15+.7*nt)*(1.-smoothstep(-.04,.04,p.x-.05))*smoothstep(-2.75,-2.6,p.y)*(1.-smoothstep(1.,1.2,p.y)));
  col=mix(col,vec3(.45,.25,.35),.6*ink(curve(p,vec2(.05,-2.85),.55,.35),.025));
  float u=ax/1.6, lift=(.22+.15*sm)*u*u, k=(.27+.15*sm)/2.56;                            // smiling coral lips
  float up=-5.25+.45*(1.-u*u)+.1*exp(-(u-.35)*(u-.35)/.03)-.12*exp(-u*u/.02)+lift, lo=-5.95+.7*u*u+lift;
  vec3 lc=p.y>-5.3+k*p.x*p.x?vec3(.72,.3,.37):vec3(.85,.43,.46);
  vec2 lg=(p-vec2(.3,-5.72))/vec2(.55,.14); lc=mix(lc,vec3(.97,.72,.72),.5*exp(-dot(lg,lg)));
  col=mix(col,lc,.92*step(u,1.)*smoothstep(0.,.07,min(up-p.y,p.y-lo)));
  col=mix(col,vec3(.42,.14,.22),.6*ink(curve(p,vec2(0,-5.3),1.6,k),.02));
  vec2 cn=p-vec2(0,-8.3); col=mix(col,SKL,.25*exp(-dot(cn,cn)/1.4));                     // chin highlight + crease
  col=mix(col,SKD,.25*ink(curve(p,vec2(0,-6.85),.6,.4),.02));
  float mr=length(p-vec2(0,7.4));                                                        // headpiece: band, line, medallion
  float hb=min(p.y>1.8?abs(length((p-vec2(0,1.8))/vec2(6.15,5.6))-1.)*5.8:1e5,min(line2(p,vec2(0,8.25),vec2(0,11.7)),abs(mr-.85)-.03));
  col=mix(col,vec3(.4,.24,.38),hd*(1.-smoothstep(.8,.85,mr)));
  col=mix(col,GOLD,hd*max(ink(hb,.04),ink(mr-.22,0.)));
  vec2 g=p-vec2(0,5.4); float gd=max(length(g-vec2(.35,0)),length(g+vec2(.35,0)))-.55; // forehead gem (vesica), breathing glow
  float gw=(.85+.1*sin(uTime*.9))*(1.+.4*sm);
  col+=vec3(.9,.45,.35)*.3*gw*exp(-max(gd,0.)*1.1)*hd;
  col=mix(col,mix(vec3(.85,.3,.36),vec3(1.,.78,.72),smoothstep(-.3,.4,g.y)),1.-smoothstep(-.03,.05,gd));
  col=mix(col,GOLD,ink(abs(gd),.02));
  vec2 e=vec2(ax,p.y)-vec2(7.25,0);                                                      // pearl + teardrop earrings
  vec3 dc=p.x<0.?mix(vec3(.5,.55,.88),vec3(.8,.72,.95),smoothstep(-2.,-7.,e.y)):mix(vec3(.98,.88,.62),vec3(.97,.72,.6),smoothstep(-2.,-7.,e.y));
  col=mix(col,dc,.92*(1.-smoothstep(-.03,.06,cap2(e,vec2(0,-2.2),vec2(0,-6.6),.1,.55))));
  col=mix(col,GOLD,ink(line2(e,vec2(0,-1.6),vec2(0,-2.2)),.03));
  vec2 ph=e-vec2(.12,-1.1);
  col=mix(col,mix(vec3(.86,.84,.95),vec3(1),exp(-dot(ph,ph)*12.)),1.-smoothstep(-.03,.05,length(e-vec2(0,-1.25))-.42));
  return min(col,1.);
}

// avatar 2 (user ref: serene figure in a hanfu): misty pastel backdrop, high dark bun + hairpin, ribbon drifting
// from the bun, porcelain skin, closed eyes, rosebud lips, thin stick earrings, crossed collar, translucent drapes
vec3 face2(vec2 p,vec3 col){
  float n=hash12(floor(gl_FragCoord.xy)), sm=uExpr.x, ax=abs(p.x);
  col=mix(vec3(.94,.85,.89),vec3(.82,.88,.96),smoothstep(-30.,22.,p.y));                       // mist: pink low -> blue high
  col=mix(col,vec3(.97,.96,.98),.45*exp(-p.y*p.y/260.));
  float ry=13.-p.y, rw=.35+.07*ry;                                                              // ribbon, behind the figure
  col=mix(col,vec3(.82,.78,.92),spray(.55*(1.-smoothstep(rw-.3,rw+.3,abs(p.x-2.5-.32*ry-3.2*sin(ry*.17))))*smoothstep(-18.,-4.,p.y)*step(p.y,13.),n));
  // neck, sloped shoulders, wide drape: white -> lilac robe with blue / lilac / pink translucent panels
  float s=max(-12.5-p.y,0.), nw=2.3+.05*max(-6.-p.y,0.), bw=nw+12.*(1.-exp(-s*.32))+.6*s;
  float body=p.y>-2.?0.:(1.-smoothstep(-.3,.3+.06*s,ax-bw))*smoothstep(-42.,-26.,p.y), u=p.x+.22*(p.y+13.);
  vec3 robe=mix(vec3(.96,.96,.98),vec3(.86,.87,.95),clamp(smoothstep(-13.,-32.,p.y)+.3*smoothstep(4.,16.,ax),0.,1.));
  robe=mix(robe,vec3(.66,.77,.93),.45*smoothstep(1.,3.,u)*(1.-smoothstep(8.,10.,u)));
  robe=mix(robe,vec3(.8,.74,.92),.4*smoothstep(-10.,-8.,u)*(1.-smoothstep(-2.,0.,u)));
  robe=mix(robe,vec3(.96,.8,.86),.38*smoothstep(9.,11.,u)*(1.-smoothstep(16.,19.,u)));
  robe=mix(robe,vec3(1),.35*(1.-smoothstep(0.,.3,abs(u-3.)))+.25*(1.-smoothstep(0.,.3,abs(u+8.5))));   // fold highlights
  float vd=(p.y+18.5-2.9*ax)/3.07, cl=step(p.y,-10.5);                                          // vd > 0 above the V-neck
  vec3 neck=mix(vec3(.98,.93,.93),vec3(.87,.8,.89),.65*smoothstep(-15.,-10.,p.y));             // chin shades the neck
  vec3 bc=mix(robe,neck,step(0.,vd)*(1.-smoothstep(nw-.1,nw+.1,ax)));
  bc=mix(bc,vec3(.72,.83,.94),cl*step(vd,0.)*(1.-smoothstep(.75,.85,-vd)));                    // pale blue lapels
  bc=mix(bc,vec3(.99),cl*(1.-smoothstep(.08,.14,abs(vd))));                                    // white inner collar
  col=mix(col,bc,body);
  vec2 ea=vec2(ax,p.y)-vec2(7.,.4);                                                            // ears
  col=mix(col,vec3(.93,.84,.88),1.-smoothstep(-.05,.1,(length(ea/vec2(.85,1.7))-1.)*.85));
  vec2 q=p-vec2(0,1), h=q; h.x*=mix(1.,1.32,smoothstep(2.,-10.,h.y));
  float eg=(length(h/vec2(7.3,10.6))-1.)*7.3, hd=1.-smoothstep(-.1,.1,eg);
  col=mix(col,mix(vec3(.99,.94,.93),vec3(.9,.81,.87),.55*smoothstep(1.5,7.,p.x)),hd);         // porcelain skin, shade on the right
  float fv=hd*max(1.-smoothstep(.97,1.03,length((p-vec2(0,1.4))/vec2(6.,5.6))),1.-smoothstep(.2,.8,p.y));   // face below the hairline
  float hs=smax(smin((length((p-vec2(0,1.9))/vec2(7.55,10.2))-1.)*7.55,length(p-vec2(.3,13.6))-3.8,1.2),1.6-p.y+.3*(ax-6.),.8);   // hair + bun, tapering behind the ears
  vec3 hair=mix(vec3(.2,.22,.28),vec3(.47,.49,.57),.8*exp(-dot(p-vec2(-2.5,10.),p-vec2(-2.5,10.))/14.)+.6*exp(-dot(p-vec2(-1.,15.),p-vec2(-1.,15.))/3.));
  col=mix(col,hair,(1.-smoothstep(-.12,.15,hs))*(1.-fv));
  col=mix(col,vec3(.9,.92,.96),ink(line2(p,vec2(-3.6,15.6),vec2(4.6,12.2)),.06));               // hairpin through the bun
  for(int i=0;i<2;i++){ float sx=i==0?-1.:1.; vec2 m=vec2(p.x*sx,p.y)-vec2(3.,1.1);
    vec2 es=(m-vec2(0,.5))/vec2(1.6,.7); col=mix(col,vec3(.96,.8,.85),.35*fv*exp(-dot(es,es)*2.));
    vec2 ck=(m-vec2(.6,-2.4))/vec2(1.5,1.); col=mix(col,vec3(.98,.76,.8),(.28+.15*sm)*fv*exp(-dot(ck,ck)*1.6));
    float d=min(curve(m,vec2(0),1.35,.14),min(cap2(m,vec2(1.05,.17),vec2(1.45,-.25),.025,.008),cap2(m,vec2(.7,.08),vec2(.95,-.32),.02,.006)));
    col=mix(col,vec3(.28,.25,.32),.85*ink(d,.02+.035*smoothstep(-1.3,1.3,m.x)));             // closed eyes + outer lashes
    vec2 b=m-vec2(.1,2.6);
    col=mix(col,vec3(.42,.38,.44),.55*ink(curve(b,vec2(0),1.6,-.09),.02+.03*smoothstep(1.6,-1.,b.x)));
  }
  col=mix(col,vec3(.86,.75,.82),.18*exp(-(p.x-.7)*(p.x-.7)/.15)*smoothstep(1.,-.5,p.y)*smoothstep(-3.,-1.5,p.y));
  col=mix(col,vec3(.8,.62,.68),.5*ink(curve(p,vec2(0,-2.9),.45,.4),.02));                      // nose
  float u2=ax/1.05, lift=(.08+.12*sm)*u2*u2;                                                    // rosebud lips
  float up=-5.2+.3*(1.-u2*u2)+.06*exp(-(u2-.35)*(u2-.35)/.03)-.07*exp(-u2*u2/.02)+lift, lo=-5.75+.5*u2*u2+lift;
  col=mix(col,p.y>-5.3+lift?vec3(.9,.58,.64):vec3(.95,.69,.73),.9*step(u2,1.)*smoothstep(0.,.06,min(up-p.y,p.y-lo)));
  col=mix(col,vec3(.72,.42,.5),.55*ink(curve(p,vec2(0,-5.3),1.05,(.08+.12*sm)/1.1),.015));
  vec2 e=vec2(ax,p.y)-vec2(7.,0);                                                               // thin stick earrings
  float ed=min(line2(e,vec2(0,-1.2),vec2(0,-4.6)),length(e-vec2(0,-4.9))-.22);
  col=mix(col,vec3(.6,.62,.72),ink(ed,.07)); col=mix(col,vec3(.93,.94,.98),ink(ed,.03));
  return col;
}
// avatar 3 (user ref: crimson glitter hijab): grey-blue backdrop with a dark corner and a light beam, hard diagonal
// light from the upper right, warm skin, bold brows, sharp winged liner, sideways glance, red lips, sparkle grain
vec3 face3(vec2 p,vec3 col){
  float n=hash12(floor(gl_FragCoord.xy)), sm=uExpr.x, ax=abs(p.x), lt=smoothstep(-6.,8.,.8*p.x+.6*(p.y-2.));
  col=mix(vec3(.12,.15,.2),vec3(.5,.57,.66),smoothstep(-20.,25.,1.2*p.x+.4*p.y));
  col=mix(col,vec3(.08,.1,.14),.7*smoothstep(10.,30.,p.y-p.x));
  col+=.06*exp(-pow((.6*p.x-.8*p.y-4.)/7.,2.));
  // hijab: dome over the head, wraps the face, drapes wide over the shoulders; glitter catches the light
  float s=max(1.5-p.y,0.), sh=max(s-11.5,0.), hj=p.y>1.5?(length((p-vec2(0,1.5))/vec2(8.8,11.))-1.)*8.8
    :ax-(8.8-.25*min(s,11.5)+14.*(1.-exp(-sh*.3))+.45*sh);                                     // wraps the chin, then the shoulders
  float fold=.5+.5*sin(p.x*.55+p.y*.3+2.*sin(p.y*.17));
  vec3 fab=mix(vec3(.16,.03,.07),vec3(.78,.12,.27),lt)*(.82+.3*fold*smoothstep(-4.,-14.,p.y)+.1);
  fab+=vec3(1.,.78,.86)*(.75*step(.982,hash12(floor(gl_FragCoord.xy)*1.37+3.1))*lt*lt+.12*n*lt);
  float scarf=spray(1.-smoothstep(-.2,.3,hj),n)*smoothstep(-42.,-28.,p.y); col=mix(col,fab,scarf);
  float band=4.6-.03*p.x*p.x;                                                                   // forehead edge of the scarf
  col=mix(col,vec3(.9,.25,.4),.35*lt*scarf*(1.-smoothstep(0.,.35,abs(p.y-band-.6))));         // light on the fold above it
  vec2 fq=p-vec2(0,-2.5); fq.x*=mix(1.,1.28,smoothstep(-2.,-9.,p.y)); float fo=length(fq/vec2(5.9,7.5))-1., fa=(1.-smoothstep(-.015,.015,fo))*(1.-smoothstep(-.1,.1,p.y-band));
  float sl=smoothstep(-2.5,1.5,p.x+.35*(p.y+2.));                                              // shadow side on her left
  vec3 skin=mix(vec3(.42,.24,.22),vec3(.9,.66,.52),sl)*mix(.72,1.,smoothstep(band,band-1.4,p.y));   // scarf shades the brow
  skin=mix(skin,vec3(.98,.8,.66),.35*sl*exp(-dot(p-vec2(3.6,-2.),p-vec2(3.6,-2.))/3.));       // lit cheekbone
  skin*=1.-.12*exp(-pow((ax-3.9)/1.,2.)-pow((p.y+4.6)/1.4,2.));                                 // contour under the cheekbones
  skin*=mix(.74,1.,smoothstep(0.,-.13,fo));                                                     // the scarf's edge shades the face
  col=mix(col,skin+.06*(n-.5),fa);
  // a little hair peeks out under the scarf: soft fringe swept from her right, strands catching the light
  float hb=band-1.7+1.45*smoothstep(-5.,1.6,p.x);                                                // thick at her right, thins out
  vec3 hc=mix(vec3(.09,.05,.04),vec3(.3,.18,.13),clamp(.7*lt+.12*sin((p.y-.4*p.x)*9.),0.,1.));
  col=mix(col,hc,fa*(1.-smoothstep(band-.06,band+.06,p.y))*smoothstep(hb-.1,hb+.1,p.y)*smoothstep(-5.6,-4.4,p.x));
  col*=1.-.3*scarf*(1.-fa)*exp(-max(fo,0.)*7.)*step(p.y,-5.);                                  // soft shadow where the scarf wraps the chin
  float wf=dot(p-vec2(5.5,-9.),vec2(.783,-.622)), wy=smoothstep(-8.,-11.,p.y)*scarf*(1.-fa);    // diagonal wrap fold across the drape
  col+=vec3(.35,.06,.12)*lt*wy*(1.-smoothstep(0.,.35,abs(wf)));
  col*=1.-.28*wy*smoothstep(0.,.3,wf)*(1.-smoothstep(.3,2.8,wf));
  for(int i=0;i<2;i++){ float sx=i==0?-1.:1.; vec2 m=vec2(p.x*sx,p.y)-vec2(2.9,1.);
    float ex=m.x/1.42, ew=max(1.-ex*ex,0.), yl=-.24*ew+.05*m.x, yu=mix(yl,.4*ew+.14*m.x,uExpr.y);   // heavy-lidded almond
    vec2 ir=m-vec2(.3*sx,-.02); float id=length(ir), shade=smoothstep(.25,0.,yu-m.y);             // glancing to her left
    vec3 ec=mix(vec3(.93,.9,.88),vec3(.62,.55,.55),.6*shade);
    ec=mix(ec,mix(vec3(.2,.1,.07),vec3(.45,.26,.15),smoothstep(.3,-.3,ir.y))*mix(1.,.6,shade),1.-smoothstep(.45,.5,id));
    ec=mix(ec,vec3(.05,.03,.03),1.-smoothstep(.17,.21,id)); ec=mix(ec,vec3(1),1.-smoothstep(.05,.08,length(ir-vec2(-.12,.14))));
    col=mix(col,ec,step(abs(ex),1.)*smoothstep(0.,.04,min(yu-m.y,m.y-yl)));
    col=mix(col,vec3(.35,.2,.18),.4*step(abs(ex),1.)*ink(abs(m.y-yl),.012));
    float d=min(abs(ex)<1.?abs(m.y-yu):1e5,cap2(m,vec2(1.32,yu+.03),vec2(2.3,.36*uExpr.y+.6),.08,.01));
    col=mix(col,vec3(.05,.03,.04),.95*ink(d,.03+.06*smoothstep(-1.3,1.3,m.x)));                // bold liner + long wing
    float bd=min(cap2(m,vec2(-2.,1.45),vec2(-.2,2.1),.22,.17),cap2(m,vec2(-.2,2.1),vec2(1.5,1.7),.17,.04));
    col=mix(col,vec3(.09,.06,.06),.92*(1.-smoothstep(0.,.08,bd)));                             // strong brows
  }
  float nt=clamp((1.4-p.y)/4.,0.,1.);                                                            // nose: graphic shadow + tip
  col=mix(col,vec3(.36,.2,.19),.45*fa*smoothstep(-.05,.05,p.x+.2+.75*nt)*(1.-smoothstep(-.05,.05,p.x-.05))*smoothstep(-2.85,-2.6,p.y)*(1.-smoothstep(1.2,1.4,p.y)));
  col=mix(col,vec3(.4,.2,.18),.6*ink(curve(p,vec2(.05,-2.85),.6,.35),.025));
  float u=ax/1.75, lift=.18*sm*u*u;                                                              // bold, full red lips
  float up=-5.15+.42*(1.-u*u)+.1*exp(-(u-.35)*(u-.35)/.03)-.1*exp(-u*u/.02)+lift, lo=-5.95+.75*u*u+lift;
  vec3 lc=p.y>-5.3+lift?vec3(.62,.08,.13):vec3(.8,.17,.21); vec2 lg=(p-vec2(.4,-5.7))/vec2(.6,.15);
  col=mix(col,mix(lc,vec3(.95,.5,.5),.45*exp(-dot(lg,lg))),.95*step(u,1.)*smoothstep(0.,.06,min(up-p.y,p.y-lo)));
  col=mix(col,vec3(.3,.04,.07),.6*ink(curve(p,vec2(0,-5.3),1.75,.18*sm/3.06),.018));
  return col;
}

void main(){
  vec2 uv=(2.*gl_FragCoord.xy-uRes)/min(uRes.x,uRes.y);   // narrow canvas zooms out so the signing hand stays in frame
  vec3 ro=uCam, rd=normalize(uv.x*uCR+uv.y*uCU+3.2*uCF);
  vec3 col=vec3(.166)*(1.-.05*dot(uv,uv));
  { float tf=dot(uFace-ro,uCF)/dot(rd,uCF); vec3 fp=ro+rd*tf-uFace;               // face sits under the hands
    vec2 fq=vec2(dot(fp,uCR),dot(fp,uCU)); col=uAv<.5?face(fq,col):uAv<1.5?face2(fq,col):face3(fq,col); }

  float t=5., md=1e5, mt=0., pd=1e5, fd=1e5, ft=0.; bool hit=false;
  for(int i=0;i<128;i++){
    float d=map(ro+rd*t);
    if(d/t<md){md=d/t;mt=t;}
    if(d>pd&&md<fd){fd=md;ft=mt;}   // pulling away again: md was a graze past a nearer surface
    if(d<.0015*t){hit=true;break;}
    pd=d; t+=d*.9; if(t>130.)break;
  }
  // soft airbrushed silhouette: feather by closest angular approach
  float a=hit?1.:1.-smoothstep(.0013,.0034,md);
  if(a>0.){ vec3 sp=ro+rd*(hit?t:mt); col=mix(col,shade(sp,rd),a*armFade(sp)); }
  float af=hit?1.-smoothstep(.0013,.0034,fd):0.;    // same feather where a nearer finger overlaps a farther one
  if(af>0.){ vec3 sp=ro+rd*ft; col=mix(col,shade(sp,rd),af*armFade(sp)); }

  col+=(hash12(gl_FragCoord.xy+fract(uTime*7.)*917.)-.5)*.055;  // film grain
  O=vec4(col,1);
}`;
