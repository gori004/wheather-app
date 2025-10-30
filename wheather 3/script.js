/* Polished Weather Dashboard - Final version
   - Accent: Gradient Purple–Blue
   - Dynamic animated background changes based on condition
   - Favorites, recent, export/clear, Chart.js, geolocation, theme
   - Replace OPENWEATHER_API_KEY with your key
*/

const OPENWEATHER_API_KEY = "b02684a97fb4d1ec756c72d7e169d58d"; // <-- replace here
const RECENT_KEY = "pw.recent.v1";
const FAV_KEY = "pw.fav.v1";
const THEME_KEY = "pw.theme.v1";

//
// DOM refs
//
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const searchForm = document.getElementById('searchForm');
const locBtn = document.getElementById('locBtn');
const themeBtn = document.getElementById('themeBtn');

const currentCard = document.getElementById('currentCard');
const forecastContainer = document.getElementById('forecastContainer');
const recentList = document.getElementById('recentList');
const favList = document.getElementById('favList');
const clearRecentBtn = document.getElementById('clearRecent');
const exportRecentBtn = document.getElementById('exportRecent');
const detailsArea = document.getElementById('detailsArea');
const toast = document.getElementById('toast');

const tempChartCanvas = document.getElementById('tempChart');

const bgAnim = document.getElementById('bg-anim');

let recentCities = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
let favCities = JSON.parse(localStorage.getItem(FAV_KEY)) || [];
let tempChart = null;

//
// Utilities
//
function showToast(msg, timeout = 2000){
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(()=> toast.style.opacity = '0', timeout);
}
function saveRecent(){ localStorage.setItem(RECENT_KEY, JSON.stringify(recentCities)); }
function saveFav(){ localStorage.setItem(FAV_KEY, JSON.stringify(favCities)); }

function addRecent(city){
  city = city.trim();
  if(!city) return;
  recentCities = recentCities.filter(c => c.toLowerCase() !== city.toLowerCase());
  recentCities.push(city);
  if(recentCities.length > 12) recentCities.shift();
  saveRecent(); renderRecent();
}

function renderRecent(){
  recentList.innerHTML = '';
  [...recentCities].reverse().forEach(city => {
    const li = document.createElement('li');
    li.className = 'recent-item fade-in';
    li.innerHTML = `<span class="city">${escapeHtml(city)}</span><span class="muted tiny">Load</span>`;
    li.onclick = ()=> fetchWeatherByCity(city);
    recentList.appendChild(li);
  });
  renderFav();
}

function renderFav(){
  favList.innerHTML = '';
  favCities.forEach(city => {
    const li = document.createElement('li');
    li.className = 'fav-item fade-in';
    li.innerHTML = `<span class="city">${escapeHtml(city)}</span>
      <div>
        <button class="btn ghost" title="Load">Load</button>
        <button class="btn ghost" title="Remove">✖</button>
      </div>`;
    li.querySelector('button[title="Load"]').onclick = ()=> fetchWeatherByCity(city);
    li.querySelector('button[title="Remove"]').onclick = ()=> {
      if(!confirm(`Remove ${city} from favorites?`)) return;
      favCities = favCities.filter(c => c !== city);
      saveFav(); renderFav();
    };
    favList.appendChild(li);
  });
}

function escapeHtml(s=''){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

//
// Fetchers
//
async function fetchWeatherByCity(city){
  if(!city) return showToast('Enter a city name');
  cityInput.value = city;
  try {
    showLoading();
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const fUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    const [curRes, fRes] = await Promise.all([fetch(curUrl), fetch(fUrl)]);
    const cur = await curRes.json(); const f = await fRes.json();

    if(cur.cod !== 200){ showError(`City not found: ${escapeHtml(city)}`); return; }

    displayCurrent(cur);
    displayForecast(f);
    drawChart(f);
    displayDetails(cur);
    addRecent(cur.name);
  } catch(e){
    console.error(e);
    showError('Network/API error. See console.');
  }
}

async function fetchWeatherByCoords(lat, lon){
  try {
    showLoading();
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const fUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const [curRes, fRes] = await Promise.all([fetch(curUrl), fetch(fUrl)]);
    const cur = await curRes.json(); const f = await fRes.json();
    if(cur.cod !== 200){ showError('Unable to fetch location weather'); return; }
    displayCurrent(cur); displayForecast(f); drawChart(f); displayDetails(cur);
    addRecent(cur.name);
  } catch(e){
    console.error(e); showError('Error fetching by coords');
  }
}

//
// UI helpers
//
function showLoading(){
  currentCard.innerHTML = `<div class="placeholder">Loading weather... <span class="muted tiny">If it takes long, check API key</span></div>`;
  forecastContainer.innerHTML = '';
  detailsArea.innerHTML = '';
}

function showError(msg){
  currentCard.innerHTML = `<div class="placeholder">⚠️ ${escapeHtml(msg)}</div>`;
  detailsArea.innerHTML = `<p class="muted tiny">${escapeHtml(msg)}</p>`;
  forecastContainer.innerHTML = '';
  showToast(msg);
}

function displayCurrent(data){
  const icon = data.weather?.[0]?.icon || '01d';
  const desc = data.weather?.[0]?.description || '';
  currentCard.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center">
      <div class="icon"><img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="icon"></div>
      <div class="meta">
        <h2>${escapeHtml(data.name)}, ${escapeHtml(data.sys?.country || '')}</h2>
        <p class="muted">${escapeHtml(desc)}</p>
        <p style="font-size:1.6rem;font-weight:700">${Math.round(data.main.temp)}°C</p>
        <div class="tiny muted">Feels like ${Math.round(data.main.feels_like)}°C • Humidity ${data.main.humidity}%</div>
        <div style="margin-top:8px">
          <button class="btn ghost" id="favBtn">${favCities.includes(data.name) ? '★ Favorited' : '☆ Add Favorite'}</button>
        </div>
      </div>
    </div>
  `;
  const favBtn = document.getElementById('favBtn');
  favBtn.onclick = () => {
    if(favCities.includes(data.name)){
      favCities = favCities.filter(c => c !== data.name);
      showToast('Removed from favorites');
    } else {
      favCities.push(data.name); showToast('Added to favorites');
    }
    saveFav(); renderFav(); // update lists
    displayCurrent(data); // update button label
  };

  // adjust background visual based on condition
  setBgForWeather(data.weather?.[0]?.main || 'Clear');
}

function displayForecast(forecastData){
  forecastContainer.innerHTML = '';
  if(!forecastData || !Array.isArray(forecastData.list)) return;

  // choose midday entries (12:00:00) if available
  const days = {};
  forecastData.list.forEach(item => {
    const date = item.dt_txt.split(' ')[0];
    if(!days[date] || item.dt_txt.includes('12:00:00')) days[date] = item;
  });

  const entries = Object.values(days).slice(0,5);
  entries.forEach(d => {
    const dateStr = new Date(d.dt_txt).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    const icon = d.weather?.[0]?.icon || '01d';
    const temp = Math.round(d.main.temp);
    const desc = d.weather?.[0]?.main || '';
    const card = document.createElement('div');
    card.className = 'forecast-card fade-in';
    card.innerHTML = `<div class="day">${dateStr}</div>
                      <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}">
                      <div style="font-weight:700">${temp}°C</div>
                      <div class="muted tiny">${escapeHtml(desc)}</div>`;
    card.onclick = ()=> showDayDetails(d);
    forecastContainer.appendChild(card);
  });
}

function displayDetails(cur){
  detailsArea.innerHTML = `
    <div class="tiny">Wind: ${cur.wind?.speed ?? '-'} m/s</div>
    <div class="tiny">Pressure: ${cur.main?.pressure ?? '-'} hPa</div>
    <div class="tiny">Clouds: ${cur.clouds?.all ?? '-'}%</div>
    <div class="tiny">Sunrise: ${new Date(cur.sys.sunrise*1000).toLocaleTimeString()}</div>
    <div class="tiny">Sunset: ${new Date(cur.sys.sunset*1000).toLocaleTimeString()}</div>
  `;
}

function showDayDetails(dayEntry){
  const date = new Date(dayEntry.dt_txt).toLocaleString();
  detailsArea.innerHTML = `
    <div><strong>${date}</strong></div>
    <div class="tiny">Temp: ${Math.round(dayEntry.main.temp)}°C</div>
    <div class="tiny">Min/Max: ${Math.round(dayEntry.main.temp_min)}°C / ${Math.round(dayEntry.main.temp_max)}°C</div>
    <div class="tiny">Condition: ${escapeHtml(dayEntry.weather[0].description)}</div>
    <div class="tiny">Wind: ${dayEntry.wind.speed} m/s</div>
  `;
  showToast('Showing day details', 1200);
}

//
// Chart
//
function drawChart(forecastData){
  if(!forecastData || !Array.isArray(forecastData.list)) return;
  const daily = [];
  const used = new Set();
  forecastData.list.forEach(item => {
    const date = item.dt_txt.split(' ')[0];
    if(!used.has(date) && item.dt_txt.includes('12:00:00')){
      daily.push(item); used.add(date);
    }
  });
  if(daily.length < 5){
    const map = {};
    for(let it of forecastData.list){
      const date = it.dt_txt.split(' ')[0];
      if(!map[date]) map[date] = it;
    }
    daily.splice(0, daily.length, ...Object.values(map).slice(0,5));
  } else daily.splice(5);

  const labels = daily.map(d => new Date(d.dt_txt).toLocaleDateString(undefined,{weekday:'short'}));
  const temps = daily.map(d => Math.round(d.main.temp));

  if(tempChart) tempChart.destroy();
  tempChart = new Chart(tempChartCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '°C',
        data: temps,
        borderColor: 'rgba(124,58,237,0.95)',
        backgroundColor: 'rgba(99,102,241,0.12)',
        tension: 0.35,
        fill: true,
        pointRadius: 4,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ y: { beginAtZero:false } }
    }
  });
}

//
// background animation mapping
//
function setBgForWeather(main){
  main = (main || '').toLowerCase();
  // default gradient
  let g = `linear-gradient(120deg, var(--accent-from), var(--accent-to))`;
  if(main.includes('cloud')) g = `linear-gradient(120deg,#4b5563,#1f2937)`;
  if(main.includes('rain') || main.includes('drizzle')) g = `linear-gradient(120deg,#0f172a,#334155)`;
  if(main.includes('clear')) g = `linear-gradient(120deg,#f97316,#ffd166)`;
  if(main.includes('snow')) g = `linear-gradient(120deg,#c7f9cc,#bde0fe)`;
  bgAnim.style.background = g;
  bgAnim.style.opacity = '0.08';
}

//
// geolocation
//
locBtn.addEventListener('click', ()=> {
  if(!navigator.geolocation) return showToast('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude, longitude} = pos.coords; fetchWeatherByCoords(latitude, longitude);
  }, ()=> showToast('Location denied'));
});

//
// search handling
//
searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if(!city) return showToast('Type a city name');
  fetchWeatherByCity(city);
  cityInput.blur();
});

cityInput.addEventListener('keyup', e => { if(e.key === 'Escape') cityInput.value=''; });

//
// recent actions
//
clearRecentBtn.addEventListener('click', ()=> {
  if(!confirm('Clear recent searches?')) return;
  recentCities = []; saveRecent(); renderRecent();
});
exportRecentBtn.addEventListener('click', ()=> {
  const blob = new Blob([JSON.stringify(recentCities, null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'pw-recent-cities.json'; a.click(); URL.revokeObjectURL(url);
});

//
// theme toggle
//
themeBtn.addEventListener('click', ()=> {
  document.body.classList.toggle('light');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('light') ? 'light':'dark');
});
if(localStorage.getItem(THEME_KEY) === 'light') document.body.classList.add('light');

//
// favorites quick-add (via button in current card) handled in displayCurrent
//

//
// helpers: fetch by coords
//
async function fetchWeatherByCoords(lat, lon){
  try {
    showLoading();
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const fUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const [curRes, fRes] = await Promise.all([fetch(curUrl), fetch(fUrl)]);
    const cur = await curRes.json(); const f = await fRes.json();
    if(cur.cod !== 200) return showError('Unable to get location weather');
    displayCurrent(cur); displayForecast(f); drawChart(f); displayDetails(cur); addRecent(cur.name);
  } catch(e){ console.error(e); showError('Network/API error'); }
}

//
// init
//
function init(){
  renderRecent();
  renderFav();
  // load last city if exists
  if(recentCities.length) fetchWeatherByCity(recentCities[recentCities.length-1]);
}
init();
