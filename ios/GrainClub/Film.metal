// Grain Club film engine, ported from the web app's WebGL shader (src/engine.js).
// Coordinates follow the WebGL original: uv has its origin at the bottom left.
#include <metal_stdlib>
using namespace metal;

struct FilmU {
    float4 c1;        // source crop: scale x, scale y, offset x, offset y
    float4 res;       // width, height, grain scale, seed
    float4 misc;      // leak seed, heart samples, flash tint, unused
    float4 tone;      // exposure, temperature, tint, contrast
    float4 tone2;     // saturation, fade, mono, flash
    float4 lift;
    float4 gamma;
    float4 gain;
    float4 shT;
    float4 hiT;
    float4 monoTint;
    float4 flashCol;
    float4 m0;        // colour matrix rows
    float4 m1;
    float4 m2;
    float4 fx1;       // grain, grain size, chroma, dust
    float4 fx2;       // leak, halation, bloom, vignette
    float4 fx3;       // aberration, split, sharpen, scanlines
    float4 fx4;       // vhs, fisheye, prism, starburst
    float4 fx5;       // kaleidoscope, hearts, unused, unused
};

struct VOut {
    float4 pos [[position]];
    float2 uv;
};

vertex VOut filmVertex(uint vid [[vertex_id]]) {
    float2 p = float2(vid == 1 ? 3.0 : -1.0, vid == 2 ? 3.0 : -1.0);
    VOut o;
    o.pos = float4(p, 0.0, 1.0);
    o.uv = p * 0.5 + 0.5;
    return o;
}

static float h12(float2 p) {
    float3 q = fract(float3(p.x, p.y, p.x) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}
static float gmod1(float x, float y) { return x - y * floor(x / y); }
static float2 gmod2(float2 x, float y) { return x - y * floor(x / y); }
static float2 mir(float2 u) { return 1.0 - abs(1.0 - gmod2(u, 2.0)); }
static float vn(float2 p) {
    float2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h12(i), h12(i + float2(1.0, 0.0)), f.x), mix(h12(i + float2(0.0, 1.0)), h12(i + float2(1.0, 1.0)), f.x), f.y);
}
static float hl(float3 s) { float m = max(max(s.r, s.g), s.b); return m * smoothstep(0.86, 1.0, m); }
static float bright(float3 s, float a, float b) { return smoothstep(a, b, max(max(s.r, s.g), s.b)); }

static float3 srcT(texture2d<float> t, sampler smp, constant FilmU& u, float2 uv) {
    uv = mir(uv);
    float2 c = uv * u.c1.xy + u.c1.zw;
    return t.sample(smp, float2(c.x, 1.0 - c.y)).rgb;
}

fragment float4 filmFragment(VOut in [[stage_in]],
                             constant FilmU& u [[buffer(0)]],
                             texture2d<float> tex [[texture(0)]]) {
    constexpr sampler smp(address::clamp_to_edge, filter::linear);
    #define SRC(x) srcT(tex, smp, u, (x))

    float W = u.res.x, H = u.res.y, uPx = u.res.z, uSeed = u.res.w;
    float uLS = u.misc.x, uHN = u.misc.y, uFlashTint = u.misc.z;
    float uExp = u.tone.x, uTemp = u.tone.y, uTint = u.tone.z, uCon = u.tone.w;
    float uSat = u.tone2.x, uFade = u.tone2.y, uMono = u.tone2.z, uFlash = u.tone2.w;
    float uGrain = u.fx1.x, uGsize = u.fx1.y, uChroma = u.fx1.z, uDust = u.fx1.w;
    float uLeak = u.fx2.x, uHal = u.fx2.y, uBloom = u.fx2.z, uVig = u.fx2.w;
    float uCA = u.fx3.x, uSplit = u.fx3.y, uSharp = u.fx3.z, uScan = u.fx3.w;
    float uVhs = u.fx4.x, uFish = u.fx4.y, uPrism = u.fx4.z, uStar = u.fx4.w;
    float uKal = u.fx5.x, uHeart = u.fx5.y;

    float2 vUv = in.uv;
    float2 fc = float2(in.pos.x, H - in.pos.y);     // gl_FragCoord
    float asp = W / H;
    float2 p = vUv - 0.5; p.x *= asp;
    float rmax = length(float2(0.5 * asp, 0.5));
    float rn0 = length(p) / rmax;
    float2 st = float2(vUv.x, 1.0 - vUv.y);

    if (uKal > 1.5) {
        float a = atan2(p.y, p.x); float r = length(p); float sg = 6.2831853 / uKal;
        a = gmod1(a, sg); a = abs(a - sg * 0.5); p = r * float2(cos(a), sin(a));
    }
    float rn = length(p) / rmax;
    if (uFish > 0.0) { p *= (1.0 + uFish * rn * rn) / (1.0 + uFish); }
    float2 q = float2(p.x / asp, p.y) + 0.5;

    if (uVhs > 0.0) {
        float ln = floor(st.y * 240.0);
        q.x += (h12(float2(ln, uSeed * 91.7)) - 0.5) * 0.0028 * uVhs;
        float band = smoothstep(0.93, 1.0, st.y);
        q.x += band * (h12(float2(ln * 1.3, uSeed * 13.1)) - 0.5) * 0.07 * uVhs;
    }

    float3 c;
    if (uCA + abs(uSplit) > 0.0) {
        float2 off = (q - 0.5) * rn * uCA * 0.014 + float2(uSplit, 0.0);
        c.r = SRC(q + off).r; c.g = SRC(q).g; c.b = SRC(q - off).b;
    } else {
        c = SRC(q);
    }

    if (uVhs > 0.0) {
        float3 s3 = SRC(q + float2(0.003, 0.0)) + SRC(q - float2(0.003, 0.0)) + SRC(q + float2(0.006, 0.0));
        c = mix(c, (c + s3) * 0.25, 0.7 * uVhs);
    }
    if (uSharp > 0.0) {
        float2 px = 1.5 / float2(W, H);
        float3 a = SRC(q + float2(px.x, 0.0)) + SRC(q - float2(px.x, 0.0)) + SRC(q + float2(0.0, px.y)) + SRC(q - float2(0.0, px.y));
        c += (c - a * 0.25) * uSharp * 1.6;
    }

    if (uPrism > 0.0) {
        float m = uPrism * 0.16;
        float3 a = SRC(q + float2(m, m * 0.35));
        float3 b = SRC(q + float2(-m * 0.8, -m * 0.5));
        float3 d = SRC(float2(1.0 - q.x, q.y) + float2(0.0, m * 0.6));
        c *= 1.0 - 0.2 * uPrism;
        c = 1.0 - (1.0 - c) * (1.0 - a * float3(1.0, 0.45, 0.6) * 0.5 * uPrism) * (1.0 - b * float3(0.4, 0.7, 1.0) * 0.5 * uPrism);
        c += d * float3(0.95, 0.9, 0.5) * 0.3 * uPrism * smoothstep(0.25, 0.95, rn0);
    }

    if (uFlash > 0.0) {
        float f = exp(-rn0 * rn0 * 2.6);
        float l = dot(c, float3(0.299, 0.587, 0.114));
        float gF = 1.0 + 0.9 * f * uFlash;
        c = c * gF / (1.0 + (gF - 1.0) * 0.85 * clamp(c, 0.0, 1.0)) + 0.04 * f * uFlash;
        float3 fcol = u.flashCol.xyz;
        c = mix(c, (l * 1.5 + 0.1) * fcol + c * fcol * 0.35, 0.62 * f * uFlashTint * uFlash);
        c *= mix(1.0, 0.6, uFlash * (1.0 - f));
        c = (c - 0.5) * (1.0 + 0.14 * uFlash) + 0.5;
    }

    if (uBloom + uHal > 0.0) {
        float3 h = float3(0.0);
        float rot = h12(fc + uSeed * 71.0) * 6.2831853;
        for (int i = 0; i < 16; i++) {
            float fi = float(i) + 0.5;
            float rr = sqrt(fi / 16.0);
            float a = fi * 2.39996 + rot;
            float2 o = float2(cos(a) / asp, sin(a)) * rr * 0.024;
            float3 s = SRC(q + o);
            h += s * bright(s, 0.6, 0.95);
        }
        h /= 16.0;
        c += h * uBloom * 0.9;
        c += float3(1.0, 0.26, 0.09) * dot(h, float3(0.5, 0.4, 0.1)) * uHal * 1.5;
    }

    if (uStar > 0.0) {
        float3 sb = float3(0.0);
        float jit = h12(fc + uSeed * 13.0);
        for (int d = 0; d < 3; d++) {
            float a = float(d) * 1.0471976 + 0.5236;
            float2 dv = float2(cos(a) / asp, sin(a)) * (0.06 + 0.12 * uStar);
            for (int i = 1; i <= 12; i++) {
                float t = (float(i) - jit) / 12.0;
                float w = (1.0 - t) * (1.0 - t);
                float3 s1 = SRC(q + dv * t), s2 = SRC(q - dv * t);
                sb += (s1 * bright(s1, 0.9, 1.0) + s2 * bright(s2, 0.9, 1.0)) * w;
            }
        }
        c += sb * 0.13 * (0.4 + uStar);
    }

    if (uHeart > 0.0) {
        // heart diffraction lens: each bright light spreads along a heart outline, red outside through violet inside
        float3 hb = float3(0.0);
        float jit = h12(fc * 1.37 + uSeed * 29.0);
        float R = 0.028 + 0.05 * uHeart, stp = 6.2831853 / uHN;
        for (int i = 0; i < 96; i++) {
            if (float(i) >= uHN) break;
            float t = (float(i) + jit) * stp, s = sin(t);
            float2 k = float2(16.0 * s * s * s, 13.0 * cos(t) - 5.0 * cos(2.0 * t) - 2.0 * cos(3.0 * t) - cos(4.0 * t) + 2.5) / 17.0;
            float w = length(float2(48.0 * s * s * cos(t), -13.0 * s + 10.0 * sin(2.0 * t) + 6.0 * sin(3.0 * t) + 4.0 * sin(4.0 * t))) / 16.26;
            k.x /= asp; k *= R;
            hb += (float3(1.0, 0.1, 0.0) * hl(SRC(q - k * 1.2)) + float3(0.75, 0.9, 0.0) * hl(SRC(q - k * 1.07))
                 + float3(0.0, 0.75, 0.85) * hl(SRC(q - k * 0.94)) + float3(0.5, 0.05, 1.0) * hl(SRC(q - k * 0.81))) * w;
        }
        c += hb * (28.0 / uHN) * 0.3 * (0.45 + uHeart);
    }

    c *= pow(2.0, uExp);
    c.r *= 1.0 + 0.22 * uTemp + 0.05 * uTint; c.b *= 1.0 - 0.22 * uTemp + 0.05 * uTint; c.g *= 1.0 - 0.14 * uTint;
    float3 cm = max(c, 0.0);
    c = max(float3(dot(u.m0.xyz, cm), dot(u.m1.xyz, cm), dot(u.m2.xyz, cm)), 0.0);
    c = c * u.gain.xyz + u.lift.xyz * (1.0 - c);
    c = pow(max(c, 0.0), 1.0 / u.gamma.xyz);
    c = (c - 0.5) * uCon + 0.5;
    float l = dot(c, float3(0.299, 0.587, 0.114));
    c = mix(float3(l), c, uSat);
    c += u.shT.xyz * (1.0 - smoothstep(0.0, 0.6, l)) + u.hiT.xyz * smoothstep(0.4, 1.0, l);
    if (uMono > 0.0) { float m = dot(c, float3(0.45, 0.42, 0.13)); c = mix(c, float3(m) * u.monoTint.xyz, uMono); }
    c = mix(c, float3(0.80, 0.82, 0.86), uFade);

    if (uLeak > 0.0) {
        float s1 = h12(float2(uLS * 7.3, 1.7));
        float d = mix(st.x, 1.0 - st.x, step(0.5, s1));
        float wob = 0.5 + 0.5 * sin(st.y * (2.0 + s1 * 5.0) + uLS * 37.0);
        float k = exp(-d * d * mix(5.0, 22.0, h12(float2(uLS * 3.1, 9.2)))) * (0.45 + 0.55 * wob);
        float3 lc = mix(float3(1.0, 0.16, 0.04), float3(1.0, 0.72, 0.22), k);
        float2 cc = float2(step(0.5, h12(float2(uLS * 5.9, 4.4))), h12(float2(uLS, 2.2)) * 0.4);
        float k2 = exp(-dot(st - cc, st - cc) * 5.0) * 0.6;
        float3 lk = lc * k + float3(1.0, 0.35, 0.5) * k2;
        c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - clamp(lk * uLeak * 1.3, 0.0, 1.0));
    }

    c *= 1.0 - uVig * smoothstep(0.35, 1.05, rn0) * 0.85;
    if (uFish > 1.0) {
        float rc = length(float2((vUv.x - 0.5) * asp, vUv.y - 0.5)) / (0.5 * max(asp, 1.0));
        c *= mix(1.0, (1.0 - smoothstep(0.9, 1.03, rc)), smoothstep(1.0, 1.8, uFish));
    }

    if (uScan > 0.0) { float lines = min(240.0, H / 3.0); c *= 1.0 - uScan * 0.25 * (0.5 + 0.5 * cos(st.y * lines * 6.2831853)); }
    if (uVhs > 0.0) {
        float band = smoothstep(0.945, 1.0, st.y);
        float n = h12(float2(floor(st.x * 160.0), floor(st.y * 240.0)) + uSeed * 50.0);
        c = mix(c, float3(n), band * 0.55 * uVhs * step(0.4, n));
    }

    if (uDust > 0.0) {
        float dd = 0.0;
        for (int k = 0; k < 2; k++) {
            float fk = float(k);
            float2 g = float2(st.x * asp, st.y) * mix(13.0, 31.0, fk);
            float2 id = floor(g), f = fract(g);
            float2 o = id + uSeed * 17.0 + fk * 31.0;
            float2 pt = float2(h12(o + 3.1), h12(o + 7.7));
            float rad = mix(0.03, 0.13, h12(o + 11.3));
            dd += (1.0 - smoothstep(rad * 0.4, rad, length(f - pt))) * step(1.0 - 0.14 * uDust, h12(o));
        }
        for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float x = h12(float2(fk * 7.7 + 1.0, uLS * 29.0));
            float on = step(1.0 - 0.5 * uDust, h12(float2(fk + 2.0, uLS * 3.0)));
            float wob = sin(st.y * 20.0 + fk) * 0.0015;
            float ln = (1.0 - smoothstep(0.0, 0.0013, abs(st.x - x - wob)));
            dd += ln * on * step(0.35, h12(float2(floor(st.y * 18.0), fk + uSeed))) * 0.6;
        }
        c = mix(c, float3(0.95, 0.93, 0.88), clamp(dd, 0.0, 1.0) * 0.75);
    }

    if (uGrain + uChroma > 0.0) {
        float gs = max(1.0, uGsize * uPx * 1.5);
        float2 gp = fc / gs;
        float n = vn(gp + uSeed * 113.0) + h12(floor(gp * 2.0) + uSeed * 57.0) - 1.0;
        float l2 = clamp(dot(c, float3(0.299, 0.587, 0.114)), 0.0, 1.0);
        c += n * uGrain * 0.26 * mix(1.0, 0.45, smoothstep(0.5, 1.0, l2));
        float2 cp = floor(gp);
        c += (float3(h12(cp + uSeed * 11.0 + 1.0), h12(cp + uSeed * 23.0 + 2.0), h12(cp + uSeed * 31.0 + 3.0)) - 0.5) * uChroma * 0.16;
    }
    #undef SRC
    return float4(clamp(c, 0.0, 1.0), 1.0);
}
