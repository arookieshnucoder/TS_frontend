<script setup lang="ts">
import type { Subject } from '../config/subjects'
// 学科装饰背景仅依赖当前主题，不读取会话内容，也不参与解题。
defineProps<{ subject: Subject }>()
</script>

<template>
  <div class="atmosphere" aria-hidden="true">
    <Transition name="landscape" mode="out-in">
      <div v-if="subject === 'chinese'" key="chinese" class="ink-landscape">
        <div class="paper-grain"></div>
        <div class="ink-wash wash-one"></div><div class="ink-wash wash-two"></div>
        <svg class="mountain-scene" viewBox="0 0 1200 480" preserveAspectRatio="xMidYMax slice" fill="none">
          <defs>
            <linearGradient id="mountain-fade" x1="600" y1="30" x2="600" y2="480" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity=".17" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient>
            <linearGradient id="mountain-near" x1="600" y1="100" x2="600" y2="480" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity=".13" /><stop offset="1" stop-color="currentColor" stop-opacity=".015" /></linearGradient>
          </defs>
          <g class="mountain-far"><path d="M-40 420 30 330 65 340 137 222 158 251 211 160 241 205 269 197 334 308 385 272 432 319 480 360 532 323 588 384 633 344 689 381 748 310 805 335 847 240 880 269 926 184 963 248 1024 300 1075 257 1141 350 1240 308V480H-40Z" fill="url(#mountain-fade)" /><path d="m137 222 8 84-43 38m109-184-15 119 45-74m606 35 6 90 27-61m46-85-8 115 45-51" stroke="currentColor" stroke-opacity=".08" /></g>
          <g class="mountain-front"><path d="M-50 480V359l80 30 58-44 71 63 83-31 73 48 81-27 84 55 80-26 78 24 95-52 64 26 67-63 37 27 69-83 46 44 54-24 72 72 78-30 50 46 30-9v80Z" fill="url(#mountain-near)" /></g>
          <path class="river-line" d="M135 442c140-28 184 35 336 10s234 15 363-6 190 10 288-2" stroke="currentColor" stroke-opacity=".13" stroke-width=".7" />
          <g class="flying-birds" stroke="currentColor" stroke-width="1.2" stroke-opacity=".3"><path d="m918 126 8 3 7-6m22 16 6 3 6-4m-61 0 5 2 5-4" /></g>
        </svg>
        <span class="floating-letter letter-one">山</span><span class="floating-letter letter-two">月</span><span class="floating-letter letter-three">风</span>
        <div class="vertical-poem">且将新火试新茶<br /><span>诗酒趁年华</span></div>
        <span class="landscape-seal">知<br />墨</span>
      </div>
      <div v-else-if="subject === 'math'" key="math" class="math-landscape">
        <div class="math-grid"></div><div class="math-glow"></div>
        <svg class="geometry-scene" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none">
          <g class="coordinate-lines" stroke="currentColor" stroke-opacity=".11"><path d="M800 620h310m-265 70V325m-8 12 8-12 8 12m245 275 12 8-12 8" /><path d="M810 590c65 40 92 39 120-35s58-131 145-138" stroke-width="1.6" stroke-opacity=".5" /></g>
          <g class="geometry-orbit" stroke="currentColor"><ellipse cx="1010" cy="234" rx="105" ry="40" transform="rotate(-32 1010 234)" stroke-opacity=".15" /><ellipse cx="1010" cy="234" rx="105" ry="40" transform="rotate(32 1010 234)" stroke-opacity=".11" /><circle cx="1010" cy="234" r="4" fill="currentColor" fill-opacity=".28" stroke="none" /><circle class="orbit-point" cx="1115" cy="234" r="4" fill="currentColor" fill-opacity=".5" stroke="none" /></g>
          <g class="geometry-triangle" stroke="currentColor" stroke-opacity=".17"><path d="m69 460 122-110 41 161Z" /><path d="m69 460 102 6 20-116m-20 116 61 45" stroke-dasharray="4 6" /><circle cx="69" cy="460" r="3" fill="currentColor" /><circle cx="191" cy="350" r="3" fill="currentColor" /><circle cx="232" cy="511" r="3" fill="currentColor" /></g>
          <g stroke="currentColor" stroke-opacity=".11"><circle cx="200" cy="174" r="28" /><path d="M160 174h80m-40-40v80m-13-13 26-54" /></g>
        </svg>
        <span class="math-formula formula-one">f(x) = x²</span><span class="math-formula formula-two">a² + b² = c²</span><span class="math-formula formula-three">∞</span>
        <div class="math-coordinate">THINK / PROVE / DISCOVER<span>01 — ∞</span></div>
      </div>
      <div v-else key="english" class="language-landscape" lang="en">
        <div class="language-light"></div><div class="language-baselines"></div>
        <span class="language-glyph">Aa<span>the art of understanding</span></span>
        <div class="language-sheet sheet-back"></div>
        <div class="language-sheet sheet-front">
          <span class="sheet-eyebrow">A READER'S NOTEBOOK</span>
          <strong>Words<br />open worlds.</strong>
          <span class="sheet-definition">context <em>/ˈkɒntekst/</em></span>
          <p>The words around a word.<br />The world behind a sentence.</p>
          <span class="sheet-underlined">Read. Notice. Understand.</span>
          <span class="sheet-page">LEXICON — 01</span>
        </div>
        <svg class="language-route-scene" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none">
          <g class="reading-route" stroke="currentColor" stroke-width="1">
            <path d="M65 610c75-35 102 45 177 0s117-30 160 3" stroke-opacity=".1" stroke-dasharray="3 6" />
            <path class="reading-underline" d="M67 615c60-27 105 36 170 0" stroke-opacity=".25" stroke-linecap="round" />
            <path d="m394 608 9 5-10 3" stroke-opacity=".2" />
          </g>
          <g class="sentence-notes" fill="currentColor" font-family="Georgia, serif" font-size="12" font-style="italic"><text x="70" y="595" fill-opacity=".2">word</text><text x="209" y="647" fill-opacity=".16">context</text><text x="334" y="592" fill-opacity=".18">meaning</text></g>
          <g class="grammar-annotation" stroke="currentColor" stroke-opacity=".13"><path d="M968 149h115m-115 8h66m-66 8h94m-64-40v12h62v-12" /><path class="annotation-sweep" d="M998 173h68" stroke-width="6" stroke-opacity=".09" /></g>
        </svg>
        <span class="language-fragment fragment-one">between<br /><em>the lines.</em></span>
        <span class="language-fragment fragment-two">“</span>
        <div class="language-margin-note">LOOK CLOSER. READ DEEPER.<span>言境 · LEXICON</span></div>
      </div>
    </Transition>
  </div>
</template>
