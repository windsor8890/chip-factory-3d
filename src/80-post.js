((F, T) => {
  'use strict';
  const vertex = 'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const common = [
    'precision highp float; varying vec2 st; uniform sampler2D source,other;uniform vec2 size,center;uniform float amount;',
    'float luminance(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}',
    'float transition(vec3 a,vec3 b){vec2 ratio=vec2(size.x/size.y,1.);',
    'float d=length((st-center)*ratio)/length(max(center,1.-center)*ratio);',
    'float radius=mix(-.19,1.20,amount);d-=clamp(luminance(a)-luminance(b),-.6,.6)*.048;',
    'return 1.-smoothstep(radius-.15,radius+.15,d);}'
  ].join('\n');
  const grade =
    common +
    [
      'uniform sampler2D bloom,zA,zB;uniform vec3 lensA,lensB;uniform float stage,raw,quality;',
      'vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}',
      'vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}',
      'vec3 plate(sampler2D t,sampler2D depth,vec3 lens){vec3 c=texture2D(t,st).rgb;if(raw>.5||quality<.5)return c;',
      'float tilt=stage<1.95?smoothstep(.18,.53,abs(st.y-.50+(st.x-.5)*.055))*.86:0.;',
      'float dof=0.;if(stage>3.75){float z=texture2D(depth,st).x;float eye=lens.x*lens.y/(lens.y-z*(lens.y-lens.x));dof=clamp(abs(eye-lens.z)/max(eye,.001)*2.4,0.,1.);}',
      'float blur=max(tilt,dof);vec2 px=(.65+blur*2.15)/size;',
      'vec3 n=texture2D(t,st+px*vec2(1.7,.65)).rgb+texture2D(t,st-px*vec2(1.7,.65)).rgb+texture2D(t,st+px*vec2(-.65,1.7)).rgb+texture2D(t,st+px*vec2(.65,-1.7)).rgb;',
      'return mix(c,n*.25,blur*.62);}',
      'void main(){vec3 a=plate(source,zA,lensA);if(amount>0.){vec3 b=plate(other,zB,lensB);a=mix(a,b,transition(a,b));}',
      'if(raw>.5){gl_FragColor=vec4(srgb(a),1.);return;}a+=texture2D(bloom,st).rgb*(quality*.14);vec3 c=srgb(aces(a*.89));',
      'vec2 q=(st-.5)*vec2(1.,.82);c*=1.-.29*dot(q,q);',
      'float l=luminance(c);float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;',
      'c+=grain*.012*smoothstep(.075,.4,l)*(1.-smoothstep(.70,1.,l));gl_FragColor=vec4(c,1.);}'
    ].join('\n');
  const extract =
    common +
    'void main(){vec3 a=texture2D(source,st).rgb;if(amount>0.){vec3 b=texture2D(other,st).rgb;a=mix(a,b,transition(a,b));}float l=luminance(a);gl_FragColor=vec4(a*(max(l-1.13,0.)/max(l,.001)),1.);}';
  const blur =
    'precision mediump float;varying vec2 st;uniform sampler2D src;uniform vec2 axis;void main(){vec3 c=texture2D(src,st).rgb*.227027;c+=(texture2D(src,st+1.3846*axis).rgb+texture2D(src,st-1.3846*axis).rgb)*.316216;c+=(texture2D(src,st+3.2308*axis).rgb+texture2D(src,st-3.2308*axis).rgb)*.07027;gl_FragColor=vec4(c,1.);}';
  F.makePost = (r) => {
    const low = F.params.has('lq'),
      raw = F.params.has('raw'),
      hasDepth = r.capabilities.isWebGL2 || r.extensions.has('WEBGL_depth_texture');
    const type =
      r.capabilities.isWebGL2 && r.extensions.has('EXT_color_buffer_float')
        ? T.HalfFloatType
        : T.UnsignedByteType;
    function sceneTarget(w, h) {
      const rt = new T.WebGLRenderTarget(w, h, { type, depthBuffer: true });
      rt.samples = r.capabilities.isWebGL2 && !low ? Math.min(4, r.capabilities.maxSamples) : 0;
      if (hasDepth && !low) rt.depthTexture = new T.DepthTexture(w, h, T.UnsignedIntType);
      return rt;
    }
    const targets = [sceneTarget(2, 2), sceneTarget(2, 2)];
    let hasFrameSize = false;
    const glow = [0, 1].map(() => new T.WebGLRenderTarget(2, 2, { type, depthBuffer: false }));
    const u = {
      source: { value: targets[0].texture },
      other: { value: targets[1].texture },
      size: { value: new T.Vector2(2, 2) },
      center: { value: new T.Vector2(0.5, 0.5) },
      amount: { value: 0 },
      stage: { value: 0 },
      raw: { value: raw ? 1 : 0 },
      quality: { value: low ? 0 : 1 },
      bloom: { value: glow[0].texture },
      zA: { value: targets[0].depthTexture },
      zB: { value: targets[1].depthTexture },
      lensA: { value: new T.Vector3() },
      lensB: { value: new T.Vector3() }
    };
    const gauss = { src: { value: null }, axis: { value: new T.Vector2() } };
    const fx = (uniforms, fragmentShader) =>
      new T.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      });
    const finalMat = fx(u, grade),
      brightMat = fx(u, extract),
      blurMat = fx(gauss, blur);
    const sc = new T.Scene(),
      cam = new T.Camera(),
      quad = new T.Mesh(new T.PlaneGeometry(2, 2), finalMat);
    quad.frustumCulled = false;
    sc.add(quad);
    const statsPool = [
        { id: 0, calls: 0, tris: 0 },
        { id: 0, calls: 0, tris: 0 }
      ],
      details = [];
    function draw(material, target) {
      quad.material = material;
      r.setRenderTarget(target);
      r.render(sc, cam);
    }
    return {
      targets,
      resize(w, h) {
        if (hasFrameSize && u.size.value.x === w && u.size.value.y === h) return;
        r.setRenderTarget(null);
        for (let i = 0; i < targets.length; i++) {
          const old = targets[i];
          old.dispose();
          old.depthTexture?.dispose();
          old.texture.dispose();
          targets[i] = sceneTarget(w, h);
        }
        hasFrameSize = true;
        u.source.value = u.other.value = targets[0].texture;
        u.zA.value = u.zB.value = targets[0].depthTexture;
        u.size.value.set(w, h);
        glow.forEach((t) => t.setSize(Math.max(2, Math.floor(w / 5)), Math.max(2, Math.floor(h / 5))));
      },
      render(active, amount, q, cx, cy) {
        details.length = active.length;
        for (let i = 0; i < active.length; i++) {
          const s = active[i];
          r.info.reset();
          r.setRenderTarget(targets[i]);
          r.render(s.scene, s.camera);
          const d = statsPool[i];
          d.id = s.id;
          d.calls = r.info.render.calls;
          d.tris = r.info.render.triangles;
          details[i] = d;
          (i ? u.lensB : u.lensA).value.set(
            s.camera.near,
            s.camera.far,
            s.camera.userData.focusDistance
          );
        }
        // A sampler may be initialized by WebGL even when its shader branch is inactive.
        // Bind attachments from the second target only after the second scene has drawn.
        const second = targets[active.length === 2 ? 1 : 0];
        u.other.value = second.texture;
        u.zB.value = second.depthTexture;
        u.amount.value = active.length === 2 ? amount : 0;
        u.stage.value = q;
        u.center.value.set(cx, 1 - cy);
        if (!low && !raw) {
          draw(brightMat, glow[0]);
          gauss.src.value = glow[0].texture;
          gauss.axis.value.set(1 / glow[0].width, 0);
          draw(blurMat, glow[1]);
          gauss.src.value = glow[1].texture;
          gauss.axis.value.set(0, 1 / glow[0].height);
          draw(blurMat, glow[0]);
        }
        draw(finalMat, null);
        return details;
      }
    };
  };
})(F, THREE);
