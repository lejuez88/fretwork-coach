// Song catalog for offline recommendations: real songs by genre with an
// approximate difficulty (1–10) and the techniques they teach. Only titles and
// metadata live here (no lyrics, no tabs). With an API key, Claude recommends
// beyond this list and fills in tempo, key and tuning.

// [title, artist, genres, difficulty, techniques, wikiTitle?]
const S = [
  // Blues
  ['Hoochie Coochie Man', 'Muddy Waters', ['blues'], 2, ['stop-time riff', 'single-note riff', 'shuffle feel'], 'Hoochie Coochie Man'],
  ['Sweet Home Chicago', 'Robert Johnson', ['blues'], 3, ['12-bar blues', 'shuffle rhythm', 'boogie pattern'], 'Sweet Home Chicago'],
  ['Born Under a Bad Sign', 'Albert King', ['blues'], 4, ['riff in octaves', 'bends', 'minor pentatonic'], 'Born Under a Bad Sign (song)'],
  ['The Thrill Is Gone', 'B.B. King', ['blues'], 5, ['bends', 'vibrato', 'minor blues phrasing'], 'The Thrill Is Gone'],
  ['Pride and Joy', 'Stevie Ray Vaughan', ['blues'], 7, ['Texas shuffle', 'rhythm and lead together', 'string raking'], 'Pride and Joy (Stevie Ray Vaughan song)'],
  ['Red House', 'Jimi Hendrix', ['blues', 'classic-rock'], 7, ['slow blues', 'wide bends', 'double-stops'], 'Red House (song)'],
  ['Crossroads', 'Cream', ['blues', 'classic-rock'], 7, ['fast pentatonic lines', 'shuffle riff', 'soloing over changes'], 'Crossroads (Cream song)'],
  // Classic rock
  ['Wild Thing', 'The Troggs', ['classic-rock', 'rock'], 1, ['open chords A–D–E', 'strumming'], 'Wild Thing (The Troggs song)'],
  ['Smoke on the Water', 'Deep Purple', ['classic-rock', 'rock'], 2, ['double-stop riff in fourths', 'palm muting'], 'Smoke on the Water'],
  ['Sunshine of Your Love', 'Cream', ['classic-rock', 'blues'], 3, ['single-note riff', 'bends', 'blues scale'], 'Sunshine of Your Love'],
  ['Whole Lotta Love', 'Led Zeppelin', ['classic-rock', 'rock'], 3, ['single-string riff', 'bends', 'muted strums'], 'Whole Lotta Love'],
  ['Johnny B. Goode', 'Chuck Berry', ['classic-rock', 'rock'], 6, ['double-stop licks', 'boogie rhythm', 'fast bends'], 'Johnny B. Goode'],
  ['Stairway to Heaven', 'Led Zeppelin', ['classic-rock', 'folk'], 7, ['fingerpicked arpeggios', 'chord transitions', 'pentatonic solo'], 'Stairway to Heaven'],
  ['Comfortably Numb', 'Pink Floyd', ['classic-rock', 'prog'], 7, ['melodic soloing', 'expressive bends', 'vibrato'], 'Comfortably Numb'],
  ['Hotel California', 'Eagles', ['classic-rock', 'rock'], 8, ['capo arpeggios', 'harmonized lead', 'bends'], 'Hotel California'],
  // Rock
  ['Seven Nation Army', 'The White Stripes', ['rock', 'indie'], 1, ['single-note riff', 'slides', 'power chords'], 'Seven Nation Army'],
  ['Smells Like Teen Spirit', 'Nirvana', ['rock', 'punk'], 3, ['power chords', 'muted strums', 'loud/quiet dynamics'], 'Smells Like Teen Spirit'],
  ['Highway to Hell', 'AC/DC', ['rock', 'classic-rock'], 3, ['open-chord riffs', 'tight rhythm', 'palm muting'], 'Highway to Hell (song)'],
  ['Back in Black', 'AC/DC', ['rock', 'classic-rock'], 5, ['open-chord riff', 'muting between chords', 'pentatonic fills'], 'Back in Black (song)'],
  ['Everlong', 'Foo Fighters', ['rock'], 5, ['Drop D', 'fast 8th-note strumming', 'drone voicings'], 'Everlong'],
  ['Under the Bridge', 'Red Hot Chili Peppers', ['rock', 'funk'], 7, ['chord embellishments', 'double-stops', 'arpeggiated chords'], 'Under the Bridge'],
  ['Sweet Child o\' Mine', 'Guns N\' Roses', ['rock'], 7, ['string-skipping arpeggio', 'half-step-down tuning', 'melodic soloing'], 'Sweet Child o\' Mine'],
  ['Eruption', 'Van Halen', ['rock', 'metal'], 10, ['two-hand tapping', 'speed picking', 'whammy'], 'Eruption (instrumental)'],
  // Metal
  ['Paranoid', 'Black Sabbath', ['metal', 'classic-rock'], 3, ['fast power-chord riff', 'pentatonic solo'], 'Paranoid (Black Sabbath song)'],
  ['Iron Man', 'Black Sabbath', ['metal', 'classic-rock'], 3, ['power-chord riff', 'bends', 'muted gallop'], 'Iron Man (song)'],
  ['Breaking the Law', 'Judas Priest', ['metal'], 3, ['single-note riff', 'power chords', 'palm muting'], 'Breaking the Law'],
  ['Enter Sandman', 'Metallica', ['metal'], 4, ['palm-muted riff', 'downpicking', 'tremolo picking'], 'Enter Sandman'],
  ['The Trooper', 'Iron Maiden', ['metal'], 6, ['galloping rhythm', 'harmony leads', 'hammer-on riffs'], 'The Trooper (song)'],
  ['Crazy Train', 'Ozzy Osbourne', ['metal', 'rock'], 7, ['palm-muted riff', 'fast alternate picking', 'neoclassical lead'], 'Crazy Train'],
  ['Master of Puppets', 'Metallica', ['metal'], 8, ['downpicking endurance', 'chromatic riffs', 'fast leads'], 'Master of Puppets (song)'],
  // Punk
  ['Blitzkrieg Bop', 'Ramones', ['punk'], 2, ['downstroke power chords', 'endurance'], 'Blitzkrieg Bop'],
  ['Should I Stay or Should I Go', 'The Clash', ['punk', 'rock'], 2, ['open-chord riff', 'tempo change'], 'Should I Stay or Should I Go'],
  ['All the Small Things', 'Blink-182', ['punk', 'pop'], 2, ['power chords', 'palm muting', 'single-note intro'], 'All the Small Things'],
  ['London Calling', 'The Clash', ['punk'], 3, ['open-chord stabs', 'muted strums'], 'London Calling (song)'],
  ['Basket Case', 'Green Day', ['punk'], 3, ['palm-muted power chords', 'fast changes'], 'Basket Case (song)'],
  ['American Idiot', 'Green Day', ['punk', 'rock'], 3, ['power chords', 'tight 8ths', 'palm muting'], 'American Idiot (song)'],
  // Indie & alternative
  ['Creep', 'Radiohead', ['indie', 'rock'], 3, ['G–B–C–Cm changes', 'muted chunks', 'arpeggios'], 'Creep (Radiohead song)'],
  ['Mr. Brightside', 'The Killers', ['indie', 'rock'], 3, ['8th-note picking', 'palm muting', 'power chords'], 'Mr. Brightside'],
  ['Last Nite', 'The Strokes', ['indie', 'rock'], 4, ['tight 8th-note strumming', 'two-guitar interplay'], 'Last Nite'],
  ['Karma Police', 'Radiohead', ['indie'], 4, ['open-chord voicings', 'strumming dynamics'], 'Karma Police'],
  ['Take Me Out', 'Franz Ferdinand', ['indie', 'rock'], 4, ['single-note riff', 'muted 8ths', 'tempo change'], 'Take Me Out (song)'],
  ['This Charming Man', 'The Smiths', ['indie'], 7, ['jangle arpeggios', 'open-string voicings', 'capo'], 'This Charming Man'],
  ['Paranoid Android', 'Radiohead', ['indie', 'prog'], 7, ['odd meters', 'arpeggiated chords', 'aggressive lead'], 'Paranoid Android'],
  // Pop & singer-songwriter
  ['Knockin\' on Heaven\'s Door', 'Bob Dylan', ['pop', 'folk'], 1, ['open chords G–D–Am–C', 'strumming'], 'Knockin\' on Heaven\'s Door'],
  ['Let It Be', 'The Beatles', ['pop', 'classic-rock'], 2, ['C–G–Am–F changes', 'piano-style strumming'], 'Let It Be (song)'],
  ['Wonderwall', 'Oasis', ['pop', 'rock'], 2, ['capo', 'sus chords', '16th strumming pattern'], 'Wonderwall (song)'],
  ['Free Fallin\'', 'Tom Petty', ['pop', 'rock'], 2, ['capo', 'sus chords', 'steady strumming'], 'Free Fallin\''],
  ['Perfect', 'Ed Sheeran', ['pop'], 3, ['capo', '6/8 strumming', 'open chords'], 'Perfect (Ed Sheeran song)'],
  ['Wish You Were Here', 'Pink Floyd', ['pop', 'classic-rock'], 4, ['intro riff with hammer-ons', 'open-chord strumming'], 'Wish You Were Here (Pink Floyd song)'],
  ['Hey There Delilah', 'Plain White T\'s', ['pop'], 4, ['fingerpicked pattern', 'open chords'], 'Hey There Delilah'],
  ['Fast Car', 'Tracy Chapman', ['pop', 'folk'], 5, ['capo', 'arpeggiated riff', 'fingerpicking'], 'Fast Car'],
  // Funk
  ['Superstition', 'Stevie Wonder', ['funk', 'neosoul'], 4, ['16th-note riff', 'muting', 'syncopation'], 'Superstition (song)'],
  ['Play That Funky Music', 'Wild Cherry', ['funk'], 4, ['single-note riff', 'chord stabs', '16th feel'], 'Play That Funky Music'],
  ['Cissy Strut', 'The Meters', ['funk'], 5, ['syncopated single-note riff', 'pocket'], 'Cissy Strut'],
  ['Give It Away', 'Red Hot Chili Peppers', ['funk', 'rock'], 5, ['muted 16ths', 'single-note grooves'], 'Give It Away (Red Hot Chili Peppers song)'],
  ['Le Freak', 'Chic', ['funk'], 6, ['16th-note chord chops', 'muted scratch', 'endurance'], 'Le Freak'],
  ['Get Lucky', 'Daft Punk', ['funk', 'pop'], 6, ['16th-note rhythm', 'chord voicings on top strings'], 'Get Lucky (Daft Punk song)'],
  // Neo-soul & R&B
  ['Ain\'t No Sunshine', 'Bill Withers', ['neosoul'], 2, ['minor pentatonic', 'Am groove'], 'Ain\'t No Sunshine'],
  ['Lovely Day', 'Bill Withers', ['neosoul', 'pop'], 3, ['seventh chords', 'syncopated strum'], 'Lovely Day'],
  ['People Get Ready', 'The Impressions', ['neosoul'], 4, ['thumb-and-finger chord melody', 'major-key embellishments'], 'People Get Ready'],
  ['Move On Up', 'Curtis Mayfield', ['neosoul', 'funk'], 5, ['16th-note rhythm', 'sevenths', 'endurance'], 'Move On Up'],
  ['Isn\'t She Lovely', 'Stevie Wonder', ['neosoul', 'jazz'], 5, ['ii–V changes', 'seventh chords'], 'Isn\'t She Lovely'],
  ['Little Wing', 'Jimi Hendrix', ['neosoul', 'classic-rock'], 8, ['chord embellishments', 'double-stops', 'thumb-over chords'], 'Little Wing'],
  // Jazz
  ['So What', 'Miles Davis', ['jazz'], 4, ['Dorian mode', 'quartal voicings', 'modal improvising'], 'So What (Miles Davis composition)'],
  ['Fly Me to the Moon', 'Frank Sinatra', ['jazz', 'pop'], 4, ['ii–V–I progressions', 'shell voicings'], 'Fly Me to the Moon'],
  ['Autumn Leaves', 'Joseph Kosma', ['jazz'], 5, ['ii–V–I in major and minor', 'guide tones', 'comping'], 'Autumn Leaves (1945 song)'],
  ['Blue Bossa', 'Kenny Dorham', ['jazz', 'latin'], 5, ['bossa nova comping', 'minor ii–V', 'key change'], 'Blue Bossa'],
  ['Take Five', 'The Dave Brubeck Quartet', ['jazz'], 6, ['5/4 time', 'vamp comping'], 'Take Five'],
  ['All the Things You Are', 'Jerome Kern', ['jazz'], 7, ['moving key centres', 'arpeggios through changes'], 'All the Things You Are'],
  ['Four on Six', 'Wes Montgomery', ['jazz'], 9, ['octaves', 'bebop lines', 'fast changes'], 'Four on Six'],
  // Country
  ['Ring of Fire', 'Johnny Cash', ['country'], 2, ['open chords', 'boom-chicka strum'], 'Ring of Fire (song)'],
  ['Folsom Prison Blues', 'Johnny Cash', ['country'], 3, ['boom-chicka bass and strum', 'single-note intro lick'], 'Folsom Prison Blues'],
  ['Jolene', 'Dolly Parton', ['country', 'folk'], 3, ['capo', 'fingerpicked minor pattern'], 'Jolene (song)'],
  ['Tennessee Whiskey', 'Chris Stapleton', ['country', 'blues'], 3, ['6/8 feel', 'two-chord vamp', 'bluesy fills'], 'Tennessee Whiskey'],
  ['Workin\' Man Blues', 'Merle Haggard', ['country'], 6, ['chicken pickin\'', 'hybrid picking', 'double-stops'], 'Workin\' Man Blues'],
  // Folk & acoustic
  ['Blowin\' in the Wind', 'Bob Dylan', ['folk', 'pop'], 1, ['open chords', 'simple strumming'], 'Blowin\' in the Wind'],
  ['The House of the Rising Sun', 'The Animals', ['folk', 'classic-rock'], 3, ['arpeggiated minor chords', '6/8 feel'], 'The House of the Rising Sun'],
  ['Blackbird', 'The Beatles', ['folk', 'fingerstyle'], 6, ['fingerpicked tenths', 'thumb-and-finger pinches'], 'Blackbird (Beatles song)'],
  ['Dust in the Wind', 'Kansas', ['folk', 'fingerstyle'], 6, ['Travis picking', 'chord embellishments'], 'Dust in the Wind'],
  ['The Boxer', 'Simon & Garfunkel', ['folk'], 6, ['Travis picking', 'alternating bass'], 'The Boxer'],
  ['Fire and Rain', 'James Taylor', ['folk', 'pop'], 6, ['fingerpicked accompaniment', 'sus and add9 chords'], 'Fire and Rain (song)'],
  // Fingerstyle & classical
  ['Spanish Romance', 'Anonymous', ['fingerstyle', 'latin'], 5, ['classical arpeggios', 'melody on top of arpeggios', 'barre chords'], 'Spanish Romance'],
  ['Lágrima', 'Francisco Tárrega', ['fingerstyle'], 6, ['melody and bass', 'major/minor contrast', 'rest strokes'], 'Lágrima'],
  ['Classical Gas', 'Mason Williams', ['fingerstyle'], 8, ['flatpicked arpeggios', 'position shifts', 'tremolo-like runs'], 'Classical Gas'],
  ['Asturias (Leyenda)', 'Isaac Albéniz', ['fingerstyle', 'latin'], 8, ['p–i alternation', 'pedal tones', 'fast arpeggios'], 'Asturias (Leyenda)'],
  // Progressive & math
  ['Money', 'Pink Floyd', ['prog', 'classic-rock'], 5, ['7/4 riff', 'bluesy soloing in 4/4'], 'Money (Pink Floyd song)'],
  ['Tom Sawyer', 'Rush', ['prog', 'rock'], 6, ['odd-meter sections', 'syncopated riffs'], 'Tom Sawyer'],
  ['Pull Me Under', 'Dream Theater', ['prog', 'metal'], 7, ['palm-muted riffs', 'odd phrasing', 'fast lead'], 'Pull Me Under'],
  ['Schism', 'Tool', ['prog', 'metal'], 8, ['Drop D', 'shifting meters', 'harmonics'], 'Schism (song)'],
  ['Playing God', 'Polyphia', ['prog'], 10, ['hybrid picking', 'tapping', 'nylon-string runs'], 'Playing God (song)'],
  // J-Rock & anime
  ['Blue Bird', 'Ikimono-gakari', ['jrock', 'pop'], 4, ['power chords', 'fast changes', 'melodic fills'], 'Blue Bird (Ikimono-gakari song)'],
  ['Again', 'Yui', ['jrock'], 4, ['palm-muted 8ths', 'power chords'], 'Again (Yui song)'],
  ['Silhouette', 'Kana-Boon', ['jrock'], 5, ['fast 8th-note strumming', 'single-note riffs'], 'Silhouette (Kana-Boon song)'],
  ['Seishun Complex', 'Kessoku Band', ['jrock'], 6, ['fast power chords', 'lead riffs', 'palm muting'], 'Bocchi the Rock!'],
  ['Gurenge', 'LiSA', ['jrock', 'metal'], 7, ['fast palm-muted riffs', 'syncopated stabs', 'melodic lead'], 'Gurenge'],
  ['Unravel', 'TK from Ling Tosite Sigure', ['jrock', 'prog'], 8, ['fast arpeggios', 'odd accents', 'dynamics'], 'Unravel (TK song)'],
  // Latin & flamenco
  ['La Bamba', 'Ritchie Valens', ['latin', 'classic-rock'], 2, ['three-chord riff', 'single-note melody'], 'La Bamba (song)'],
  ['Oye Como Va', 'Santana', ['latin'], 4, ['Am7–D9 groove', 'Dorian lead', 'sustain'], 'Oye Como Va'],
  ['Black Magic Woman', 'Santana', ['latin', 'blues'], 5, ['minor blues phrasing', 'bends', 'sustain'], 'Black Magic Woman'],
  ['Bamboleo', 'Gipsy Kings', ['latin'], 5, ['rumba strum', 'rasgueado accents'], 'Bamboleo (song)'],
  ['Europa (Earth\'s Cry Heaven\'s Smile)', 'Santana', ['latin', 'neosoul'], 6, ['long sustained bends', 'melodic phrasing'], 'Europa (Earth\'s Cry Heaven\'s Smile)'],
  ['Entre dos aguas', 'Paco de Lucía', ['latin', 'fingerstyle'], 9, ['picado', 'rumba rhythm', 'fast scale runs'], 'Entre dos aguas']
];

export const SONGS = S.map(([title, artist, genres, difficulty, techniques, wiki], i) => ({ id: 'cs' + i, title, artist, genres, difficulty, techniques, wikiTitle: wiki || title }));

const key = s => String(s || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '');

/** Find a catalog song by title (and artist, if given). */
export function songMatch(title, artist = '') {
  const t = key(title), a = key(artist);
  if (!t) return null;
  return SONGS.find(s => key(s.title) === t && (!a || key(s.artist) === a || key(s.artist).includes(a) || a.includes(key(s.artist))))
    || SONGS.find(s => key(s.title) === t) || null;
}

/** Wikipedia titles to try for a song's image: the song page, then the artist. */
export function songWikiTitles(song) {
  const t = song.title, a = song.artist;
  return [song.wikiTitle, a ? `${t} (${a} song)` : null, `${t} (song)`, t, a].filter((v, i, arr) => v && arr.indexOf(v) === i);
}
