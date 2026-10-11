import './styles.css'
import professorAvatar from './assets/professor-avatar.webp'
import { searchLiterature } from './services/literatureService.js'

const navItems = [
  { id: 'home', label: '首頁', icon: '⌂' },
  { id: 'research', label: '文獻研究中心', icon: '⌕' },
  { id: 'matrix', label: '文獻矩陣', icon: '▦' },
  { id: 'gap', label: 'Research Gap', icon: '◇' },
  { id: 'thesis', label: '我的論文', icon: '▤' },
  { id: 'settings', label: '設定', icon: '⚙' },
]

const state = { page: 'home', query: '', results: null, loading: false, selectedLanguages: [] }
const app = document.querySelector('#app')

function shell(content) {
  return `<div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#home" aria-label="博士論文 AI 研究室首頁">
        <span class="brand-mark">研</span><span class="brand-copy"><strong>博士論文</strong><small>AI 研究室</small></span>
      </a>
      <div class="workspace-label">研究工作區</div>
      <nav aria-label="主要導覽">${navItems.map(item => `<a class="nav-link ${state.page === item.id ? 'active' : ''}" href="#${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span>${item.id === 'research' ? '<span class="nav-current"></span>' : ''}</a>`).join('')}</nav>
      <div class="sidebar-bottom"><img class="profile-avatar" src="${professorAvatar}" alt="博士服頭像"><div><strong>我的研究工作區</strong><small>個人研究者</small></div><span class="more">···</span></div>
    </aside>
    <main class="main-area"><header class="topbar"><div class="breadcrumbs">研究工作區 <span>/</span> ${navItems.find(i => i.id === state.page)?.label}</div><div class="top-actions"><button class="icon-button" aria-label="說明">？</button><img class="top-avatar" src="${professorAvatar}" alt="博士服頭像"></div></header><div class="page-content">${content}</div></main>
  </div><nav class="mobile-nav" aria-label="手機主要導覽">${navItems.map(item => `<a class="${state.page === item.id ? 'active' : ''}" href="#${item.id}"><span>${item.icon}</span><small>${item.label}</small></a>`).join('')}</nav>`
}

function homePage() {
  return `<section class="welcome-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span> RESEARCH WORKSPACE</div><h1>讓研究思路，從這裡開始。</h1><p class="lead">把文獻探索、整理與研究問題，放進一個清晰的工作流程。</p></div><div class="date-chip">個人研究工作區 <span>⌄</span></div></section>
    <section class="hero-card"><div class="hero-copy"><span class="hero-kicker">AI 驅動的文獻研究與博士論文助手</span><h2>把研究問題，<br>一步步變成論文方向。</h2><p>從文獻搜尋開始，逐步整理研究證據、探索研究缺口。</p><a href="#research" class="button button-light">前往文獻研究中心 <span>→</span></a></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-core"><span>研</span></div><div class="art-node node-a">文獻</div><div class="art-node node-b">洞察</div><div class="art-node node-c">問題</div></div><div class="hero-index">01 <span>/ 06</span></div></section>
    <div class="section-heading"><div><div class="eyebrow">YOUR RESEARCH TOOLS</div><h2>研究工具</h2></div><span class="quiet-label">第一階段 · 文獻研究 MVP</span></div>
    <section class="tool-grid"><a class="tool-card featured" href="#research"><div class="tool-icon green">⌕</div><span class="card-arrow">↗</span><h3>文獻研究中心</h3><p>設定主題與年份範圍，開始建立你的文獻搜尋工作流程。</p><div class="tool-footer"><span class="status-dot"></span> 搜尋介面已就緒 <span class="footer-arrow">→</span></div></a><a class="tool-card" href="#matrix"><div class="tool-icon sand">▦</div><span class="card-arrow">↗</span><h3>文獻矩陣</h3><p>用結構化欄位整理與比較研究資料。</p><div class="tool-footer subdued">等待文獻資料 <span class="footer-arrow">→</span></div></a><a class="tool-card" href="#gap"><div class="tool-icon lilac">◇</div><span class="card-arrow">↗</span><h3>Research Gap</h3><p>預留研究趨勢、研究不足與問題建議的分析空間。</p><div class="tool-footer subdued">分析工作區已建立 <span class="footer-arrow">→</span></div></a></section>
    <section class="note-banner"><span class="note-icon">i</span><div><strong>從可靠來源開始</strong><p>目前尚未連接外部文獻資料庫，因此不會顯示或生成未驗證的論文資料。</p></div><a href="#settings">了解設定 <span>→</span></a></section>`
}

const languageOptions = [['zh', '中文'], ['en', 'English'], ['ja', '日本語'], ['other', '其他']]

function renderLanguageControls() {
  const selected = state.selectedLanguages
  const summary = selected.length ? `已選取：${selected.map(code => languageOptions.find(([value]) => value === code)?.[1]).join('、')}` : '目前不限語言'
  return `<div class="advanced-field language-multiselect"><span class="advanced-field-label">語言</span><label class="language-checkbox-option" for="language-unlimited"><input id="language-unlimited" type="checkbox" ${selected.length === 0 ? 'checked' : ''}>不限語言</label><div class="language-checkbox-list">${languageOptions.map(([value, label]) => `<label class="language-checkbox-option" for="language-${value}"><input id="language-${value}" type="checkbox" name="languages" value="${value}" ${selected.includes(value) ? 'checked' : ''}>${label}</label>`).join('')}</div><p class="language-selection-summary" id="language-selection-summary" aria-live="polite">${summary}</p></div>`
}

function updateLanguageSelection() {
  const unlimited = app.querySelector('#language-unlimited')
  const checks = [...app.querySelectorAll('input[name="languages"]')]
  checks.forEach(check => { check.checked = state.selectedLanguages.includes(check.value) })
  if (unlimited) unlimited.checked = state.selectedLanguages.length === 0
  const summary = app.querySelector('#language-selection-summary')
  if (summary) {
    const labels = state.selectedLanguages.map(code => languageOptions.find(([value]) => value === code)?.[1])
    summary.textContent = labels.length ? `已選取：${labels.join('、')}` : '目前不限語言'
  }
}

function bindLanguageControls() {
  app.querySelector('#language-unlimited')?.addEventListener('change', event => {
    if (event.currentTarget.checked) state.selectedLanguages = []
    updateLanguageSelection()
  })
  app.querySelectorAll('input[name="languages"]').forEach(check => check.addEventListener('change', event => {
    const { value, checked } = event.currentTarget
    state.selectedLanguages = checked
      ? [...new Set([...state.selectedLanguages, value])]
      : state.selectedLanguages.filter(language => language !== value)
    updateLanguageSelection()
  }))
}

function researchPage() {
  return `<div class="page-title-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span> LITERATURE WORKSPACE</div><h1>文獻研究中心</h1><p class="lead">設定研究範圍，集中探索與整理學術文獻。</p></div><span class="phase-badge"><span></span> MVP 工作區</span></div>
    <section class="search-panel"><div class="panel-heading"><div><span class="step-number">01</span><div><h2>定義搜尋範圍</h2><p>描述你的研究主題，並設定初步篩選條件。</p></div></div><span class="required-label">搜尋條件</span></div><form id="search-form"><label class="field-label" for="topic">研究主題 <span>必填</span></label><div class="topic-input-wrap"><span>⌕</span><input id="topic" name="topic" value="${escapeHtml(state.query)}" placeholder="例如：生成式 AI 對高等教育學習成效的影響" required minlength="3"><button class="clear-button" type="button" aria-label="清除主題">×</button></div><div class="filters"><div class="filter-field"><label class="field-label" for="year-from">發表年份</label><div class="year-range"><select id="year-from" name="yearFrom"><option>2019</option><option>2015</option><option>2010</option><option>2000</option></select><span>至</span><select id="year-to" name="yearTo"><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select></div></div><div class="filter-field"><label class="field-label" for="limit">文獻數量</label><div class="select-wrap"><select id="limit" name="limit"><option value="10">10 篇</option><option value="20">20 篇</option><option value="50">50 篇</option></select><span>⌄</span></div></div><div class="filter-field source-field"><span class="field-label">資料來源</span><div class="source-pills"><span>Crossref</span><span>Semantic Scholar</span><span>PubMed</span></div></div></div><details class="advanced-search"><summary>⚙️ 進階搜尋</summary><p class="advanced-search-note">目前 Worker 只套用關鍵字、年份、數量與語言；文獻類型、全文、排序及關鍵字邏輯尚未支援。</p><p class="advanced-search-note">繁簡只依來源明確提供的 zh-Hant／zh-Hans 標記判斷。Crossref 目前沒有足以可靠辨識台灣來源的標準化地區欄位，因此不會推測或套用台灣來源篩選。</p><div class="advanced-search-grid">${renderLanguageControls()}<div class="advanced-field"><label for="language-script">中文腳本</label><select id="language-script" name="languageScript"><option value="all">不限／未區分</option><option value="hant">繁體（來源明確標示）</option><option value="hans">簡體（來源明確標示）</option></select></div><div class="advanced-field"><label for="document-type">文獻類型</label><select id="document-type" name="documentType"><option value="all">全部</option><option value="journal-article">期刊論文</option><option value="proceedings-article">研討會論文</option><option value="review">Review / 系統性回顧</option><option value="thesis">學位論文</option><option value="book">書籍／書章</option></select></div><div class="advanced-field"><label for="full-text">全文</label><select id="full-text" name="fullText"><option value="all">全部</option><option value="available">有全文</option><option value="abstract-only">僅摘要</option></select></div><div class="advanced-field"><label for="sort-by">排序方式</label><select id="sort-by" name="sortBy"><option value="relevance">相關性</option><option value="newest">最新發表</option><option value="citations">引用次數</option></select></div><div class="advanced-field"><label for="keyword-logic">關鍵字邏輯</label><select id="keyword-logic" name="keywordLogic"><option value="AND">AND</option><option value="OR">OR</option></select></div></div></details><div class="form-actions"><p><span class="lock-icon">⌑</span> 搜尋將透過安全的 Worker API 處理</p><button class="button button-primary" type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? '正在搜尋…' : '開始搜尋'} <span>→</span></button></div></form></section>
    <section class="results-section"><div class="results-heading"><div><div class="eyebrow">SEARCH RESULTS</div><h2>搜尋結果</h2></div>${state.results?.status === 'not-configured' ? '<span class="result-count">尚未連接資料來源</span>' : ''}</div>${renderResults()}</section>`
}

function renderLiterature(item) {
  return `<article class="literature-card"><div class="literature-top"><span class="literature-status">${escapeHtml(item.statusLabel || '待確認')}</span><span class="literature-year">${escapeHtml(item.year || '年份待確認')}</span></div><h3>${escapeHtml(item.title || '未提供標題')}</h3><p class="literature-authors">${escapeHtml(item.authors || '作者待確認')}</p><div class="literature-meta"><span>${escapeHtml(item.source || '出版來源待確認')}</span><span>DOI：${escapeHtml(item.doi || '未提供')}</span></div><div class="literature-abstract"><strong>摘要</strong><p>${escapeHtml(item.abstract || '來源未提供摘要。')}</p></div>${item.url ? `<a class="text-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">開啟原始來源 <span>↗</span></a>` : '<span class="quiet-label">未提供原始來源連結</span>'}</article>`
}

const matrixColumns = ['作者', '年份', '研究主題', '研究目的', '研究方法', '研究對象', '研究結果', '研究限制', '研究來源']
function matrixPage() {
  return `<div class="page-title-row"><div><div class="eyebrow">EVIDENCE ORGANIZATION</div><h1>文獻矩陣</h1><p class="lead">以一致的欄位整理研究證據，為比較與分析做好準備。</p></div><span class="phase-badge muted"><span></span> 結構預留</span></div><section class="matrix-summary"><div><span class="summary-number">—</span><span>已整理文獻</span></div><div><span class="summary-number">9</span><span>分析欄位</span></div><p>連接資料來源後，可將已確認的文獻整理至矩陣。</p></section><section class="table-card"><div class="table-toolbar"><div><h2>研究資料矩陣</h2><p>欄位已建立，等待匯入文獻資料</p></div><button class="button button-outline" disabled>＋ 新增文獻</button></div><div class="table-scroll"><table><thead><tr>${matrixColumns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody><tr><td colspan="9"><div class="table-empty"><span>▦</span><strong>尚無文獻資料</strong><small>搜尋並確認文獻後，資料將整理於此。</small></div></td></tr></tbody></table></div></section>`
}

function gapPage() {
  const cards = [['研究主題分析','整理核心概念與研究範圍','01'],['研究趨勢','觀察研究主題與方法的發展','02'],['已有研究','歸納目前研究的主要發現','03'],['研究不足','辨識研究限制與尚未涵蓋之處','04'],['潛在 Research Gap','根據文獻證據提出待驗證的缺口','05'],['建議研究問題','將研究缺口轉化為可探究問題','06']]
  return `<div class="page-title-row"><div><div class="eyebrow">RESEARCH LANDSCAPE</div><h1>Research Gap</h1><p class="lead">以文獻證據為基礎，逐步描繪研究現況與可探索的問題。</p></div><span class="phase-badge muted"><span></span> 分析待啟用</span></div><div class="gap-callout"><span class="callout-mark">◇</span><div><strong>分析建立在文獻證據上</strong><p>加入已確認的研究文獻並連接分析服務後，才能產生有根據的趨勢與研究缺口分析。</p></div></div><section class="gap-grid">${cards.map(([title,desc,n]) => `<article class="gap-card"><div><span class="gap-number">${n}</span><span class="gap-state">待分析</span></div><h2>${title}</h2><p>${desc}</p><div class="gap-placeholder"><span>—</span><small>加入文獻資料後呈現</small></div></article>`).join('')}</section>`
}

function thesisPage() {
  return `<div class="page-title-row"><div><div class="eyebrow">THESIS WORKSPACE</div><h1>我的論文</h1><p class="lead">集中記錄論文方向與研究脈絡。</p></div><span class="phase-badge muted"><span></span> 後續階段</span></div><section class="placeholder-page"><div class="placeholder-symbol">▤</div><span class="empty-label">THESIS WORKSPACE</span><h2>論文工作區已預留</h2><p>本階段聚焦於 AI 文獻研究中心。論文計畫、章節管理與寫作工具會在後續階段規劃。</p><a class="text-link" href="#research">先從文獻研究開始 <span>→</span></a></section>`
}

function settingsPage() {
  return `<div class="page-title-row"><div><div class="eyebrow">WORKSPACE PREFERENCES</div><h1>設定</h1><p class="lead">管理工作區資訊與未來的 API 連線設定。</p></div></div><section class="settings-card"><div class="settings-card-head"><div><span class="settings-icon">⌘</span><div><h2>工作區</h2><p>基本研究工作區資訊</p></div></div></div><div class="setting-row"><div><strong>工作區名稱</strong><small>用於識別個人研究環境</small></div><span class="setting-value">我的研究工作區</span></div><div class="setting-row"><div><strong>介面語言</strong><small>目前介面顯示語言</small></div><span class="setting-value">繁體中文</span></div></section><section class="settings-card"><div class="settings-card-head"><div><span class="settings-icon api">⌁</span><div><h2>API 連線</h2><p>學術資料來源與分析服務</p></div></div><span class="connection-badge">未連線</span></div><div class="api-note"><span>i</span><p>前端僅連線至 Worker API。OpenAI 與學術資料來源的 API Key 必須由 Worker 的安全環境變數管理，請勿填入或提交至前端。</p></div><div class="setting-row"><div><strong>Cloudflare Worker</strong><small>設定 <code>VITE_API_BASE_URL</code> 指向 Worker 網址</small></div><span class="setting-value">尚未設定</span></div><div class="provider-list"><span>預留資料來源</span><b>Crossref</b><b>Semantic Scholar</b><b>PubMed</b></div></section><section class="settings-card compact-settings"><div class="settings-card-head"><div><span class="settings-icon">ⓘ</span><div><h2>目前版本</h2><p>博士論文 AI 研究室 · 文獻研究 MVP</p></div></div><span class="version-tag">v0.1.0</span></div></section>`
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function render() {
  const pages = { home: homePage, research: researchPage, matrix: matrixPage, gap: gapPage, thesis: thesisPage, settings: settingsPage }
  app.innerHTML = shell(pages[state.page]())
  app.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
    const page = link.getAttribute('href').slice(1)
    if (navItems.some(item => item.id === page)) { state.page = page; state.results = null; render() }
  }))
  bindLanguageControls()
  app.querySelector('#search-form')?.addEventListener('submit', onSearch)
  app.querySelector('.clear-button')?.addEventListener('click', () => { state.query = ''; render(); app.querySelector('#topic')?.focus() })
}

async function onSearch(event) {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  state.query = String(form.get('topic')).trim()
  state.loading = true
  render()
  try {
    state.results = await searchLiterature({
      query: state.query,
      yearFrom: Number(form.get('yearFrom')),
      yearTo: Number(form.get('yearTo')),
      limit: Number(form.get('limit')),
      languages: form.getAll('languages'),
      languageScript: form.get('languageScript'),
      documentType: form.get('documentType'),
      fullText: form.get('fullText'),
      sortBy: form.get('sortBy'),
      keywordLogic: form.get('keywordLogic'),
    })
  } catch (error) {
    state.results = { status: 'error', items: [], message: error instanceof Error ? error.message : '搜尋發生錯誤，請稍後再試。' }
  } finally {
    state.loading = false
    render()
  }
}

function renderResults() {
  const languageFilter = state.results?.languageFilter
  const languageLabels = { zh: '中文', en: '英文', ja: '日文', other: '其他' }
  const scriptLabels = { hant: '繁體中文（來源明確標示）', hans: '簡體中文（來源明確標示）' }
  const languageMetadata = state.results?.languageMetadata
  const selectedLanguageLabel = languageFilter?.languages?.length
    ? languageFilter.languages.map(language => languageLabels[language] || language).join('、')
    : languageLabels[languageFilter?.language] || '中文腳本'
  const languageSummary = languageFilter
    ? `<div class="language-filter-summary" role="status"><strong>語言篩選：${selectedLanguageLabel}${languageFilter.languageScript !== 'all' ? `／${scriptLabels[languageFilter.languageScript] || '中文腳本'}` : ''}</strong><p>本次檢查 Crossref 候選 ${languageFilter.candidateCount} 筆，符合 ${languageFilter.matchedCount} 筆；${languageFilter.missingLanguageCount} 筆沒有可辨識的語言欄位，因此未納入語言篩選。</p><p>Crossref 語言／腳本資料可能不完整。${languageFilter.languageScript !== 'all' ? `另有 ${languageMetadata?.missingLanguageScriptCount || 0} 筆中文候選未明確標示繁簡腳本。` : ''}${languageFilter.candidateWindowFull ? `本次候選集已達 ${languageFilter.candidateLimit} 筆上限，其他尚未取回的文獻未納入判斷。` : ''}</p></div>`
    : languageMetadata?.missingLanguageCount > 0
      ? `<div class="language-filter-summary" role="status"><strong>Crossref 語言資料提醒</strong><p>本次 ${languageMetadata.candidateCount} 筆候選文獻中，有 ${languageMetadata.missingLanguageCount} 筆沒有可辨識的語言欄位。選擇特定語言時，這些文獻不會被歸入該語言或「其他」。</p></div>`
      : ''
  if (state.loading) return '<div class="empty-state"><div class="loading-mark">⌕</div><h3>正在準備搜尋</h3><p>請稍候片刻…</p></div>'
  if (state.results?.status === 'error') return `<div class="empty-state"><div class="empty-icon">!</div><h3>無法完成搜尋</h3><p>${escapeHtml(state.results.message)}</p></div>`
  if (state.results?.status === 'not-configured') return `<div class="empty-state"><div class="empty-icon">⌕</div><span class="empty-label">DATA SOURCE NOT CONNECTED</span><h3>尚未連接學術文獻資料來源</h3><p>${escapeHtml(state.results.message)}</p><a class="text-link" href="#settings">查看 API 設定方式 <span>→</span></a></div>`
  if (state.results?.items?.length) return `${languageSummary}<div class="literature-list">${state.results.items.map(renderLiterature).join('')}</div>`
  if (languageFilter) return `${languageSummary}<div class="empty-state"><div class="empty-icon">⌕</div><h3>沒有符合語言條件的文獻</h3><p>目前取回的 Crossref 文獻中沒有符合所選語言的已知語言記錄。</p></div>`
  return '<div class="empty-state"><div class="empty-icon">⌕</div><span class="empty-label">READY WHEN YOU ARE</span><h3>從一個研究問題開始</h3><p>輸入主題並設定條件，搜尋結果會顯示在這裡。<br>目前不會使用虛構或未驗證的文獻資料。</p></div>'
}

window.addEventListener('hashchange', () => {
  const requested = location.hash.slice(1)
  if (navItems.some(item => item.id === requested)) { state.page = requested; render() }
})

if (location.hash) state.page = navItems.some(item => item.id === location.hash.slice(1)) ? location.hash.slice(1) : 'home'
render()
