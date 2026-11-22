import './style.css';
import { Game } from './game.js';
import { detectLanguage, setBlank, setLanguage } from './i18n/index.js';

const language = detectLanguage();
setLanguage(language);
// `?blank=1` empties every string: the game must still play (§11), and smoke proves it.
if (new URLSearchParams(location.search).get('blank') === '1') setBlank(true);
new Game(document.getElementById('app')!, language);
