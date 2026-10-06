// Assessment engine ported from v1: test bank, adaptive ladder, leveling,
// profile builder and Player Profile text. Pure logic + markup helpers; the
// assessment UI lives in screens/assessment.js.
import { Audio as AudioEngine } from '../core/audio.js';
import { esc, clamp, shuffle, pick, rand, today, addDays, uid } from '../core/util.js';
import { GENRE_BY_ID } from '../data/catalog.js';

const U = { esc, clamp, shuffle, pick, rand, today, addDays, uid, pct: s => Math.round(s * 100) + '%' };
const DOMAINS = [
  {key:'fretting',short:'Fretting',  name:'Fretting hand',    blurb:'Chord changes, barre chords, legato and stretches.'},
  {key:'picking',short:'Picking',   name:'Picking hand',     blurb:'Strumming, alternate picking, string crossing, sweeps.'},
  {key:'rhythm',short:'Rhythm',    name:'Rhythm & timing',  blurb:'Locking to the click, subdivisions, internal time.'},
  {key:'fretboard',short:'Fretboard', name:'Fretboard',        blurb:'Note names, interval shapes and CAGED. Auto-scored.'},
  {key:'theory',short:'Theory',    name:'Music theory',     blurb:'Scales, chord construction, harmony and modes. Auto-scored.'},
  {key:'ear',short:'Ear',       name:'Ear training',     blurb:'Pitch direction, intervals and chord qualities. Headphones help.'},
  {key:'improv',short:'Improv',    name:'Improvisation',    blurb:'Shapes from memory, phrasing and targeting chord tones over a backing loop.'},
  {key:'repertoire',short:'Repertoire',name:'Repertoire',       blurb:'Songs you can play start to finish.'}
];
const DOMAIN_BY_KEY = Object.fromEntries(DOMAINS.map(d=>[d.key,d]));

const OPT = {
  experience:[['lt6m','Less than 6 months'],['6to12m','6–12 months'],['1to2y','1–2 years'],['2to5y','2–5 years'],['5to10y','5–10 years'],['10y','10+ years']],
  learning:[['self','Self-taught'],['lessons','Lessons'],['mix','Mix of both']],
  chords:[['open_maj','Open major (C A G E D)'],['open_min','Open minor (Am Em Dm)'],['power','Power chords'],['barre_e','Barre – E shape'],['barre_a','Barre – A shape'],['dom7','Dominant 7ths'],['maj7','Maj7 / m7'],['sus','Sus & add chords'],['ext','Extended (9, 11, 13)'],['inv','Inversions / slash chords']],
  techniques:[['strum','Strumming'],['alt','Alternate picking'],['hammer','Hammer-ons / pull-offs'],['bends','Bends'],['vibrato','Vibrato'],['slides','Slides'],['palm','Palm muting'],['finger','Fingerstyle'],['hybrid','Hybrid picking'],['tapping','Tapping'],['sweep','Sweep picking']],
  theoryTopics:[['notes','Note names','Naming any note on the neck'],['intervals','Intervals','Distances between notes (3rds, 5ths…)'],['major','Major scale','Its formula and fingerings'],['penta','Pentatonic','Minor / major pentatonic shapes'],['chords','Chord construction','How triads and 7ths are built'],['keys','Keys','Key signatures, diatonic chords'],['modes','Modes','Dorian, Mixolydian and friends']],
  theoryScale:['None','Heard of it','Can use it','Solid'],
  struggles:[['changes','Chord changes'],['barre','Barre chords'],['speed','Speed'],['timing','Timing / rhythm'],['strum','Strumming patterns'],['fretboard','Knowing the fretboard'],['improv','Improvising'],['ear','Playing by ear'],['memorize','Memorizing songs'],['theory','Theory'],['tension','Tension / finger pain'],['consistency','Practice consistency']],
  goals:[['songs','Play songs I love'],['improv','Improvise & solo'],['write','Write my own music'],['band','Play with others'],['theory','Understand theory'],['ear','Play by ear'],['speed','Speed & technique'],['fretboard','Master the fretboard'],['perform','Perform live'],['record','Record my playing']],
  guitar:[['electric','Electric'],['acoustic','Acoustic (steel)'],['classical','Classical (nylon)'],['several','Several types']],
  gear:[['amp','Amp'],['interface','Audio interface'],['modeler','Modeler / multi-FX'],['headamp','Headphone amp'],['none','No amp / interface']],
  metronome:[['yes','Yes — app or device'],['no','No — I’ll use this app']],
  looper:[['yes','Yes'],['no','No']]
};
const lab=(list,id)=>{const o=list.find(x=>x[0]===id);return o?o[1]:id};

const Timer = {
  remaining:60, total:60, running:false, counting:false, id:null, countId:null, endAt:0, onTick:null, onDone:null,
  start(sec, countInMs=0){
    this.reset(sec); this.counting=countInMs>0;
    this.onTick&&this.onTick(this.remaining,this.counting?'count':'ready');
    this.countId=setTimeout(()=>{
      this.counting=false; this.running=true; this.endAt=performance.now()+sec*1000;
      this.id=setInterval(()=>this.tick(),100); this.tick();
    },countInMs);
  },
  tick(){
    this.remaining=Math.max(0,(this.endAt-performance.now())/1000);
    this.onTick&&this.onTick(this.remaining,'live');
    if(this.remaining<=0){
      this.stopTimers();
      const c=AudioEngine.get(); if(c){AudioEngine.beep(c.currentTime+.02,880,.35);AudioEngine.beep(c.currentTime+.42,1320,.6)}
      try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}
      this.onTick&&this.onTick(0,'done'); this.onDone&&this.onDone();
    }
  },
  stopTimers(){clearInterval(this.id);clearTimeout(this.countId);this.running=false;this.counting=false},
  reset(sec){this.stopTimers();this.total=sec||this.total;this.remaining=this.total;this.onTick&&this.onTick(this.remaining,'ready')}
};


const CHORD_SHAPES = {
  Em:{frets:'022000',fingers:'023000'}, Am:{frets:'x02210',fingers:'x02310'},
  G:{frets:'320003',fingers:'210003'}, C:{frets:'x32010',fingers:'x32010'},
  D:{frets:'xx0232',fingers:'xx0132'},
  F:{frets:'133211',fingers:'134211',barre:1}, Bb:{frets:'x13331',fingers:'x12341',barre:1}
};
function chordSVG(name){
  const s=CHORD_SHAPES[name]; if(!s) return '';
  const fr=s.frets.split(''), fi=s.fingers.split('');
  const nums=fr.filter(f=>f!=='x'&&f!=='0').map(Number);
  const max=Math.max(...nums,1), min=Math.min(...nums,1);
  const base=max>4?min:1, L=18, T=34, G=14, FH=18, C='#ece6da';
  let o=`<svg viewBox="0 0 106 134" role="img" aria-label="${name} chord diagram"><text x="53" y="14" text-anchor="middle" fill="${C}" font-family="Oswald,Arial Narrow,sans-serif" font-size="15" font-weight="600">${name}</text>`;
  for(let i=0;i<6;i++) o+=`<line x1="${L+i*G}" y1="${T}" x2="${L+i*G}" y2="${T+5*FH}" stroke="#8d867c" stroke-width="1"/>`;
  for(let f=0;f<=5;f++) o+=`<line x1="${L}" y1="${T+f*FH}" x2="${L+5*G}" y2="${T+f*FH}" stroke="#8d867c" stroke-width="${f===0&&base===1?4:1}"/>`;
  if(base>1) o+=`<text x="${L+5*G+5}" y="${T+12}" fill="#a39d93" font-size="10">${base}fr</text>`;
  if(s.barre){
    const idx=fr.map((f,i)=>Number(f)===s.barre?i:-1).filter(i=>i>=0);
    const y=T+(s.barre-base+.5)*FH;
    o+=`<rect x="${L+idx[0]*G-6}" y="${y-6}" width="${(idx[idx.length-1]-idx[0])*G+12}" height="12" rx="6" fill="#f5a524"/>`;
  }
  fr.forEach((f,i)=>{
    const x=L+i*G;
    if(f==='x') o+=`<text x="${x}" y="${T-6}" text-anchor="middle" fill="#a39d93" font-size="11">✕</text>`;
    else if(f==='0') o+=`<circle cx="${x}" cy="${T-9}" r="4" fill="none" stroke="${C}" stroke-width="1.4"/>`;
    else if(!(s.barre&&Number(f)===s.barre&&fi[i]==='1')){
      const y=T+(Number(f)-base+.5)*FH;
      o+=`<circle cx="${x}" cy="${y}" r="6.5" fill="#f5a524"/><text x="${x}" y="${y+3.5}" text-anchor="middle" fill="#1b1205" font-size="10" font-weight="700">${fi[i]}</text>`;
    }
  });
  return o+'</svg>';
}
function tabFrom(seq){ // seq: [[string 1-6 (1 = high e), fret], ...]
  const names=['e','B','G','D','A','E'], lines=names.map(n=>n+'|-');
  for(const [s,f] of seq){const w=String(f).length;for(let i=0;i<6;i++) lines[i]+=(i===s-1?String(f):'-'.repeat(w))+'-'}
  return lines.map(l=>l+'|').join('\n');
}
function patternHTML(strokes){
  const counts=['1','&','2','&','3','&','4','&'];
  return `<div class="pattern">${counts.map(c=>`<span>${c}</span>`).join('')}${strokes.map(s=>`<b>${s||''}</b>`).join('')}</div>`;
}
const PENTA_BOX1=[[6,5],[6,8],[5,5],[5,7],[4,5],[4,7],[3,5],[3,7],[2,5],[2,8],[1,5],[1,8]];

const RUBRIC = {
  lock:['Drifted off the click a lot','Lost it a few times, recovered','Mostly locked, occasional flam or rush','Locked in; the click mostly disappeared','Click vanished under your playing the whole time'],
  clean:['Messy: many dead or buzzing notes','Some clean passes, lots of stops','Mostly clean with a couple of hesitations','Clean and steady, tiny slips only','Clean, relaxed, could go faster'],
  memory:['Needed the tab the whole way','Got lost a few times','Made it with a pause or two','Clean from memory, slight hesitation','Clean from memory, no hesitation, both directions'],
  phrase:['Ran the scale up and down, no phrases','A few phrases, mostly noodling','Clear phrases with some space','Phrases with space; repeated and varied an idea','Told a story: motifs, space, strong endings'],
  target:['Rarely knew where the chord tones were','Hit a target note now and then','Hit targets on about half the changes','Hit most targets, still a bit planned','Hit every target and it sounded musical']
};
const TESTS = [
  /* ---- Fretting hand ---- */
  {id:'fh_em_am',domain:'fretting',level:2,type:'play',name:'Em ↔ Am chord changes',
   why:'Measures how quickly your fretting hand finds and lands a shape — the base of every chord change.',
   instr:'Strum once on beat 1, let it ring for 4 beats, change on beat 4 so the next chord lands on beat 1. Count only changes where every note rings clean.',
   chords:['Em','Am'], metro:{bpm:60}, timer:60, input:{type:'count',label:'Clean changes in 60 s',unit:'clean changes / 60 s',target:12,max:15},
   watch:'Lifting fingers high off the fretboard between shapes. Keep them hovering.',
   simplify:'one-minute changes at 50 BPM and “air changes” (form the shape just above the strings)',
   nextStep:'Add G, C and D to the change rotation at 60 BPM.'},
  {id:'fh_gcd',domain:'fretting',level:4,type:'play',name:'G–C–D changes',
   why:'Three-chord changes with different finger groupings are where most songs live.',
   instr:'Loop G–C–D–G, 2 beats per chord (strum on beats 1 and 2). Raise the metronome in steps until you can’t play 4 full cycles clean. Enter your highest clean BPM.',
   chords:['G','C','D'], metro:{bpm:60}, timer:null, input:{type:'bpm',label:'Highest clean BPM (4 cycles)',target:90,max:240},
   watch:'Rushing the change and choking the last strum before it. The change happens on the “&” of beat 2.',
   simplify:'G–C only at 60 BPM, then add D',
   nextStep:'Start E-shape barre chords: F at fret 1 and its A-shape partner B♭.'},
  {id:'fh_barre',domain:'fretting',level:6,type:'play',name:'F ↔ B♭ barre changes',
   why:'Barre changes unlock every key; clean barres are the gateway to the upper fretboard.',
   instr:'2 beats per chord at 60 BPM for 60 seconds. Count changes where all strings ring with no dead notes under the barre.',
   chords:['F','Bb'], metro:{bpm:60}, timer:60, input:{type:'count',label:'Clean changes in 60 s',unit:'clean changes / 60 s',target:24,max:30},
   watch:'Squeezing with the thumb. Pull back with your arm weight instead and keep the barre on the bony side of the index finger.',
   simplify:'the same shapes at fret 5 (A and D), where the barre is easier, then slide down',
   nextStep:'Move barre pairs around the neck (G–C at fret 3, A–D at fret 5) and add 7th-chord barres.'},
  {id:'fh_legato',domain:'fretting',level:8,type:'play',name:'3-note-per-string legato',
   why:'Legato builds fretting-hand strength and independence without help from the pick.',
   instr:'G major, 3 notes per string. Pick only the first note on each string; hammer the rest going up, pull off coming down. 16th notes. Enter your highest even, clean BPM.',
   tab:tabFrom([[6,3],[6,5],[6,7],[5,3],[5,5],[5,7],[4,4],[4,5],[4,7],[3,4],[3,5],[3,7],[2,5],[2,7],[2,8],[1,5],[1,7],[1,8]]),
   metro:{bpm:70}, timer:null, input:{type:'bpm',label:'Highest clean BPM (16ths)',target:100,max:240},
   watch:'Hammered notes quieter than picked ones. Hammer from about 1 cm and land on the fingertip.',
   simplify:'one string at a time, 8th notes',
   nextStep:'Legato runs across positions with slides; aim for 120 BPM 16ths.'},

  /* ---- Picking hand ---- */
  {id:'pk_strum',domain:'picking',level:2,type:'play',name:'Strumming pattern on Em',
   why:'A steady down-up motion that never stops is the engine of rhythm guitar.',
   instr:'Hold Em. Keep your hand moving down-up on every 8th note; only make contact where a stroke is shown. Play for 60 seconds, then rate yourself.',
   pattern:['D','','D','U','','U','D','U'], chords:['Em'], metro:{bpm:70}, timer:60, input:{type:'rating',rubric:RUBRIC.lock},
   watch:'Stopping your hand on the missed strokes. It should keep swinging like a pendulum.',
   simplify:'down-strokes on every beat, then add the up-strokes',
   nextStep:'Apply the pattern to G–C–D changes and add accents on beats 2 and 4.'},
  {id:'pk_alt8',domain:'picking',level:4,type:'play',name:'Alternate picking, single string',
   why:'Strict down-up picking on one string is the foundation for every fast lead line.',
   instr:'Loop this on the B string in 8th notes, strictly down-up. Find the highest BPM you can hold for 30 seconds with even, clean notes.',
   tab:tabFrom([[2,5],[2,7],[2,8],[2,7],[2,5],[2,7],[2,8],[2,7]]), metro:{bpm:80}, timer:null,
   input:{type:'bpm',label:'Highest clean BPM (8ths)',target:120,max:240},
   watch:'Picking from the elbow. The motion should come from the wrist and be small.',
   simplify:'open-string 8ths at 80 BPM',
   nextStep:'Cross strings: A minor pentatonic box 1 in 16ths.'},
  {id:'pk_penta16',domain:'picking',level:6,type:'play',name:'Pentatonic 16ths, strict alternate',
   why:'String crossing is where most picking breaks down; this exposes it.',
   instr:'A minor pentatonic box 1, up and back down, 16th notes, strict alternate picking. Enter the highest BPM you can do 4 clean round trips.',
   tab:tabFrom([...PENTA_BOX1,...[...PENTA_BOX1].reverse().slice(1)]), metro:{bpm:70}, timer:null,
   input:{type:'bpm',label:'Highest clean BPM (16ths)',target:100,max:240},
   watch:'Tension in the forearm as the tempo rises. If it tightens, drop 5 BPM.',
   simplify:'8th notes, two strings at a time',
   nextStep:'Sequences in groups of 4 and outside-picking string changes at 100+ BPM.'},
  {id:'pk_sweep',domain:'picking',level:8,type:'play',name:'3-string sweep (A minor)',
   why:'Sweeps test the picking hand’s timing together with fretting-hand muting.',
   instr:'A minor triad (A-C-E) on G-B-e. One continuous down-stroke across three strings, then up-strokes back. Triplets. Each note must sound alone.',
   tab:tabFrom([[3,14],[2,13],[1,12],[2,13],[3,14],[2,13]]), metro:{bpm:70}, timer:null,
   input:{type:'bpm',label:'Highest clean BPM (triplets)',target:100,max:240},
   watch:'Notes ringing together. Lift each fretting finger as soon as the next note sounds.',
   simplify:'the same notes picked separately (down-up), then join them',
   nextStep:'5-string A-shape sweeps and connecting sweeps to legato runs.'},

  /* ---- Rhythm ---- */
  {id:'rh_quarter',domain:'rhythm',level:2,type:'play',name:'Quarter notes on the click',
   why:'If the click disappears under your strum, you’re perfectly on time. That’s the skill.',
   instr:'Mute the strings with your fretting hand. Strum one down-stroke per click for 60 seconds. Try to make the click vanish.',
   metro:{bpm:70}, timer:60, input:{type:'rating',rubric:RUBRIC.lock},
   watch:'Rushing slightly ahead of the click. Relax and let the beat come to you.',
   simplify:'counting “1-2-3-4” out loud with the click before playing',
   nextStep:'Subdivision ladder: quarters, 8ths, triplets and 16ths.'},
  {id:'rh_subdiv',domain:'rhythm',level:4,type:'play',name:'Subdivision ladder',
   why:'Switching subdivisions on demand is how you feel the grid between the clicks.',
   instr:'Muted strums. One bar each: quarters → 8ths → triplets → 16ths, then repeat. Keep the beat steady through every switch for 60 seconds.',
   metro:{bpm:70}, timer:60, input:{type:'rating',rubric:RUBRIC.lock},
   watch:'Triplets turning into dotted rhythms. Count “1-trip-let, 2-trip-let”.',
   simplify:'quarters ↔ 8ths only',
   nextStep:'Move the click to beats 2 & 4 only.'},
  {id:'rh_backbeat',domain:'rhythm',level:6,type:'play',name:'Click on 2 & 4',
   why:'Hearing the click as the backbeat builds the internal pulse drummers rely on.',
   instr:'The click plays only on beats 2 and 4. Play muted 8th-note strums, accenting 2 and 4, for 60 seconds without flipping the beat.',
   metro:{bpm:60,mode:'backbeat'}, timer:60, input:{type:'rating',rubric:RUBRIC.lock},
   watch:'The click sliding to “1 and 3” in your head. Tap your foot on 1-2-3-4.',
   simplify:'the normal click at 60 BPM with accents on 2 & 4, then remove beats 1 & 3',
   nextStep:'Gap click: keep time through bars of silence.'},
  {id:'rh_gap',domain:'rhythm',level:8,type:'play',name:'Gap click',
   why:'Holding time through silence proves the tempo is inside you, not in the click.',
   instr:'The click plays 2 bars, then goes silent for 2 bars. Keep strumming 8ths through the gap. Score a hit each time your beat 1 lands with the click when it returns. Do 8 tries.',
   metro:{bpm:80,mode:'gap'}, timer:null, input:{type:'count',label:'Hits out of 8 tries',unit:'hits / 8',target:6,max:8},
   watch:'Speeding up in the silence. Most players rush.',
   simplify:'1-bar gaps at 70 BPM',
   nextStep:'4-bar gaps and syncopated 16th-note patterns.'},

  /* ---- Fretboard (generated) ---- */
  {id:'fb_nat',domain:'fretboard',level:2,type:'quiz',gen:'fb_nat',name:'Natural notes on strings 6 & 5',
   why:'Root notes on the low strings are where chord shapes and scales are anchored.',
   nextStep:'Natural notes on strings 4–6, then all strings with sharps and flats.'},
  {id:'fb_all',domain:'fretboard',level:4,type:'quiz',gen:'fb_all',name:'Any note, any string',
   why:'Instant note recall anywhere on the neck is the backbone of fretboard knowledge.',
   nextStep:'Interval shapes: octaves, 5ths and 3rds from 6th- and 5th-string roots.'},
  {id:'fb_int',domain:'fretboard',level:6,type:'quiz',gen:'fb_int',name:'Interval shapes',
   why:'Seeing intervals as shapes lets you build chords and lines anywhere.',
   nextStep:'CAGED: find each shape’s root for any key.'},
  {id:'fb_caged',domain:'fretboard',level:8,type:'quiz',gen:'fb_caged',name:'CAGED root locations',
   why:'CAGED connects chord shapes across the whole neck.',
   nextStep:'Link CAGED shapes to scale positions; arpeggios through all five.'},

  /* ---- Theory ---- */
  {id:'th_basics',domain:'theory',level:2,type:'quiz',name:'Musical alphabet & steps',concept:'Musical alphabet, half and whole steps, octaves',
   why:'Everything else in theory is built from steps and the musical alphabet.',
   questions:[
     {prompt:'How many frets make a whole step?',answer:'2',options:['2','1','3','4']},
     {prompt:'Which natural note comes right after G?',answer:'A',options:['A','H','F','B']},
     {prompt:'A sharp (♯) does what to a note?',answer:'Raises it 1 fret',options:['Raises it 1 fret','Raises it 2 frets','Lowers it 1 fret','Raises it an octave']},
     {prompt:'How many frets up is the same note an octave higher on one string?',answer:'12',options:['12','10','7','5']},
     {prompt:'Which pair of natural notes has NO sharp between them?',answer:'E and F',options:['E and F','C and D','G and A','A and B']}],
   nextStep:'Major-scale formula (W-W-H-W-W-W-H), played on one string.'},
  {id:'th_major',domain:'theory',level:4,type:'quiz',name:'Major scale & triads',concept:'Major scale formula, key signatures, triad qualities',
   why:'The major scale is the reference point for intervals, chords and keys.',
   questions:[
     {prompt:'Which is the major-scale step pattern?',answer:'W W H W W W H',options:['W W H W W W H','W H W W H W W','W W W H W W H','H W W W H W W']},
     {prompt:'Which note is sharp in G major?',answer:'F♯',options:['F♯','C♯','B♭','G♯']},
     {prompt:'What is the relative minor of C major?',answer:'A minor',options:['A minor','E minor','D minor','C minor']},
     {prompt:'Root + major 3rd + perfect 5th makes which triad?',answer:'Major',options:['Major','Minor','Diminished','Augmented']},
     {prompt:'In a major key, the chords on degrees 1, 4 and 5 are…',answer:'All major',options:['All major','All minor','Major, minor, major','Minor, major, minor']}],
   nextStep:'Diatonic chords of a major key (I ii iii IV V vi vii°) and 7th chords.'},
  {id:'th_chords',domain:'theory',level:6,type:'quiz',name:'Chord construction & harmony',concept:'7th-chord construction, diatonic harmony, pentatonic formula',
   why:'Knowing how chords are built tells you which notes to target when you solo.',
   questions:[
     {prompt:'Which notes make Cmaj7?',answer:'C E G B',options:['C E G B','C E G B♭','C E♭ G B♭','C E G♯ B']},
     {prompt:'In D major, the ii chord is…',answer:'Em',options:['Em','E','F♯m','G']},
     {prompt:'Minor pentatonic formula?',answer:'1 ♭3 4 5 ♭7',options:['1 ♭3 4 5 ♭7','1 2 3 5 6','1 ♭3 5 ♭7','1 2 ♭3 5 6']},
     {prompt:'Dominant 7th chord formula?',answer:'1 3 5 ♭7',options:['1 3 5 ♭7','1 3 5 7','1 ♭3 5 ♭7','1 ♭3 ♭5 ♭7']},
     {prompt:'What is the V7 chord in A major?',answer:'E7',options:['E7','D7','Emaj7','A7']}],
   nextStep:'Modes as colors of the major scale, starting with Dorian and Mixolydian.'},
  {id:'th_modes',domain:'theory',level:8,type:'quiz',name:'Modes & advanced harmony',concept:'Modes, borrowed chords, tritone substitution',
   why:'Modal and chromatic harmony are what make progressions sound sophisticated.',
   questions:[
     {prompt:'Which note gives Dorian its color compared with natural minor?',answer:'Natural 6',options:['Natural 6','♭2','♯4','Natural 7']},
     {prompt:'Mixolydian is a major scale with…',answer:'♭7',options:['♭7','♭3','♯4','♭6']},
     {prompt:'In C major, the borrowed ♭VI chord is…',answer:'A♭',options:['A♭','A','Am','B♭']},
     {prompt:'What is the tritone substitute for G7?',answer:'D♭7',options:['D♭7','D7','C♯m7','F7']},
     {prompt:'Lydian’s characteristic note is the…',answer:'♯4',options:['♯4','♭7','♭2','♭6']}],
   nextStep:'Modal interchange and secondary dominants in real progressions.'},

  /* ---- Ear (generated, audio) ---- */
  {id:'ear_hilo',domain:'ear',level:2,type:'quiz',gen:'ear_hilo',audio:true,name:'Higher or lower?',
   why:'Hearing pitch direction is the first step to playing what you hear.',nextStep:'Name intervals: 3rds, 4ths, 5ths and octaves.'},
  {id:'ear_int1',domain:'ear',level:4,type:'quiz',gen:'ear_int1',audio:true,name:'Core intervals',
   why:'3rds, 4ths, 5ths and octaves cover most melodies and riffs.',nextStep:'Triad quality: major, minor, diminished, augmented.'},
  {id:'ear_triads',domain:'ear',level:6,type:'quiz',gen:'ear_triads',audio:true,name:'Triad qualities',
   why:'Recognizing chord quality is the start of transcribing progressions by ear.',nextStep:'All 12 intervals, including 2nds, 6ths, 7ths and the tritone.'},
  {id:'ear_intall',domain:'ear',level:8,type:'quiz',gen:'ear_intall',audio:true,name:'All intervals',
   why:'Full interval recognition lets you work out melodies quickly.',nextStep:'7th-chord qualities and transcribing short melodies.'},
  {id:'ear_7ths',domain:'ear',level:9,type:'quiz',gen:'ear_7ths',audio:true,name:'7th-chord qualities',
   why:'7th-chord colors are what you hear in jazz, soul and neo-soul.',nextStep:'Transcribe ii–V–I progressions and solos by ear.'},

  /* ---- Improvisation ---- */
  {id:'im_box',domain:'improv',level:2,type:'play',name:'Pentatonic box 1 from memory',
   why:'You can’t improvise with a shape you still have to read.',
   instr:'A minor pentatonic, box 1 (5th fret). Play it up and down in 8th notes from memory, then rate yourself.',
   tab:tabFrom(PENTA_BOX1), metro:{bpm:70}, timer:null, input:{type:'rating',rubric:RUBRIC.memory},
   watch:'Looking at the tab mid-run. Close your eyes on the second pass.',
   simplify:'the bottom three strings only',
   nextStep:'Improvise 60 seconds over an Am–G loop using box 1, leaving space between phrases.'},
  {id:'im_loop',domain:'improv',level:4,type:'play',name:'60-second solo over Am–G',
   why:'Phrasing and space make scale notes sound like music.',
   instr:'Start the click: an Am–G backing loop plays with it. Improvise for 60 seconds with box 1. Play short phrases, leave gaps, end phrases on A.',
   tab:tabFrom(PENTA_BOX1), metro:{bpm:80,backing:['Am','Am','G','G']}, timer:60, input:{type:'rating',rubric:RUBRIC.phrase},
   watch:'Constant 8th notes with no breathing room. Rests are part of the solo.',
   simplify:'3-note phrases only: play 1 bar, rest 1 bar',
   nextStep:'Target the root of each chord on the change (Am–F–C–G).'},
  {id:'im_targets',domain:'improv',level:6,type:'play',name:'Targeting chord roots',
   why:'Landing on chord tones at the changes is what makes a solo follow the harmony.',
   instr:'Backing: Am–F–C–G, one bar each. Land on the root of each chord (A, F, C, G) on beat 1 of its bar, then phrase freely until the next change.',
   metro:{bpm:80,backing:['Am','F','C','G']}, timer:60, input:{type:'rating',rubric:RUBRIC.target},
   watch:'Arriving late: start moving toward the target note on beat 3 of the previous bar.',
   simplify:'whole notes: play only the root of each chord in time',
   nextStep:'Use 3rds as targets and connect box 1 to box 2.'},
  {id:'im_251',domain:'improv',level:8,type:'play',name:'ii–V–I, land on the 3rds',
   why:'Outlining the 3rds through a ii–V–I is the core skill of playing over changes.',
   instr:'Backing: Am7–D7–Gmaj7–Gmaj7. Land on the 3rd of each chord at the change (C over Am7, F♯ over D7, B over Gmaj7).',
   metro:{bpm:90,backing:['Am7','D7','Gmaj7','Gmaj7']}, timer:60, input:{type:'rating',rubric:RUBRIC.target},
   watch:'Playing G major over D7 without hearing the F♯ resolve. Exaggerate it.',
   simplify:'guide tones only, as half notes',
   nextStep:'Chromatic approach notes into chord tones; outline changes with arpeggios.'},

  /* ---- Repertoire ---- */
  {id:'rep_songs',domain:'repertoire',level:1,type:'songs',name:'Song list',why:'Repertoire is measured by songs you can play start to finish.'}
];
const TEST_BY_ID = Object.fromEntries(TESTS.map(t=>[t.id,t]));
const testsFor = key => TESTS.filter(t=>t.domain===key&&t.type!=='songs').sort((a,b)=>a.level-b.level);

/* ------------------------------- QuizGen ------------------------------- */
const NOTES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const NOTES_FULL = ['C','C♯/D♭','D','D♯/E♭','E','F','F♯/G♭','G','G♯/A♭','A','A♯/B♭','B'];
const OPEN = {6:40,5:45,4:50,3:55,2:59,1:64};
const STR = {6:'6th (low E)',5:'5th (A)',4:'4th (D)',3:'3rd (G)',2:'2nd (B)',1:'1st (high e)'};
const ORD = {6:'6th',5:'5th',4:'4th',3:'3rd',2:'2nd',1:'1st'};
const IV = {1:'Minor 2nd',2:'Major 2nd',3:'Minor 3rd',4:'Major 3rd',5:'Perfect 4th',6:'Tritone',7:'Perfect 5th',8:'Minor 6th',9:'Major 6th',10:'Minor 7th',11:'Major 7th',12:'Octave'};
const pc = m => ((m%12)+12)%12;
function mcq(prompt,answer,pool,extra={}){
  const d=U.shuffle([...new Set(pool)].filter(x=>x!==answer)).slice(0,3);
  return Object.assign({prompt,answer,options:U.shuffle([answer,...d])},extra);
}
function uniqueQs(n,make){const out=[],seen=new Set();let guard=0;while(out.length<n&&guard++<500){const q=make();if(!q||seen.has(q.key))continue;seen.add(q.key);out.push(q)}return out}
const QuizGen = {
  fb_nat(){return uniqueQs(8,()=>{
    const s=U.pick([6,5]); const frets=[...Array(13).keys()].filter(f=>NOTES[pc(OPEN[s]+f)].length===1);
    const f=U.pick(frets), n=NOTES[pc(OPEN[s]+f)];
    return mcq(`What note is at fret ${f} on the ${STR[s]} string?`,n,['A','B','C','D','E','F','G'],{key:s+'-'+f});
  })},
  fb_all(){return uniqueQs(8,()=>{
    const s=U.rand(1,6), f=U.rand(1,12), p=pc(OPEN[s]+f), n=NOTES_FULL[p];
    return mcq(`What note is at fret ${f} on the ${STR[s]} string?`,n,[-2,-1,1,2,5].map(d=>NOTES_FULL[pc(p+d)]),{key:s+'-'+f});
  })},
  fb_int(){return uniqueQs(8,()=>{
    const rs=U.pick([6,5,4]), fr=U.rand(2,7), ts=U.pick([rs,rs-1,rs-1,rs-2]);
    const ft=U.rand(Math.max(0,fr-4),fr+5);
    const semis=(OPEN[ts]+ft)-(OPEN[rs]+fr); if(semis<1||semis>12) return null;
    const rn=NOTES_FULL[pc(OPEN[rs]+fr)];
    return mcq(`Root: ${STR[rs]} string, fret ${fr} (${rn}). Target: ${STR[ts]} string, fret ${ft}. What interval is that?`,IV[semis],[-2,-1,1,2,3].map(d=>IV[semis+d]).filter(Boolean),{key:rs+'-'+fr+'-'+ts+'-'+ft});
  })},
  fb_caged(){
    const SH={E:6,A:5,C:5,D:4,G:6}, KEYS=['C','D','E','F','G','A','B♭','B'], KPC={C:0,D:2,E:4,F:5,G:7,A:9,'B♭':10,B:11};
    const fretOf=(k,s)=>{const f=pc(KPC[k]-OPEN[s]);return f===0?12:f};
    return uniqueQs(8,()=>{
      const k=U.pick(KEYS), sh=U.pick(Object.keys(SH)), s=SH[sh], f=fretOf(k,s);
      const ans=`${ORD[s]} string, fret ${f}`;
      const others=[6,5,4].filter(x=>x!==s);
      const pool=[`${ORD[s]} string, fret ${f+2}`,`${ORD[s]} string, fret ${Math.max(1,f-2)}`,...others.map(o=>`${ORD[o]} string, fret ${fretOf(k,o)}`),`${ORD[s]} string, fret ${f+5}`];
      return mcq(`Where is the root of ${k} major when you play it with the ${sh}-shape?`,ans,pool,{key:k+sh});
    });
  },
  ear_hilo(){return uniqueQs(8,()=>{
    const a=U.rand(52,70), d=U.pick([-4,-3,-2,-1,1,2,3,4]), ans=d>0?'Second note is higher':'Second note is lower';
    return {key:a+'/'+d,prompt:'Is the second note higher or lower?',answer:ans,options:['Second note is higher','Second note is lower'],audio:{type:'seq',notes:[a,a+d]}};
  })},
  _intervals(set,n){return uniqueQs(n,()=>{
    const s=U.pick(set), r=U.rand(48,62), ans=IV[s];
    const opts=set.length<=5?U.shuffle(set.map(x=>IV[x])):mcq('',ans,set.map(x=>IV[x])).options;
    return {key:r+'/'+s,prompt:'Name the interval (melodic, then together).',answer:ans,options:opts,audio:{type:'interval',notes:[r,r+s]}};
  })},
  ear_int1(){return this._intervals([3,4,5,7,12],8)},
  ear_intall(){return this._intervals([1,2,3,4,5,6,7,8,9,10,11,12],8)},
  _chords(map){const names=Object.keys(map);return uniqueQs(8,()=>{
    const q=U.pick(names), r=U.rand(48,57);
    return {key:r+q,prompt:'What quality is this chord? (arpeggio, then strummed)',answer:q,options:U.shuffle(names),audio:{type:'chord',notes:map[q].map(i=>r+i)}};
  })},
  ear_triads(){return this._chords({Major:[0,4,7],Minor:[0,3,7],Diminished:[0,3,6],Augmented:[0,4,8]})},
  ear_7ths(){return this._chords({'Maj7':[0,4,7,11],'Dominant 7':[0,4,7,10],'Minor 7':[0,3,7,10],'Half-dim (m7♭5)':[0,3,6,10]})}
};
function buildQuiz(test){
  if(test.gen) return QuizGen[test.gen]();
  return test.questions.map(q=>Object.assign({},q,{options:U.shuffle(q.options)}));
}


const Assessment = {
  state(p,key){
    if(!p.assessment.domains[key]) p.assessment.domains[key]={tests:[],current:null,phase:'test',skipped:false};
    return p.assessment.domains[key];
  },
  startingTest(key,prior){
    const tiers=testsFor(key); let pick=tiers[0];
    for(const t of tiers) if(t.level<=prior+.75) pick=t;
    return pick;
  },
  scorePlay(test,v){
    const i=test.input;
    if(i.type==='rating'){return {score:[0,.3,.55,.75,.88,1][v]||0, display:`${v}/5 — ${i.rubric[v-1]}`, targetText:'5/5'}}
    const score=U.clamp(v/i.target,0,1.25);
    if(i.type==='bpm') return {score, display:`${v} BPM`, targetText:`${i.target} BPM`};
    return {score, display:`${v} ${i.unit}`, targetText:`${i.target} ${i.unit}`};
  },
  record(p,key,test,res){
    const ds=this.state(p,key);
    ds.tests=ds.tests.filter(t=>t.id!==test.id);
    ds.tests.push({id:test.id,level:test.level,name:test.name,type:test.type,score:+res.score.toFixed(3),display:res.display,targetText:res.targetText,raw:res.raw,date:U.today()});
    ds.phase='feedback';
  },
  zone(s){return s>=.9?'pass':s>=.7?'edge':'fail'},
  next(p,key){
    const recs=this.state(p,key).tests, last=recs[recs.length-1];
    if(!last) return {stop:true,why:''};
    const tiers=testsFor(key), tried=new Set(recs.map(r=>r.id));
    if(recs.length>=3) return {stop:true,why:'Three tests is enough to place you.'};
    if(last.score>=.9){
      const blockedAbove=recs.some(r=>r.level>last.level&&r.score<.9);
      const harder=tiers.find(t=>t.level>last.level&&!tried.has(t.id));
      if(harder&&!blockedAbove) return {offer:harder,dir:'harder'};
      return {stop:true,why:harder?'Your edge sits between your last two tests.':'You cleared the top test in this domain.'};
    }
    if(last.score<.7){
      const passedBelow=recs.some(r=>r.level<last.level&&r.score>=.7);
      const easier=[...tiers].reverse().find(t=>t.level<last.level&&!tried.has(t.id));
      if(easier&&!passedBelow) return {offer:easier,dir:'easier'};
      return {stop:true,why:easier?'Your edge sits between your last two tests.':'This is the entry-level test, so this is where we start.'};
    }
    return {stop:true,why:'Edge zone found.'};
  }
};

/* ------------------------------- Leveling ------------------------------ */
const Leveling = {
  priors(q){
    const yr={lt6m:0,'6to12m':1,'1to2y':2,'2to5y':3,'5to10y':4.5,'10y':6}[q.experience]; const y=yr==null?1:yr;
    const c=id=>q.chords.includes(id)?1:0, t=id=>q.techniques.includes(id)?1:0, th=id=>q.theory[id]||0, s=id=>q.struggles.includes(id)?1:0;
    const p={
      fretting:1+.35*y+.4*c('open_maj')+.3*c('open_min')+.3*c('power')+.7*c('barre_e')+.6*c('barre_a')+.3*c('dom7')+.3*c('maj7')+.2*c('sus')+.5*c('ext')+.3*c('inv')+.4*t('hammer')+.3*t('bends')+.3*t('vibrato')+.2*t('slides')+.5*t('tapping')-.8*s('changes')-.5*s('barre')-.4*s('tension'),
      picking:1+.35*y+.4*t('strum')+.8*t('alt')+.3*t('palm')+.5*t('finger')+.5*t('hybrid')+.9*t('sweep')+.2*t('tapping')-.8*s('speed')-.5*s('strum'),
      rhythm:1+.45*y+.4*t('strum')+.3*t('palm')+(q.equipment.metronome==='yes'?.6:0)+(q.equipment.looper==='yes'?.3:0)-1*s('timing')-.4*s('strum'),
      fretboard:1+.3*y+.7*th('notes')+.35*th('intervals')+.25*th('penta')+.2*th('major')+.3*c('barre_e')+.3*c('barre_a')-1*s('fretboard'),
      theory:1+.4*(th('notes')+th('intervals')+th('major')+th('penta')+th('chords')+th('keys')+th('modes'))-.6*s('theory'),
      ear:1+.3*y+.35*th('intervals')+.2*th('chords')+(q.learning==='self'?.5:0)-1*s('ear'),
      improv:1+.3*y+.5*th('penta')+.3*th('modes')+.2*th('major')+.3*t('bends')+.3*t('vibrato')+.2*t('hammer')-1*s('improv'),
      repertoire:1+.55*y+.2*c('open_maj')+.2*c('barre_e')-.6*s('memorize')
    };
    for(const k in p) p[k]=+U.clamp(p[k],1,9).toFixed(2);
    return p;
  },
  fromTests(tests){
    const done=(tests||[]).filter(t=>t.score!=null);
    if(!done.length) return null;
    const maxBy=(a,f)=>a.reduce((x,y)=>f(y)>f(x)?y:x);
    const edges=done.filter(t=>t.score>=.7&&t.score<.9);
    if(edges.length){const e=maxBy(edges,t=>t.level);return {level:e.level-.5+(e.score-.7)*5,kind:'edge',rec:e}}
    const passed=done.filter(t=>t.score>=.9), failed=done.filter(t=>t.score<.7);
    const hp=passed.length?maxBy(passed,t=>t.level):null;
    const above=failed.filter(t=>!hp||t.level>hp.level);
    const lf=above.length?maxBy(above,t=>-t.level):null;
    if(hp&&lf) return {level:hp.level+.5+(lf.level-hp.level-1)*U.clamp(lf.score/.7,0,1),kind:'between',rec:lf,passed:hp};
    if(hp) return {level:hp.level+1,kind:'above',rec:hp};
    return {level:Math.max(1,lf.level-2+U.clamp(lf.score/.7,0,1)*1.5),kind:'below',rec:lf};
  },
  edgeNote(key,r){
    if(!r) return 'Not tested yet; estimated from your answers. Verify in your first session.';
    const t=TEST_BY_ID[r.rec.id], x=r.rec;
    if(r.kind==='edge') return `${x.name}: ${x.display} (target ${x.targetText}). Right in the edge zone; train here. Then: ${t.nextStep}`;
    if(r.kind==='between') return `${x.name}: ${x.display} vs target ${x.targetText}. ${r.passed.name} is solid, so close this gap next.`;
    if(r.kind==='above'){
      const harder=testsFor(key).find(z=>z.level>x.level);
      return harder?`${x.name} cleared (${x.display}). Next stretch: ${harder.name}.`:`${x.name} cleared (${x.display}). Next: ${t.nextStep}`;
    }
    return `${x.name}: ${x.display} vs target ${x.targetText}. Break it down first: ${t.simplify||(t.type==='quiz'?'drill the missed items in sets of 3–4, then retake':'slow it down and isolate the hardest part')}.`;
  },
  repertoire(songs,prior){
    const real=(songs||[]).filter(s=>s.title&&s.title.trim());
    if(!real.length) return {level:1,edge:'No full songs yet. Learn your first song start to finish.'};
    const sw={learning:.3,solid:1,mastered:1.5}, dw={easy:1,medium:2,hard:3};
    const score=real.reduce((a,s)=>a+(sw[s.status]||0)*(dw[s.difficulty]||1),0);
    const level=U.clamp(Math.round(1+Math.sqrt(score)*1.5),1,10);
    const learning=real.filter(s=>s.status==='learning');
    const solid=real.filter(s=>s.status!=='learning');
    let edge;
    if(!solid.length) edge=`Bring “${learning[0].title}” to solid: play it start to finish without stopping.`;
    else if(learning.length) edge=`Bring “${learning[0].title}” from learning to solid.`;
    else edge='Add a song one step harder than your current hardest.';
    return {level,edge};
  }
};

/* ---------------------------- ProfileBuilder --------------------------- */
const GOAL_DOMAINS = {songs:['repertoire','fretting'],improv:['improv','fretboard'],write:['theory','improv'],band:['rhythm','repertoire'],theory:['theory','fretboard'],ear:['ear'],speed:['picking','fretting'],fretboard:['fretboard'],perform:['repertoire','rhythm'],record:['rhythm','picking']};
const REVIEW_VARIATION = {fretting:'+5 BPM or a new chord pair',picking:'+5 BPM',rhythm:'faster tempo or a new subdivision',fretboard:'new string set, timed',theory:'apply it in a new key',ear:'no replays, faster answers',improv:'new key or new backing'};
const THEORY_TOPIC_CONCEPT = {notes:'Note names on the fretboard',intervals:'Intervals',major:'Major scale',penta:'Pentatonic scales',chords:'Chord construction',keys:'Keys & key signatures',modes:'Modes'};

const ProfileBuilder = {
  build(p){
    const q=p.questionnaire, today=U.today();
    const pri=Leveling.priors(q); p.assessment.priors=pri; p.assessment.date=today;
    const results={};
    for(const d of DOMAINS){
      if(d.key==='repertoire'){
        const r=Leveling.repertoire(p.repertoire,pri.repertoire);
        p.domains.repertoire={level:r.level,edge:r.edge,basis:'song list',prior:pri.repertoire,kind:null};
        continue;
      }
      const ds=p.assessment.domains[d.key]||{tests:[]};
      const r=Leveling.fromTests(ds.tests); results[d.key]=r;
      const level=r?U.clamp(Math.round(.2*pri[d.key]+.8*r.level),1,10):U.clamp(Math.round(pri[d.key]),1,10);
      p.domains[d.key]={level,edge:Leveling.edgeNote(d.key,r),basis:r?'tested':'estimated',prior:pri[d.key],kind:r?r.kind:null,edgeTestId:r?r.rec.id:null};
    }
    p.activeExercises=this.exercises(p,results,pri);
    p.reviewQueue=this.review(p,today);
    p.theory=this.theory(p,results.theory);
    p.weaknesses=this.weaknesses(p);
    p.focus=this.focus(p);
    const lv=DOMAINS.map(d=>`${d.short} ${p.domains[d.key].level}`).join(', ');
    p.sessionLog=(p.sessionLog||[]).filter(s=>s.focus!=='Onboarding assessment'||s.date!==today);
    p.sessionLog.push({date:today,focus:'Onboarding assessment',result:`Levels: ${lv}. First focus: ${DOMAIN_BY_KEY[p.focus.domain].name}.`});
    p.meta.updated=today;
    return p;
  },
  exercises(p,results,pri){
    const out=[];
    for(const d of DOMAINS){
      if(d.key==='repertoire') continue;
      const r=results[d.key]; let test, last='not yet tested', current='—';
      if(!r){test=Assessment.startingTest(d.key,pri[d.key])}
      else if(r.kind==='above'){
        test=testsFor(d.key).find(t=>t.level>r.rec.level&&!(p.assessment.domains[d.key].tests||[]).some(x=>x.id===t.id))||TEST_BY_ID[r.rec.id];
        if(test.id===r.rec.id){last=r.rec.display}
      } else {test=TEST_BY_ID[r.rec.id]; last=r.rec.display}
      if(r&&test.id===r.rec.id&&test.type==='play'&&test.input.type!=='rating') current=r.rec.raw!=null?String(r.rec.raw)+(test.input.type==='bpm'?' BPM':''):'—';
      const target=test.type==='quiz'?'≥ 90% correct':test.input.type==='rating'?'5/5 self-rating':test.input.type==='bpm'?`${test.input.target} BPM`:`${test.input.target} ${test.input.unit}`;
      let next;
      if(!r) next='Get a baseline in your first session.';
      else if(r.kind==='below') next=`Simplify first: ${test.simplify||(test.type==='quiz'?'drill the missed items in sets of 3–4, then retake':'slow down and isolate the hardest move')}.`;
      else if(test.type==='quiz') next=`Score ≥ 90% in 2 separate sessions, then: ${test.nextStep}`;
      else if(test.input.type==='bpm') next='Hit the target in 2 separate sessions, then raise it 3–5 BPM.';
      else if(test.input.type==='count') next='Hit the target in 2 separate sessions, then raise the tempo 3–5 BPM.';
      else next=`Rate 5/5 in 2 separate sessions, then: ${test.nextStep}`;
      out.push({id:U.uid(),domain:d.key,testId:test.id,name:test.name,current,target,lastResult:last,nextStep:next});
    }
    return out;
  },
  review(p,today){
    const items=[]; let n=1;
    for(const d of DOMAINS){
      const ds=p.assessment.domains[d.key]; if(!ds||!ds.tests) continue;
      ds.tests.filter(t=>t.score>=.9).forEach(t=>{
        items.push({id:U.uid(),skill:t.name,domain:d.key,variation:REVIEW_VARIATION[d.key]||'harder variation',lastReviewed:today,nextReview:U.addDays(today,Math.min(n,6)),intervalDays:2});n++;
      });
    }
    if(!items.length&&p.questionnaire.chords.length) items.push({id:U.uid(),skill:'Known chord shapes: change speed',domain:'fretting',variation:'1-minute changes, new pairs',lastReviewed:today,nextReview:U.addDays(today,2),intervalDays:2});
    return items.slice(0,8);
  },
  theory(p,r){
    const q=p.questionnaire, learned=[];
    OPT.theoryTopics.forEach(([id])=>{if((q.theory[id]||0)>=2) learned.push(THEORY_TOPIC_CONCEPT[id])});
    const ds=p.assessment.domains.theory;
    if(ds) ds.tests.filter(t=>t.score>=.7).forEach(t=>{const c=TEST_BY_ID[t.id].concept;if(c)learned.push(c)});
    let next;
    if(!r){const gap=OPT.theoryTopics.find(([id])=>(q.theory[id]||0)<2);next=gap?THEORY_TOPIC_CONCEPT[gap[0]]:'Modal interchange'}
    else if(r.kind==='edge'||r.kind==='above') next=TEST_BY_ID[r.rec.id].nextStep;
    else next=TEST_BY_ID[r.rec.id].concept;
    return {learned:[...new Set(learned)],next};
  },
  weaknesses(p){
    const q=p.questionnaire, w=q.struggles.map(id=>lab(OPT.struggles,id));
    if(q.strugglesOther.trim()) w.push(q.strugglesOther.trim());
    const lv=DOMAINS.map(d=>({d,l:p.domains[d.key].level})), max=Math.max(...lv.map(x=>x.l));
    lv.filter(x=>max-x.l>2).forEach(x=>w.push(`${x.d.name} lags ${max-x.l} levels behind your strongest area`));
    for(const d of DOMAINS){const ds=p.assessment.domains[d.key];if(ds&&ds.tests)ds.tests.filter(t=>t.score<.7).forEach(t=>w.push(`${t.name}: ${t.display} (target ${t.targetText})`))}
    return [...new Set(w)];
  },
  focus(p){
    const lv=DOMAINS.map(d=>({key:d.key,name:d.name,level:p.domains[d.key].level}));
    const max=Math.max(...lv.map(x=>x.level)), asc=(a,b)=>a.level-b.level;
    const lag=lv.filter(x=>max-x.level>2).sort(asc);
    if(lag.length) return {domain:lag[0].key,reason:`${lag[0].name} is ${max-lag[0].level} levels behind your strongest area, so the balance rule puts it first.`};
    const goals=p.questionnaire.goals; const gd=new Set(goals.flatMap(g=>GOAL_DOMAINS[g]||[]));
    const cand=lv.filter(x=>gd.has(x.key)).sort(asc);
    if(cand.length){
      const g=goals.find(g=>(GOAL_DOMAINS[g]||[]).includes(cand[0].key));
      return {domain:cand[0].key,reason:`It’s the lowest of the areas tied to your goal “${lab(OPT.goals,g)}”.`};
    }
    const low=[...lv].sort(asc)[0];
    return {domain:low.key,reason:'It’s your lowest domain right now.'};
  }
};

/* ------------------------------ ProfileText ---------------------------- */
const ProfileText = {
  render(p){
    const q=p.questionnaire, d=p.domains;
    const goals=[...q.goals.map(g=>lab(OPT.goals,g)),q.goalsOther.trim()].filter(Boolean).join('; ')||'—';
    const eq=q.equipment;
    const equip=[eq.guitar?lab(OPT.guitar,eq.guitar)+' guitar':'',eq.gear.map(g=>lab(OPT.gear,g)).join(', '),`metronome: ${eq.metronome==='yes'?'yes':'this app'}`,`looper: ${eq.looper||'no'}`,`DAW: ${eq.daw.trim()||'none'}`].filter(Boolean).join('; ');
    const L=k=>d[k]?d[k].level:'?', E=k=>d[k]?d[k].edge+(d[k].basis==='estimated'?' [estimated]':''):'';
    const songs=p.repertoire.filter(s=>s.title.trim()).map(s=>`${s.title.trim()} (${s.status}, ${s.difficulty})`).join('; ')||'none yet';
    const lines=[
      `PLAYER PROFILE — updated ${p.meta.updated}`,
      `Player: ${q.name||'—'} · Playing: ${lab(OPT.experience,q.experience)||'—'} · ${lab(OPT.learning,q.learning)||''}`.trim(),
      `Goals: ${goals}`,
      `Genres/artists: ${[q.genres.map(g=>GENRE_BY_ID[g]?GENRE_BY_ID[g].name:g).join(', '), q.players.map(p=>p.name).join(', '), (q.genresText||'').trim()].filter(Boolean).join(' — ')||'—'}`,
      ...(q.players.some(p=>p.style)?[`Player styles to learn from: ${q.players.filter(p=>p.style).map(p=>`${p.name} (${p.style})`).join('; ')}`]:[]),
      `Daily practice time: weekdays ${q.practice.weekday} min, weekends ${q.practice.weekend} min`,
      `Equipment: ${equip}`,
      `Domain levels (1–10) + notes:`,
      `- Fretting hand: ${L('fretting')} — current edge: ${E('fretting')}`,
      `- Picking hand: ${L('picking')} — current edge: ${E('picking')}`,
      `- Rhythm: ${L('rhythm')} — current edge: ${E('rhythm')}`,
      `- Fretboard: ${L('fretboard')} — current edge: ${E('fretboard')}`,
      `- Theory: ${L('theory')} — current edge: ${E('theory')}`,
      `- Ear: ${L('ear')} — current edge: ${E('ear')}`,
      `- Improv: ${L('improv')} — current edge: ${E('improv')}`,
      `- Repertoire: ${songs} — level ${L('repertoire')}; edge: ${E('repertoire')}`,
      `Active exercises (name | current BPM or target | last result | next step):`,
      ...(p.activeExercises.length?p.activeExercises.map(x=>`- ${x.name} | current ${x.current} → target ${x.target} | ${x.lastResult} | ${x.nextStep}`):['- none yet']),
      `Spaced-review queue (skill | last reviewed | next review date):`,
      ...(p.reviewQueue.length?p.reviewQueue.map(x=>`- ${x.skill} (${x.variation}) | ${x.lastReviewed} | ${x.nextReview}`):['- none yet']),
      `Theory concepts learned: ${p.theory.learned.join('; ')||'none yet'}`,
      `Next theory concept: ${p.theory.next||'—'}`,
      `Known weaknesses/habits to fix: ${p.weaknesses.join('; ')||'none reported'}`,
      ...((p.courses||[]).length?[`Open courses: ${p.courses.filter(c=>c.status!=='archived').map(c=>`${c.name} (${c.progress||0}%)`).join('; ')}`]:[]),
      `Recommended first focus: ${p.focus.domain?DOMAIN_BY_KEY[p.focus.domain].name+' — '+p.focus.reason:'—'}`,
      `Session log (last 7):`,
      ...(p.sessionLog.length?p.sessionLog.slice(-7).map(s=>`- ${s.date} — ${s.focus} — ${s.result}`):['- none yet'])
    ];
    return lines.join('\n');
  }
};

/* -------------------------------- Charts ------------------------------- */
const Charts = {
  radar(levels){
    const n=DOMAINS.length, cx=200, cy=175, R=118;
    const pt=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [cx+Math.cos(a)*R*v/10,cy+Math.sin(a)*R*v/10]};
    let s=`<svg class="radar" viewBox="0 0 400 350" role="img" aria-label="Domain levels radar chart">`;
    [2,4,6,8,10].forEach(v=>{s+=`<polygon points="${DOMAINS.map((_,i)=>pt(i,v).join(',')).join(' ')}" fill="none" stroke="#332e38" stroke-width="1"/>`});
    DOMAINS.forEach((d,i)=>{const [x,y]=pt(i,10);s+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#332e38"/>`});
    const poly=DOMAINS.map((d,i)=>pt(i,levels[d.key]||1).join(',')).join(' ');
    s+=`<polygon points="${poly}" fill="rgba(245,165,36,.25)" stroke="#f5a524" stroke-width="2.5" stroke-linejoin="round"/>`;
    DOMAINS.forEach((d,i)=>{
      const [x,y]=pt(i,levels[d.key]||1); s+=`<circle cx="${x}" cy="${y}" r="4.5" fill="#ffd27a"/>`;
      const [lx,ly]=pt(i,11.9); const anchor=Math.abs(lx-cx)<8?'middle':lx>cx?'start':'end';
      s+=`<text x="${lx}" y="${ly+4}" text-anchor="${anchor}" fill="#ece6da" font-size="13" font-family="Inter,sans-serif">${d.short} <tspan fill="#f5a524" font-weight="700">${levels[d.key]}</tspan></text>`;
    });
    return s+'</svg>';
  },
  bars(levels){
    return `<div>${DOMAINS.map(d=>`<div class="lv"><span>${d.short}</span><div class="bar"><i style="width:${levels[d.key]*10}%"></i></div><b>${levels[d.key]}</b></div>`).join('')}</div>`;
  }
};

export { DOMAINS, DOMAIN_BY_KEY, OPT, lab, Timer, CHORD_SHAPES, chordSVG, tabFrom, patternHTML, RUBRIC, TESTS, TEST_BY_ID, testsFor,
  QuizGen, buildQuiz, Assessment, Leveling, ProfileBuilder, ProfileText, Charts, GOAL_DOMAINS };
