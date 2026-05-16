import { useState, useEffect, useRef, Fragment } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchStockData } from './utils/api'
import { predict } from './utils/prediction'
import { getSameIndustryRecommendations, getStockSector } from './utils/industries'
import { MACRO_CONTEXT, SECTOR_MACRO, USD_JPY_RATE } from './utils/macroContext'
import { CT_UNIVERSE, CT_LEADERS, LEADER_RANK_LABEL, LEADER_RANK_CLASS, SECTOR_BAROMETERS } from './utils/ctUniverse'

const RANK_LABELS = ['1位', '2位', '3位', '4位', '5位', '6位', '7位', '8位', '9位', '10位']
const MAX_TICKERS = 10

function fmtPrice(ticker, lastClose) {
  if (lastClose == null) return null
  if (ticker.toUpperCase().endsWith('.T')) {
    return Math.round(lastClose).toLocaleString() + '円'
  }
  const jpy = Math.round(lastClose * USD_JPY_RATE).toLocaleString()
  return `$${lastClose.toFixed(2)} → ${jpy}円`
}

function fmtVol(v) {
  if (!v || v <= 0) return '-'
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000)    return (v / 1000).toFixed(0) + 'K'
  return v.toString()
}

function StockChart({ chartData }) {
  const maxVol = Math.max(...chartData.map(d => d.volume || 0))
  const hasVol = maxVol > 0
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 4, right: hasVol ? 48 : 16, left: 0, bottom: 4 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={60} />
        {hasVol && (
          <YAxis
            yAxisId="vol"
            orientation="right"
            domain={[0, maxVol * 6]}
            tickFormatter={v => v > 0 ? (v >= 1000000 ? (v / 1000000).toFixed(0) + 'M' : (v / 1000).toFixed(0) + 'K') : ''}
            tick={{ fontSize: 10 }}
            width={44}
          />
        )}
        <Tooltip
          formatter={(value, name) =>
            name === '出来高' ? fmtVol(value) : (typeof value === 'number' ? value.toFixed(2) : value)
          }
        />
        <Legend />
        {hasVol && (
          <Bar yAxisId="vol" dataKey="volume" fill="rgba(139,105,20,0.35)" name="出来高" barSize={4} />
        )}
        <Line yAxisId="price" type="monotone" dataKey="price" stroke="#4f8ef7" dot={false} name="終値" strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function generateBuyAdvice(rankedItems) {
  const valid = rankedItems.filter(item => item.prediction)
  if (valid.length < 2) return null

  const winner   = valid[0]
  const runnerUp = valid[1]
  const p        = winner.prediction
  const allDown  = valid.every(item => item.prediction.direction === 'DOWN')

  const reasons = []
  let comparisonNote = null

  if (p.obvTrend === 'UP') {
    if (p.disciplinaryPct != null && p.disciplinaryPct >= 70) {
      reasons.push(`OBV（資金フロー）上昇 + 規律可能性 ${p.disciplinaryPct}%：機関投資家の買いが継続し動きも予測しやすい`)
    } else {
      reasons.push('OBV（資金フロー）が上昇中：機関投資家・大口の買いが続いている')
    }
  }
  if (p.isStagnating) {
    reasons.push('上昇後に出来高減少で価格が安定（停滞）：売り手が不在→上昇継続の可能性が高い')
  }
  if (p.magnetEffect && (p.magnetEffect.status === 'NEW_HIGH' || p.magnetEffect.status === 'BREAKOUT')) {
    reasons.push(`過去高値を突破（+${p.magnetEffect.distancePct}%）：上値抵抗を超えた→慣性の法則で上昇継続`)
  }
  if (p.trendDays >= 4) {
    reasons.push(`${p.trendDays}日連続上昇：慣性の法則が発動中—強いトレンドは続く`)
  }
  if (p.relativeVolume !== null && p.relativeVolume > 1.2 && p.direction === 'UP') {
    reasons.push(`出来高 ${(p.relativeVolume * 100).toFixed(0)}%（平均比）：資金流入を伴う健全な上昇`)
  }
  if (p.disciplinaryPct != null && p.disciplinaryPct >= 75 && !reasons.some(r => r.includes('規律'))) {
    reasons.push(`規律可能性 ${p.disciplinaryPct}%：値動きが予測しやすい状態`)
  }
  const iv = p.initialVelocity
  const d2 = p.day2Confirmation
  if (iv && iv.isAligned && iv.currentDir > 0) {
    if (iv.level === 'VERY_HIGH') {
      reasons.push(`初速 超高速（${iv.velocityPct > 0 ? '+' : ''}${iv.velocityPct}%/2日）：CT理論最重要指標—強烈なスタートダッシュはトレンド持続力が最高水準の証拠`)
    } else if (iv.level === 'HIGH') {
      reasons.push(`初速 高速（${iv.velocityPct > 0 ? '+' : ''}${iv.velocityPct}%/2日）：力強いトレンド開始—上昇持続の可能性が高い`)
    }
  }
  if (d2 && d2.isConfirmed && d2.day1Dir > 0) {
    reasons.push(`2日目確認済み（前日${d2.day1ChangePct > 0 ? '+' : ''}${d2.day1ChangePct}%→翌日${d2.day2ChangePct > 0 ? '+' : ''}${d2.day2ChangePct}%）：CT理論「信頼度4倍」の確定シグナル`)
  }

  const sector = getStockSector(winner.ticker)
  const sm     = sector ? SECTOR_MACRO[sector] : null
  if (sm && sm.score >= 2) {
    reasons.push(`${sector}セクター：AI・半導体需要の追い風（マクロ参考 +${sm.score}）`)
  }

  const scoreDiff = p.stableScore - runnerUp.prediction.stableScore
  const discDiff  = (p.disciplinaryPct || 0) - (runnerUp.prediction.disciplinaryPct || 0)
  if (discDiff > 10) {
    comparisonNote = `2位 ${runnerUp.name || runnerUp.ticker}より規律可能性が${discDiff.toFixed(0)}%高い（より予測しやすい）。安定スコア差 +${scoreDiff}点`
  } else if (scoreDiff > 0) {
    comparisonNote = `2位 ${runnerUp.name || runnerUp.ticker}との安定スコア差：+${scoreDiff}点`
  } else {
    comparisonNote = `${runnerUp.name || runnerUp.ticker}と安定スコアは接近。総合的に${winner.name || winner.ticker}がわずかに有利と判定`
  }

  return { winner, runnerUp, allDown, reasons: reasons.slice(0, 4), comparisonNote, scoreDiff, allCount: valid.length }
}

function IndicatorBadges({ p }) {
  const iv = p.initialVelocity
  const d2 = p.day2Confirmation
  return (
    <div className="rank-indicators">
      {p.disciplinaryPct != null && (
        <span className={`ind-badge ${p.disciplinaryPct >= 70 ? 'bull' : p.disciplinaryPct < 40 ? 'bear' : 'neutral'}`}>
          規律 {p.disciplinaryPct}%
        </span>
      )}
      {p.relativeVolume != null && (
        <span className={`ind-badge ${p.relativeVolume > 2.5 ? 'bear' : p.relativeVolume > 1.2 ? 'bull' : 'neutral'}`}>
          VOL {p.relativeVolume.toFixed(1)}x
        </span>
      )}
      {p.hasVolume && (
        <span className={`ind-badge ${p.obvTrend === 'UP' ? 'bull' : p.obvTrend === 'DOWN' ? 'bear' : 'neutral'}`}>
          OBV {p.obvTrend === 'UP' ? '▲' : p.obvTrend === 'DOWN' ? '▼' : '━'}
        </span>
      )}
      {p.trendDays !== 0 && (
        <span className={`ind-badge ${p.trendDays > 0 ? 'bull' : 'bear'}`}>
          {p.trendDays > 0 ? '+' : ''}{p.trendDays}日
        </span>
      )}
      {iv && iv.isAligned && (iv.level === 'VERY_HIGH' || iv.level === 'HIGH') && (
        <span className={`ind-badge ${iv.currentDir > 0 ? 'bull' : 'bear'}`}>
          初速{iv.level === 'VERY_HIGH' ? ' ⚡超高' : ' ↑高'}
        </span>
      )}
      {iv && iv.level === 'LOW' && (
        <span className="ind-badge bear">初速 ↓低</span>
      )}
      {d2 && d2.status !== 'NO_SIGNAL' && (
        <span className={`ind-badge ${
          d2.isConfirmed && d2.day1Dir > 0  ? 'bull' :
          d2.isConfirmed && d2.day1Dir < 0  ? 'bear' :
          !d2.isConfirmed && d2.day1Dir > 0 ? 'bear' : 'bull'
        }`}>
          2日目{
            d2.isConfirmed && d2.day1Dir > 0  ? '✓' :
            d2.isConfirmed && d2.day1Dir < 0  ? '✗' :
            !d2.isConfirmed && d2.day1Dir > 0 ? '✗' : '△'
          }
        </span>
      )}
    </div>
  )
}

function ScoreSparkline({ series, trend, delta }) {
  const valid = (series ?? []).filter(s => s.stableScore !== null)
  if (valid.length < 5) return null
  const color = trend === 'RISING' ? '#27ae60' : trend === 'FALLING' ? '#e74c4c' : '#888'
  const data  = series.map(s => ({ date: s.date.slice(5), v: s.stableScore }))
  const trendLabel = trend === 'RISING' ? '▲ 上昇中' : trend === 'FALLING' ? '▼ 下降中' : '→ 横ばい'
  return (
    <div className="score-sparkline-wrap">
      <div className="score-sparkline-header">
        <span className="score-sparkline-label">安定スコア推移（過去20日）</span>
        <span className={`score-sparkline-delta ssd-${trend?.toLowerCase()}`}>
          {trendLabel}{delta !== null ? `　${delta > 0 ? '+' : ''}${delta}pt` : ''}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={24} />
          <Tooltip formatter={v => v !== null ? [`${v > 0 ? '+' : ''}${v}pt`, '安定スコア'] : ['-', '安定スコア']} />
          <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ScoreSparklineMini({ series, trend }) {
  const valid = (series ?? []).filter(s => s.stableScore !== null)
  if (valid.length < 5) return null
  const color = trend === 'RISING' ? '#27ae60' : trend === 'FALLING' ? '#e74c4c' : '#aaa'
  const data  = series.map(s => ({ v: s.stableScore }))
  return (
    <LineChart width={72} height={28} data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.5} connectNulls />
    </LineChart>
  )
}

function CTMetrics({ p }) {
  const magDist   = p.magnetEffect?.distancePct
  const magStatus = p.magnetEffect?.status
  const iv = p.initialVelocity
  const d2 = p.day2Confirmation
  const hasRow3 = iv !== null || (d2 !== null && d2.status !== 'NO_SIGNAL')
  return (
    <>
      <div className="metrics">
        <div className="metric">
          <span>現在値</span>
          <strong>{p.lastClose.toFixed(2)}</strong>
        </div>
        <div className="metric">
          <span>出来高比率</span>
          <strong>{p.relativeVolume != null ? `${(p.relativeVolume * 100).toFixed(0)}%` : '-'}</strong>
        </div>
        <div className="metric">
          <span>規律可能性</span>
          <strong>{p.disciplinaryPct != null ? `${p.disciplinaryPct}%` : '-'}</strong>
        </div>
        <div className="metric">
          <span>連続日数</span>
          <strong>
            {p.trendDays > 0 ? `+${p.trendDays}日` : p.trendDays < 0 ? `${p.trendDays}日` : '0日'}
          </strong>
        </div>
      </div>
      <div className="metrics metrics-ext">
        <div className="metric">
          <span>OBV傾向</span>
          <strong className={p.obvTrend === 'UP' ? 'val-up' : p.obvTrend === 'DOWN' ? 'val-down' : ''}>
            {p.obvTrend === 'UP' ? '▲ 上昇' : p.obvTrend === 'DOWN' ? '▼ 下降' : '━ 横ばい'}
          </strong>
        </div>
        <div className="metric">
          <span>最高値距離</span>
          <strong className={
            magStatus === 'NEW_HIGH' || magStatus === 'BREAKOUT' ? 'val-up'
            : magStatus === 'RESISTANCE' ? 'val-down' : ''
          }>
            {magDist != null ? `${magDist > 0 ? '+' : ''}${magDist}%` : '-'}
          </strong>
        </div>
        <div className="metric">
          <span>停滞シグナル</span>
          <strong className={p.isStagnating ? 'val-up' : ''}>
            {p.isStagnating ? '✓ 検出' : '━ なし'}
          </strong>
        </div>
      </div>
      {hasRow3 && (
        <div className="entry-timing-section">
          <div className="entry-timing-label">エントリータイミング（今日エントリーする場合の判断）</div>
          <div className="metrics metrics-ext">
          {iv !== null && (
            <>
              <div className="metric">
                <span>初速判定</span>
                <strong className={
                  iv.isAligned && (iv.level === 'VERY_HIGH' || iv.level === 'HIGH')
                    ? (iv.currentDir > 0 ? 'val-up' : 'val-down')
                    : iv.level === 'LOW' ? 'val-down' : ''
                }>
                  {iv.level === 'VERY_HIGH' ? '⚡ 超高速' : iv.level === 'HIGH' ? '↑ 高速' : iv.level === 'MEDIUM' ? '→ 中速' : '↓ 低速'}
                </strong>
              </div>
              <div className="metric">
                <span>初速(%/2日)</span>
                <strong className={iv.velocityPct > 0 ? 'val-up' : 'val-down'}>
                  {iv.velocityPct > 0 ? '+' : ''}{iv.velocityPct}%
                </strong>
              </div>
            </>
          )}
          {d2 !== null && d2.status !== 'NO_SIGNAL' && (
            <div className="metric">
              <span>2日目確認</span>
              <div className="metric-val-wrap">
                <strong className={
                  d2.isConfirmed && d2.day1Dir > 0  ? 'val-up' :
                  d2.isConfirmed && d2.day1Dir < 0  ? 'val-down' :
                  !d2.isConfirmed && d2.day1Dir > 0 ? 'val-down' : 'val-up'
                }>
                  {d2.isConfirmed
                    ? (d2.day1Dir > 0 ? '✓ 確認済み' : '✗ 下落確定')
                    : (d2.day1Dir > 0 ? '✗ 否定' : '△ 底打ち?')}
                </strong>
                {!d2.isConfirmed && d2.day1Dir < 0 && (
                  <span className="metric-note">1日の跳ね返りかもという不確実性あり</span>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
      <ScoreSparkline series={p.stableScoreSeries} trend={p.scoreTrend} delta={p.scoreDelta} />
    </>
  )
}

// ── 分散エグジット判断パネル ──────────────────────────────────────────────────
function ExitPanel({ p }) {
  const ex = p.exitJudgment
  if (!ex) return null

  const levelConfig = {
    HOLD:     { label: '保有継続',      cls: 'exit-hold', icon: '✓',  desc: '3つの指標がすべて正常です。CT理論ではトレンドを引き続き保有して構いません。' },
    EXIT_1_3: { label: '1/3 手仕舞い',  cls: 'exit-one',  icon: '⚠',  desc: '最初の警告シグナルが出ています。CT理論ではポジションの1/3を利確しリスクを軽減します。' },
    EXIT_2_3: { label: '2/3 手仕舞い',  cls: 'exit-two',  icon: '⚠⚠', desc: '2つの指標が悪化しています。残りの半分も手仕舞いし、わずかなポジションのみ保持します。' },
    EXIT_ALL: { label: '全決済',        cls: 'exit-all',  icon: '✕',  desc: '3指標すべてが悪化。CT理論の原則に従い残りのポジションをすべて手仕舞いする水準です。' },
  }[ex.exitRecommendation]

  const sigs = [
    { label: '流れ',         icon: '〜', sub: 'OBV・出来高配分',   ...ex.flow },
    { label: '加速度',       icon: '↗', sub: '5日モメンタム比較',  ...ex.acceleration },
    { label: 'ボラティリティ', icon: '△', sub: 'ATR・規律可能性',   ...ex.volatility },
  ]

  const steps = ['保有継続', '1/3手仕舞い', '2/3手仕舞い', '全決済']

  return (
    <div className={`exit-panel exit-lv${ex.exitLevel}`}>
      <div className="exit-panel-header">
        <div className="exit-panel-title">分散エグジット判断</div>
        <div className="exit-panel-sub">現在この銘柄を保有している場合のCT理論手仕舞いアドバイス</div>
      </div>

      <div className="exit-recommend-row">
        <div className={`exit-badge ${levelConfig.cls}`}>
          <span className="exit-badge-icon">{levelConfig.icon}</span>
          <span className="exit-badge-label">{levelConfig.label}</span>
        </div>
        <p className="exit-recommend-desc">{levelConfig.desc}</p>
      </div>

      <div className="exit-step-track">
        {steps.map((label, i) => (
          <div key={i} className={`exit-step ${i < ex.exitLevel ? 'step-passed' : ''} ${i === ex.exitLevel ? 'step-current' : ''}`}>
            <div className="exit-step-dot" />
            <div className="exit-step-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="exit-signals">
        {sigs.map((sig, i) => (
          <div key={i} className={`exit-sig ${sig.deteriorating ? 'sig-bad' : 'sig-ok'}`}>
            <div className="exit-sig-top">
              <span className="exit-sig-icon">{sig.icon}</span>
              <span className="exit-sig-label">{sig.label}</span>
              <span className="exit-sig-sub">{sig.sub}</span>
              <span className={`exit-sig-status ${sig.deteriorating ? 'status-bad' : 'status-ok'}`}>
                {sig.deteriorating ? '悪化' : '正常'}
              </span>
            </div>
            <p className="exit-sig-detail">{sig.detail}</p>
          </div>
        ))}
      </div>

      <p className="ct-note">※ 分散エグジットはCT理論のリスク管理手法です。実際の売却判断は相場全体の状況を加味してご自身でご判断ください。</p>
    </div>
  )
}

// ── 次元1：相場環境判断パネル ──────────────────────────────────────────────────
// CT理論2段階プロセス：業種の強さを確認 → 最強セクターからS-rank先導株を動的選定
function MarketPhasePanel({ gasUrl, onSelectTicker, onPhaseResolved }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults]         = useState(null)
  const [error, setError]             = useState(null)

  const JP_TOTAL = SECTOR_BAROMETERS.filter(s => s.region === 'JP').length

  const run = async () => {
    if (!gasUrl) { setError('GAS URLを入力してください。'); return }
    setIsAnalyzing(true); setError(null); setResults(null)

    const settled = await Promise.allSettled(
      SECTOR_BAROMETERS.map(s => fetchStockData(s.ticker, { gasUrl, apiKey: '' }))
    )

    const live = settled.map((r, i) => {
      const s = SECTOR_BAROMETERS[i]
      if (r.status === 'fulfilled' && r.value.prices.length >= 20) {
        return { ...s, name: r.value.name || s.name, prediction: predict(r.value.prices, 14) }
      }
      return { ...s, prediction: null }
    })

    // 米国バロメーター集計
    const usStocks    = live.filter(s => s.region === 'US')
    const usWithPred  = usStocks.filter(s => s.prediction)
    const usUpCount   = usWithPred.filter(s => s.prediction.direction === 'UP').length

    // 日本セクター：同セクターの銘柄を集約して平均スコアを計算
    const sectorMap = {}
    for (const s of live.filter(s2 => s2.region === 'JP' && s2.prediction)) {
      if (!sectorMap[s.sector]) sectorMap[s.sector] = []
      sectorMap[s.sector].push(s)
    }

    const jpSectors = Object.entries(sectorMap).map(([sector, stocks]) => {
      const avgScore  = stocks.reduce((sum, s) => sum + s.prediction.stableScore, 0) / stocks.length
      const upCount   = stocks.filter(s => s.prediction.direction === 'UP').length
      const direction = upCount > stocks.length / 2 ? 'UP' : 'DOWN'
      const sorted    = [...stocks].sort((a, b) => b.prediction.stableScore - a.prediction.stableScore)
      return { sector, stocks: sorted, avgScore: +avgScore.toFixed(1), direction, upCount, totalCount: stocks.length, best: sorted[0] }
    }).sort((a, b) => b.avgScore - a.avgScore)

    const jpTotal   = jpSectors.length
    const jpUpCount = jpSectors.filter(s => s.direction === 'UP').length

    // S-rank候補：最強セクターの最高スコア個別銘柄（UP かつ セクター平均+2以上）
    const sRankSector    = jpSectors.find(s => s.direction === 'UP' && s.avgScore >= 2)
    const sRankCandidate = sRankSector?.best || null

    // 相場フェーズ判定
    const usStrong = usUpCount >= 2
    const jpStrong = jpTotal > 0 && jpUpCount >= Math.ceil(jpTotal * 0.5)
    let overallPhase, overallDesc
    if (usStrong && jpStrong && sRankCandidate) {
      overallPhase = 'EASY'
      overallDesc  = 'トレンド相場：積極的な参加が可能です。先導株の流れに乗ってください。'
    } else if (!usStrong || (jpTotal > 0 && jpUpCount <= Math.floor(jpTotal * 0.3))) {
      overallPhase = 'HARD'
      overallDesc  = 'ランダム相場：相場の8割がこの状態です。現金を保持して待機してください。'
    } else {
      overallPhase = 'NORMAL'
      overallDesc  = '混合相場：一部セクターのみ参加可。スコアの高い先導株を厳選してください。'
    }

    setResults({ usStocks, jpSectors, usUpCount, usWithPred, jpUpCount, jpTotal, overallPhase, overallDesc, sRankCandidate })
    onPhaseResolved?.(overallPhase)
    setIsAnalyzing(false)
  }

  return (
    <div className="card market-phase-panel">
      <div className="phase-header">
        <div>
          <div className="phase-title">次元1：相場環境判断</div>
          <div className="phase-subtitle">業種選定 → S-rank先導株 → 相場フェーズ判定</div>
        </div>
        <button className="btn-phase" onClick={run} disabled={isAnalyzing}>
          {isAnalyzing ? '分析中...' : results ? '再分析' : '相場環境を分析'}
        </button>
      </div>

      {!results && !isAnalyzing && (
        <div className="phase-intro">
          <p>
            CT理論の根本原則：<strong>相場の8割はランダム。2割のトレンド期間のみ参加</strong>。<br />
            米国3＋日本{JP_TOTAL}セクター代表銘柄をスキャンし、「今日は参加すべき相場か」を判定します。
          </p>
        </div>
      )}

      {error && <div className="nikkei-error">{error}</div>}

      {isAnalyzing && (
        <div className="phase-loading">{SECTOR_BAROMETERS.length}銘柄（米国3＋日本{JP_TOTAL}セクター）をスキャン中...</div>
      )}

      {results && (
        <>
          {/* 総合相場フェーズ */}
          <div className={`phase-overall phase-overall-${results.overallPhase.toLowerCase()}`}>
            <div className="phase-overall-label">相場環境</div>
            <div className="phase-overall-phase">
              {results.overallPhase === 'EASY' ? 'EASY相場'
                : results.overallPhase === 'HARD' ? 'HARD相場'
                : 'NORMAL相場'}
            </div>
            <p className="phase-overall-desc">{results.overallDesc}</p>
            <div className="phase-overall-stats">
              米国 {results.usUpCount}/{results.usWithPred.length} UP　／
              日本セクター {results.jpUpCount}/{results.jpTotal} UP
            </div>
          </div>

          {/* Step1: 米国バロメーター */}
          <div className="phase-section-title">
            Step1 — 米国市場バロメーター
          </div>
          <div className="phase-us-grid">
            {results.usStocks.map(s => {
              const p = s.prediction
              if (!p) return (
                <div key={s.ticker} className="phase-us-card phase-card-neutral">
                  <div className="phase-card-ticker">{s.ticker}</div>
                  <div className="phase-card-name">{s.name}</div>
                  <div className="phase-card-status">データなし</div>
                </div>
              )
              return (
                <div key={s.ticker} className={`phase-us-card ${p.direction === 'UP' ? 'phase-card-up' : 'phase-card-down'}`}>
                  <div className="phase-card-ticker">{s.ticker}</div>
                  <div className="phase-card-name">{s.name}</div>
                  <div className={`phase-card-dir ${p.direction === 'UP' ? 'val-up' : 'val-down'}`}>
                    {p.direction === 'UP' ? '▲ UP' : '▼ DOWN'}
                  </div>
                  <div className="phase-card-score">
                    安定 {p.stableScore > 0 ? '+' : ''}{p.stableScore}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Step2: 日本セクターランキング */}
          <div className="phase-section-title">
            Step2 — 日本セクター強さランキング
            <span className="phase-section-sub">（安定スコア順）</span>
          </div>
          <div className="phase-jp-list">
            {results.jpSectors.map((sec, i) => {
              const isStrong = i < 3 && sec.direction === 'UP' && sec.avgScore >= 2
              return (
                <div key={sec.sector} className={`phase-jp-item ${isStrong ? 'phase-jp-strong' : ''} ${sec.direction === 'UP' ? 'phase-jp-up' : 'phase-jp-down'}`}>
                  <div className={`phase-jp-rank ${i === 0 ? 'phase-jp-rank-gold' : i === 1 ? 'phase-jp-rank-silver' : i === 2 ? 'phase-jp-rank-bronze' : ''}`}>
                    {i + 1}
                  </div>
                  <div className="phase-jp-info">
                    <div className="phase-jp-sector">{sec.sector}</div>
                    <div className="phase-jp-ticker-name">
                      {sec.stocks.map((s, si) => (
                        <span key={s.ticker} className={si === 0 ? 'phase-jp-ticker' : 'phase-jp-ticker-sub'}>
                          {s.ticker}
                          {sec.stocks.length > 1 && (
                            <span className={s.prediction.stableScore >= 0 ? 'phase-jp-sub-score-up' : 'phase-jp-sub-score-down'}>
                              {s.prediction.stableScore > 0 ? '+' : ''}{s.prediction.stableScore}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`phase-jp-scores ${sec.direction === 'UP' ? 'phase-jp-up-color' : 'phase-jp-down-color'}`}>
                    <span className="phase-jp-arrow">{sec.direction === 'UP' ? '▲' : '▼'}</span>
                    <span className="phase-jp-score-val">{sec.avgScore > 0 ? '+' : ''}{sec.avgScore}</span>
                    {sec.totalCount > 1 && <span className="phase-jp-avg-label">平均</span>}
                  </div>
                  {isStrong && <div className="phase-jp-star">強</div>}
                </div>
              )
            })}
          </div>

          {/* Step3: S-rank先導株候補 */}
          <div className="phase-section-title">
            Step3 — 本日のS-rank先導株候補
            <span className="phase-section-sub">（最強セクターからCT理論が動的選定）</span>
          </div>
          {results.sRankCandidate ? (
            <div className="phase-srank-card">
              <div className="phase-srank-left">
                <div className="phase-srank-badge">S-rank</div>
                <div className="phase-srank-sector">{results.sRankCandidate.sector}</div>
                <div className="phase-srank-name">{results.sRankCandidate.name}</div>
                <div className="phase-srank-ticker">{results.sRankCandidate.ticker}</div>
              </div>
              <div className="phase-srank-center">
                <div className="phase-srank-dir val-up">▲ 上昇トレンド</div>
                <div className="phase-srank-score">
                  安定スコア <strong className="val-up">+{results.sRankCandidate.prediction.stableScore}</strong>
                </div>
                <div className="phase-srank-conf">確信度 {results.sRankCandidate.prediction.confidence}%</div>
                <IndicatorBadges p={results.sRankCandidate.prediction} />
              </div>
              <button
                className="btn-select-ticker"
                onClick={() => onSelectTicker(results.sRankCandidate.ticker)}
              >
                詳細分析 →
              </button>
            </div>
          ) : (
            <div className="phase-srank-none">
              現在S-rank条件（上昇トレンド＋安定スコア+2以上）を満たすセクター代表銘柄がありません。HARD相場の可能性が高く、待機を推奨します。
            </div>
          )}

          <p className="disclaimer" style={{ marginTop: 12 }}>
            ※ 相場環境判断はCT理論に基づく参考情報です。投資判断の最終責任はご自身にあります。
          </p>
        </>
      )}
    </div>
  )
}

// ── 先導株パネル ──────────────────────────────────────────────────────────────
function LeaderPanel({ gasUrl, onSelectTicker, onSelectSet, onRecordTrade }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults]         = useState(null)
  const [error, setError]             = useState(null)

  const run = async () => {
    if (!gasUrl) { setError('GAS URLを入力してください。'); return }
    setIsAnalyzing(true); setError(null); setResults(null)
    const settled = await Promise.allSettled(
      CT_LEADERS.map(s => fetchStockData(s.ticker, { gasUrl, apiKey: '' }))
    )
    const live = settled.map((r, i) => {
      const s = CT_LEADERS[i]
      if (r.status === 'fulfilled' && r.value.prices.length > 0) {
        return { ...s, name: r.value.name || s.name, prediction: predict(r.value.prices, 14) }
      }
      return { ...s, prediction: null }
    }).filter(r => r.prediction !== null)

    // 安定スコア（7指標）でソート：2日目確認・初速はエントリー用のため除外
    live.sort((a, b) => b.prediction.stableScore - a.prediction.stableScore)
    setResults(live)
    setIsAnalyzing(false)
  }

  // アクティブ先導株の4条件（CT理論準拠）:
  //   1. 上昇トレンド
  //   2. 分散シグナルなし（exitLevel=0）
  //   3. OBV上昇（機関投資家の買いが継続中）← CT理論の中核
  //   4. 品質閾値（leaderRankに応じて S:1 / A:2 / B:3）
  const LEADER_STABLE_THRESHOLD = { S: 1, A: 2, B: 3 }
  const activeResults  = results ? results.filter(r => {
    const p         = r.prediction
    const threshold = LEADER_STABLE_THRESHOLD[r.leaderRank] ?? 2
    return p.direction === 'UP'
      && (p.exitJudgment?.exitLevel ?? 0) === 0
      && p.obvTrend === 'UP'
      && p.stableScore >= threshold
  }) : []
  const dormantResults = results ? results.filter(r => !activeResults.includes(r)) : []

  const topTickers = activeResults.length > 0 ? activeResults.map(r => r.ticker).join(',') : ''

  const renderLeaderItem = (item, i, isActive) => {
    const p = item.prediction
    const isTop = isActive && i === 0
    return (
      <div key={item.ticker} className={`leader-item ${isTop ? 'leader-item-top' : ''} ${!isActive ? 'leader-item-dormant' : ''}`}>
        <div className="leader-item-left">
          <div className={`leader-rank-badge ${LEADER_RANK_CLASS[item.leaderRank]}`}>
            {LEADER_RANK_LABEL[item.leaderRank]}
          </div>
          <div className="leader-ticker">{item.ticker}</div>
          <div className="leader-name">{item.name}</div>
          <div className="leader-sector-tag">{item.sector}</div>
        </div>
        <div className="leader-item-center">
          <div className={`leader-direction ${p.direction === 'UP' ? 'up' : 'down'}`}>
            {p.direction === 'UP' ? '▲ 上昇' : '▼ 下降'}
          </div>
          <div className="leader-score">
            安定スコア <span className={p.stableScore > 0 ? 'val-up' : 'val-down'}>
              {p.stableScore > 0 ? '+' : ''}{p.stableScore}
            </span>
          </div>
          <div className="leader-conf">確信度 {p.confidence}%</div>
          {fmtPrice(item.ticker, p.lastClose) && (
            <div className="item-last-price">{fmtPrice(item.ticker, p.lastClose)}</div>
          )}
          <IndicatorBadges p={p} />
          {isActive && <EntryJudgmentBadge p={p} compact />}
        </div>
        <div className="leader-item-right">
          <p className="leader-reason">{item.leaderReason}</p>
          <button className="btn-select-ticker" onClick={() => onSelectTicker(item.ticker)}>
            詳細分析 →
          </button>
          {isActive && onRecordTrade && (
            <button
              className="btn-tj-record"
              title="購入を記録"
              onClick={() => onRecordTrade(buildTradeData(item.ticker, item.sector, item.name, p))}
            >
              📝
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card leader-panel">
      <div className="leader-panel-header">
        <div>
          <div className="leader-panel-title">先導株分析</div>
          <div className="leader-panel-subtitle">
            CT理論：{CT_LEADERS.length}銘柄から「今日現在、市場を牽引している銘柄」のみを表示
          </div>
        </div>
        <button className="btn-leader" onClick={run} disabled={isAnalyzing}>
          {isAnalyzing ? '分析中...' : '先導株を分析'}
        </button>
      </div>

      <div className="leader-intro">
        <p>
          CT理論では「先導株（市場全体を先行して動かす銘柄）を特定し、その流れに乗る」ことが最重要戦略です。
          先導株は全体の<strong>2〜3%</strong>しか存在せず、以下の<strong>4条件を全て満たす</strong>銘柄のみを「アクティブ先導株」として表示します：
          ①上昇トレンド ②分散シグナルなし ③OBV上昇（機関投資家の買い継続） ④品質スコア（★★★確定:+1以上 / ★★有力:+2以上 / ★候補:+3以上）
        </p>
      </div>

      {error && <div className="nikkei-error">{error}</div>}

      {results && (
        <>
          {/* アクティブカウンター */}
          <div className="leader-active-count">
            <span className={activeResults.length > 0 ? 'leader-count-active' : 'leader-count-zero'}>
              アクティブ先導株 {activeResults.length} / {results.length} 銘柄
            </span>
            {activeResults.length === 0 && (
              <span className="leader-count-hint">
                — 現在HARD相場または転換点の可能性。先導株が動き出すまで待機推奨
              </span>
            )}
          </div>

          {/* アクティブ先導株 */}
          {activeResults.length > 0 ? (
            <div className="leader-results">
              {activeResults.map((item, i) => renderLeaderItem(item, i, true))}
            </div>
          ) : (
            <div className="leader-none-active">
              現在、アクティブ先導株はありません。{results.length}銘柄全てが「上昇トレンド＋安定スコア+2以上＋分散シグナルなし」の条件を満たしていません。
              CT理論の原則に従い、市場への新規参入は見送りを推奨します。
            </div>
          )}

          <TopRecommendations items={activeResults} onSelectTicker={onSelectTicker} onRecordTrade={onRecordTrade} />

          {topTickers && (
            <button className="btn-select-set" onClick={() => onSelectSet(topTickers)}>
              ▶ アクティブ先導株を比較分析する（フォームに入力）
            </button>
          )}

          {/* 非アクティブ先導株（折りたたみ） */}
          {dormantResults.length > 0 && (
            <details className="leader-dormant-section">
              <summary className="leader-dormant-title">
                非アクティブ先導株（{dormantResults.length}銘柄）— 下降・品質不足・分散シグナルあり
              </summary>
              <div className="leader-dormant-note">
                以下は先導株候補リストに含まれますが、現時点では牽引役として機能していません。
                先導株が多数ここに入る場合はHARD相場のサインです。
              </div>
              <div className="leader-results leader-results-dormant">
                {dormantResults.map((item, i) => renderLeaderItem(item, i, false))}
              </div>
            </details>
          )}

          <p className="disclaimer" style={{ marginTop: 12 }}>
            ※ 先導株リストは2026年5月調査時点。市場環境の変化により随時更新が必要です。
          </p>
        </>
      )}
    </div>
  )
}

// ── CTスクリーニングパネル ──────────────────────────────────────────────────
const SCREENER_CACHE_KEY    = 'ct_screener_cache'
const SCREENER_CACHE_EXPIRE = 8 * 60 * 60 * 1000  // 8時間
const ACTIVE_MIN_STABLE     = 1                    // アクティブ候補の安定スコア閾値

function CTScreenerPanel({ gasUrl, onSelectTicker, onSelectSet, onRecordTrade }) {
  const BATCH = 8

  const loadCache = () => {
    try {
      const raw = localStorage.getItem(SCREENER_CACHE_KEY)
      if (!raw) return null
      const c = JSON.parse(raw)
      if (Date.now() - c.timestamp > SCREENER_CACHE_EXPIRE) return null
      return c
    } catch { return null }
  }

  const initCache = loadCache()

  const [isScanning, setIsScanning]   = useState(false)
  const [progress, setProgress]       = useState({ current: 0, total: 0 })
  const [results, setResults]         = useState(initCache?.results   || null)
  const [sectorTops, setSectorTops]   = useState(initCache?.sectorTops || null)
  const [scannedCount, setScannedCount] = useState(initCache?.scannedCount || 0)
  const [cachedAt, setCachedAt]       = useState(initCache?.timestamp  || null)
  const [error, setError]             = useState(null)

  const formatAge = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000)
    if (m < 60)  return `${m}分前`
    const h = Math.floor(m / 60)
    if (h < 24)  return `${h}時間前`
    return `${Math.floor(h / 24)}日前`
  }

  const run = async () => {
    if (!gasUrl) { setError('GAS URLを入力してください。'); return }
    setIsScanning(true); setError(null); setResults(null); setSectorTops(null)
    setProgress({ current: 0, total: CT_UNIVERSE.length })

    const allResults = []

    for (let i = 0; i < CT_UNIVERSE.length; i += BATCH) {
      const batch = CT_UNIVERSE.slice(i, i + BATCH)
      const settled = await Promise.allSettled(
        batch.map(s => fetchStockData(s.ticker, { gasUrl, apiKey: '' }))
      )
      settled.forEach((r, j) => {
        if (r.status === 'fulfilled' && r.value.prices.length >= 20) {
          const s = batch[j]
          allResults.push({
            ticker:     s.ticker,
            name:       r.value.name || s.name,
            sector:     s.sector,
            prediction: predict(r.value.prices, 14),
          })
        }
      })
      setProgress({ current: Math.min(i + BATCH, CT_UNIVERSE.length), total: CT_UNIVERSE.length })
    }

    // CT理論ソート：①UP優先 ②安定スコア降順 ③規律可能性降順
    const sorted = [...allResults].sort((a, b) => {
      const aUp = a.prediction.direction === 'UP' ? 1 : 0
      const bUp = b.prediction.direction === 'UP' ? 1 : 0
      if (aUp !== bUp) return bUp - aUp
      if (b.prediction.stableScore !== a.prediction.stableScore) return b.prediction.stableScore - a.prediction.stableScore
      return (b.prediction.disciplinaryPct || 0) - (a.prediction.disciplinaryPct || 0)
    })

    // セクター別トップ1（ソート済みの先頭 = 各セクター最高スコア）
    const sectorSeen = new Set()
    const sectorTopList = []
    for (const item of sorted) {
      if (!sectorSeen.has(item.sector)) {
        sectorSeen.add(item.sector)
        sectorTopList.push({
          ticker:      item.ticker,
          name:        item.name,
          sector:      item.sector,
          direction:   item.prediction.direction,
          stableScore: item.prediction.stableScore,
          confidence:  item.prediction.confidence,
        })
      }
    }

    const top10 = sorted.slice(0, 10)
    const now   = Date.now()

    // キャッシュ保存（chartDataを除いてサイズ削減）
    try {
      localStorage.setItem(SCREENER_CACHE_KEY, JSON.stringify({
        timestamp:    now,
        scannedCount: allResults.length,
        sectorTops:   sectorTopList,
        results:      top10.map(item => ({
          ...item,
          prediction: { ...item.prediction, chartData: null },
        })),
      }))
    } catch {}

    setResults(top10)
    setSectorTops(sectorTopList)
    setScannedCount(allResults.length)
    setCachedAt(now)
    setIsScanning(false)
  }

  const pct        = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const topTickers = results ? results.map(r => r.ticker).join(',') : ''

  // 閾値ライン：最初にアクティブ条件を満たさないインデックス
  const thresholdIdx = results
    ? results.findIndex(item => !(item.prediction.direction === 'UP' && item.prediction.stableScore >= ACTIVE_MIN_STABLE))
    : -1

  return (
    <div className="card screener-panel">
      <div className="screener-header">
        <div>
          <div className="screener-title">CT銘柄スクリーニング</div>
          <div className="screener-subtitle">
            {CT_UNIVERSE.length}銘柄をCLEAR TRADE理論でスキャンし、上位10銘柄を自動選定
          </div>
        </div>
        <button className="btn-screener" onClick={run} disabled={isScanning}>
          {isScanning ? 'スキャン中...' : results ? '再スキャン' : '上位10銘柄を探す'}
        </button>
      </div>

      {/* キャッシュ鮮度表示 */}
      {cachedAt && !isScanning && (
        <div className="screener-cache-info">
          <span>🕐 {formatAge(cachedAt)}のスキャン結果を表示中</span>
          <span className="screener-cache-hint">（8時間で自動失効 ／ 「再スキャン」で最新化）</span>
        </div>
      )}

      {error && <div className="nikkei-error">{error}</div>}

      {isScanning && (
        <div className="screen-progress-wrap">
          <div className="screen-progress-track">
            <div className="screen-progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="screen-progress-text">
            {progress.current} / {progress.total} 銘柄をスキャン中... {pct}%
          </div>
        </div>
      )}

      {results && (
        <>
          <div className="screener-summary">
            {scannedCount}銘柄スキャン完了 —
            {thresholdIdx < 0
              ? ` 全${results.length}銘柄がアクティブ候補（UP＋安定スコア+${ACTIVE_MIN_STABLE}以上）`
              : thresholdIdx === 0
                ? ` アクティブ候補なし（HARD相場の可能性）`
                : ` アクティブ候補 ${thresholdIdx}銘柄 ／ 監視 ${results.length - thresholdIdx}銘柄`
            }
          </div>

          {thresholdIdx === 0 && (
            <div className="screener-threshold-warn">
              ⚠ UP＋安定スコア+{ACTIVE_MIN_STABLE}以上を満たす銘柄がトップ10にありません。次元1で相場環境を確認してください。
            </div>
          )}

          <details className="screener-results-section" open>
            <summary className="screener-results-toggle">
              スキャン結果 上位10銘柄
            </summary>
            <div className="screener-results">
              {results.map((item, i) => {
                const p        = item.prediction
                const isActive = p.direction === 'UP' && p.stableScore >= ACTIVE_MIN_STABLE
                return (
                  <Fragment key={item.ticker}>
                    {thresholdIdx > 0 && i === thresholdIdx && (
                      <div className="screener-threshold-line">
                        ── アクティブ候補ライン（以下は監視のみ・エントリー不推奨） ──
                      </div>
                    )}
                    <div className={`screener-item ${i === 0 && isActive ? 'screener-item-top' : ''} ${!isActive ? 'screener-item-watch' : ''}`}>
                      <div className="screener-rank">{RANK_LABELS[i]}</div>
                      <div className="screener-body">
                        <div className="screener-name-row">
                          <span className="screener-ticker">{item.ticker}</span>
                          <span className="screener-name">{item.name}</span>
                          <span className="screener-sector">{item.sector}</span>
                          {!isActive && <span className="screener-watch-badge">監視</span>}
                        </div>
                        <div className="screener-score-row">
                          <span className={`screener-dir ${p.direction === 'UP' ? 'up' : 'down'}`}>
                            {p.direction === 'UP' ? '▲ 上昇' : '▼ 下降'}
                          </span>
                          <span className="screener-score-val">
                            安定スコア {p.stableScore > 0 ? '+' : ''}{p.stableScore}
                          </span>
                          <span className="screener-conf">確信度 {p.confidence}%</span>
                          {fmtPrice(item.ticker, p.lastClose) && (
                            <span className="item-last-price">{fmtPrice(item.ticker, p.lastClose)}</span>
                          )}
                        </div>
                        <IndicatorBadges p={p} />
                        <EntryJudgmentBadge p={p} compact />
                        {p.signals && (
                          <div className="screener-signals">
                            {p.signals.slice(0, 2).map((s, si) => (
                              <div key={si} className="screener-signal-line">・{s}</div>
                            ))}
                          </div>
                        )}
                        {p.stableScoreSeries && (
                          <div className="screener-sparkline-wrap">
                            <div className="screener-sparkline-title">安定スコア推移（過去20日）</div>
                            <div className="screener-sparkline-row">
                              <ScoreSparklineMini series={p.stableScoreSeries} trend={p.scoreTrend} />
                              <span className={`screener-trend-label ssd-${p.scoreTrend?.toLowerCase()}`}>
                                {p.scoreTrend === 'RISING' ? '▲ 上昇中' : p.scoreTrend === 'FALLING' ? '▼ 下降中' : '→ 横ばい'}
                                {p.scoreDelta !== null ? `　${p.scoreDelta > 0 ? '+' : ''}${p.scoreDelta}pt` : ''}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="screener-item-btns">
                        <button className="btn-select-ticker" onClick={() => onSelectTicker(item.ticker)}>
                          詳細 →
                        </button>
                        {onRecordTrade && (
                          <button
                            className="btn-tj-record"
                            title="購入を記録"
                            onClick={() => onRecordTrade(buildTradeData(item.ticker, item.sector, item.name, p))}
                          >
                            📝
                          </button>
                        )}
                      </div>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </details>

          <TopRecommendations items={results} onSelectTicker={onSelectTicker} onRecordTrade={onRecordTrade} />

          {/* セクター別トップ1 */}
          {sectorTops && sectorTops.length > 0 && (
            <details className="screener-sector-tops">
              <summary className="screener-sector-tops-title">
                セクター別トップ1（{sectorTops.length}セクター ／ クリックで展開）
              </summary>
              <div className="screener-sector-grid">
                {sectorTops.map(s => (
                  <div
                    key={s.ticker}
                    className={`screener-sector-item ${s.direction === 'UP' ? 'sector-item-up' : 'sector-item-down'} ${s.direction === 'UP' && s.stableScore >= ACTIVE_MIN_STABLE ? 'sector-item-active' : ''}`}
                    onClick={() => onSelectTicker(s.ticker)}
                  >
                    <div className="sector-item-sector">{s.sector}</div>
                    <div className="sector-item-ticker">{s.ticker}</div>
                    <div className="sector-item-name">{s.name}</div>
                    <div className={`sector-item-score ${s.direction === 'UP' ? 'val-up' : 'val-down'}`}>
                      {s.direction === 'UP' ? '▲' : '▼'} {s.stableScore > 0 ? '+' : ''}{s.stableScore}
                    </div>
                  </div>
                ))}
              </div>
              <p className="disclaimer" style={{ marginTop: 8, fontSize: '0.72rem' }}>
                ※ 各セクターの安定スコア最高銘柄。クリックでフォームに入力されます。
              </p>
            </details>
          )}

          {topTickers && (
            <button className="btn-select-set" onClick={() => onSelectSet(topTickers)}>
              ▶ この10銘柄を比較分析する（フォームに入力）
            </button>
          )}
          <p className="disclaimer" style={{ marginTop: 12 }}>
            ※ スキャン結果はCT理論スコアの瞬間値です。投資判断の最終責任はご自身にあります。
          </p>
        </>
      )}

      {!results && !isScanning && (
        <div className="screener-empty-hint">
          「上位10銘柄を探す」を押してスキャンを開始してください。結果は8時間キャッシュされます。
        </div>
      )}
    </div>
  )
}

// ── CT分析データをトレード記録用オブジェクトに変換 ──────────────────────────
function buildTradeData(ticker, sector, name, p) {
  return {
    ticker,
    name:                  name  || '',
    sector:                sector || '',
    direction:             p.direction,
    stableScore:           p.stableScore,
    confidence:            p.confidence,
    lastClose:             p.lastClose,
    relativeVolume:        p.relativeVolume,
    disciplinaryPct:       p.disciplinaryPct,
    obvTrend:              p.obvTrend,
    trendDays:             p.trendDays,
    isStagnating:          p.isStagnating,
    magnetStatus:          p.magnetEffect   ? p.magnetEffect.status        : null,
    initialVelocityLevel:  p.initialVelocity ? p.initialVelocity.level     : null,
    day2ConfirmStatus:     p.day2Confirmation ? p.day2Confirmation.status   : null,
    exitSignal:            p.exitJudgment   ? p.exitJudgment.exitRecommendation : null,
  }
}

// ── エントリー判断バッジ ──────────────────────────────────────────────────
function computeEntryJudgment(p) {
  const exitLevel = p.exitJudgment?.exitLevel ?? 0
  const isUp      = p.direction === 'UP'
  const ss        = p.stableScore ?? 0
  const iv        = p.initialVelocity
  const d2        = p.day2Confirmation
  const d2Active  = d2 && d2.status !== 'NO_SIGNAL'

  if (exitLevel === 3) {
    if (!isUp) return { grade: 'FORBID', label: 'エントリー禁止', icon: '✕', cls: 'ej-forbid',
      desc: '下降トレンド＋全決済シグナル — エントリーしてはいけません' }
    return { grade: 'PASS', label: '見送り推奨', icon: '⚠', cls: 'ej-pass',
      desc: 'EXIT_ALL発動中のUP銘柄 — 機関投資家の分散が始まっている可能性。新規エントリーは見送り推奨' }
  }
  if (!isUp) {
    if (exitLevel >= 2 || ss < -1)
      return { grade: 'FORBID', label: 'エントリー禁止', icon: '✕', cls: 'ej-forbid',
        desc: '下降トレンド＋複数の弱気シグナル — CT理論の原則：エントリーしてはいけません' }
    return { grade: 'CAUTION', label: '慎重に', icon: '△', cls: 'ej-caution',
      desc: '下降トレンド中 — 反転を確認してからエントリーを検討してください' }
  }
  if (exitLevel >= 1)
    return { grade: 'CAUTION', label: '慎重に', icon: '△', cls: 'ej-caution',
      desc: 'エグジットシグナル点灯中のUP銘柄 — 既存保有者は手仕舞い段階。新規エントリーは慎重に' }
  if (ss < 0)
    return { grade: 'CAUTION', label: '慎重に', icon: '△', cls: 'ej-caution',
      desc: '安定スコアがマイナス — 銘柄品質がCT基準を下回っています。見送りか小ロットで様子見を' }
  if (d2Active && d2.day1Dir > 0 && !d2.isConfirmed)
    return { grade: 'CAUTION', label: '慎重に', icon: '△', cls: 'ej-caution',
      desc: '2日目確認否定 — 上昇初動が翌日に否定されました。再度の上昇シグナルを待ってください' }

  // CT理論最強シグナル：品質ゲート＋2条件がともに揃う場合のみ【買いを強く推奨】
  // 品質ゲート：週次安定指標で銘柄品質を担保
  if (ss < 2) return { grade: 'OK', label: 'エントリー可', icon: '◎', cls: 'ej-ok',
    desc: 'UPトレンド＋保有継続シグナル — エントリー条件を満たしています（安定スコアが+2未満のため強推奨には至らず）' }

  // 条件1：規律可能性の高い銘柄を出来高と方向性が揃うタイミングで買う
  // relativeVolume > 1.3 はCTスコアリング閾値と一致（「資金流入の強い買い」判定ライン）
  // obvTrend UP で15日間の持続的機関投資家買いを確認（単日スパイクとの差別化）
  const cond1 = (p.disciplinaryPct ?? 0) >= 70
             && (p.relativeVolume ?? 0) > 1.3
             && p.obvTrend === 'UP'
  // 条件2：初速超高速かつ2日目確認済み（CT理論が定義する最強エントリーシグナル）
  const cond2 = iv?.level === 'VERY_HIGH' && iv?.isAligned && iv?.currentDir > 0
             && d2Active && d2.isConfirmed && d2.day1Dir > 0

  if (cond1 && cond2) {
    const magBonus = (p.magnetEffect?.status === 'NEW_HIGH' || p.magnetEffect?.status === 'BREAKOUT')
      ? '＋新高値更新（上値抵抗なし） ' : ''
    return { grade: 'STRONG_BUY', label: '買いを強く推奨', icon: '★', cls: 'ej-strong-buy',
      desc: `規律可能性高＋出来高整合＋OBV上昇＋初速超高速＋2日目確認 ${magBonus}— CT理論が定義する最強シグナルが全て揃っています` }
  }

  return { grade: 'OK', label: 'エントリー可', icon: '◎', cls: 'ej-ok',
    desc: 'UPトレンド＋保有継続シグナル＋安定スコア正 — CT理論の基本エントリー条件を満たしています' }
}

function EntryJudgmentBadge({ p, compact }) {
  const ej = computeEntryJudgment(p)
  if (compact) {
    return (
      <span className={`ej-badge-compact ${ej.cls}`}>
        {ej.icon} {ej.label}
      </span>
    )
  }
  return (
    <div className={`ej-badge ${ej.cls}`}>
      <div className="ej-badge-header">
        <span className="ej-badge-icon">{ej.icon}</span>
        <span className="ej-badge-label">{ej.label}</span>
      </div>
      <p className="ej-badge-desc">{ej.desc}</p>
    </div>
  )
}

// ── CT推奨上位2銘柄 ──────────────────────────────────────────────────────────
const GRADE_ORDER = { STRONG_BUY: 0, OK: 1, CAUTION: 2, PASS: 3, FORBID: 4 }

function TopRecommendations({ items, onSelectTicker, onRecordTrade }) {
  if (!items || items.length === 0) return null

  const top = [...items]
    .map(item => ({ ...item, ej: computeEntryJudgment(item.prediction) }))
    .filter(item => item.ej.grade !== 'FORBID' && item.ej.grade !== 'PASS')
    .sort((a, b) => {
      const gd = GRADE_ORDER[a.ej.grade] - GRADE_ORDER[b.ej.grade]
      if (gd !== 0) return gd
      return (b.prediction.stableScore ?? 0) - (a.prediction.stableScore ?? 0)
    })
    .slice(0, 2)

  if (top.length === 0) return null

  return (
    <div className="top-reco-panel">
      <div className="top-reco-title">CT推奨上位{top.length}銘柄</div>
      <div className="top-reco-list">
        {top.map((item, i) => {
          const p = item.prediction
          return (
            <div key={item.ticker} className={`top-reco-item ${i === 0 ? 'top-reco-first' : ''}`}>
              <div className="top-reco-rank">{i === 0 ? '1位' : '2位'}</div>
              <div className="top-reco-info">
                <div className="top-reco-ticker">{item.ticker}</div>
                {item.name && <div className="top-reco-name">{item.name}</div>}
                <EntryJudgmentBadge p={p} compact />
              </div>
              <div className="top-reco-scores">
                <div className="top-reco-score">安定 {p.stableScore > 0 ? '+' : ''}{p.stableScore}</div>
                <div className="top-reco-conf">{p.confidence}%</div>
              </div>
              <div className="top-reco-btns">
                <button className="btn-select-ticker" onClick={() => onSelectTicker(item.ticker)}>
                  詳細 →
                </button>
                {onRecordTrade && (
                  <button
                    className="btn-tj-record"
                    title="購入を記録"
                    onClick={() => onRecordTrade(buildTradeData(item.ticker, item.sector, item.name, p))}
                  >
                    📝
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── トレード記録パネル ──────────────────────────────────────────────────────
function TradeJournalPanel({ preFill, onPreFillConsumed }) {
  const today    = () => new Date().toISOString().slice(0, 10)
  const panelRef = useRef(null)

  const [trades, setTrades]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('ct_trades') || '[]') } catch { return [] }
  })
  const [showForm, setShowForm]     = useState(false)
  const [isPreFill, setIsPreFill]   = useState(false)
  const [autoData, setAutoData]     = useState(null)
  const [entryDate, setEntryDate]   = useState(today())
  const [entryPrice, setEntryPrice] = useState('')
  const [manualTicker, setManualTicker] = useState('')
  const [exitId, setExitId]         = useState(null)
  const [exitForm, setExitForm]     = useState({ exitDate: today(), exitPrice: '', exitReason: '利確' })

  // preFillが届いたら自動でフォームを開く
  useEffect(() => {
    if (!preFill) return
    setAutoData(preFill)
    setIsPreFill(true)
    setEntryDate(today())
    setEntryPrice('')
    setShowForm(true)
    onPreFillConsumed?.()
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [preFill])

  const save = (next) => { setTrades(next); localStorage.setItem('ct_trades', JSON.stringify(next)) }

  const addTrade = () => {
    const ticker = isPreFill ? autoData.ticker : manualTicker.trim().toUpperCase()
    if (!ticker || !entryPrice) return
    save([{
      id: Date.now().toString(),
      ticker,
      name:                  autoData?.name  || '',
      sector:                autoData?.sector || '',
      direction:             autoData?.direction             ?? null,
      stableScore:           autoData?.stableScore           ?? null,
      confidence:            autoData?.confidence            ?? null,
      relativeVolume:        autoData?.relativeVolume        ?? null,
      disciplinaryPct:       autoData?.disciplinaryPct       ?? null,
      obvTrend:              autoData?.obvTrend              || null,
      trendDays:             autoData?.trendDays             ?? null,
      isStagnating:          autoData?.isStagnating          ?? null,
      magnetStatus:          autoData?.magnetStatus          || null,
      initialVelocityLevel:  autoData?.initialVelocityLevel  || null,
      day2ConfirmStatus:     autoData?.day2ConfirmStatus     || null,
      exitSignal:            autoData?.exitSignal            || null,
      marketPhase:           autoData?.marketPhase           || null,
      entryRefClose:         autoData?.lastClose             || null,
      entryDate,
      entryPrice: +entryPrice,
      exitDate: null, exitPrice: null, exitReason: null,
    }, ...trades])
    setShowForm(false)
    setIsPreFill(false)
    setAutoData(null)
    setEntryDate(today())
    setEntryPrice('')
    setManualTicker('')
  }

  const recordExit = (id) => {
    if (!exitForm.exitPrice) return
    save(trades.map(t => t.id === id
      ? { ...t, exitDate: exitForm.exitDate, exitPrice: +exitForm.exitPrice, exitReason: exitForm.exitReason }
      : t
    ))
    setExitId(null)
    setExitForm({ exitDate: today(), exitPrice: '', exitReason: '利確' })
  }

  const deleteTrade = (id) => {
    if (window.confirm('このトレード記録を削除しますか？')) save(trades.filter(t => t.id !== id))
  }

  const pnl  = (t) => t.exitPrice && t.entryPrice ? ((t.exitPrice - t.entryPrice) / t.entryPrice * 100).toFixed(1) : null
  const daysHeld = (t) => t.exitDate && t.entryDate ? Math.round((new Date(t.exitDate) - new Date(t.entryDate)) / 86400000) : null

  const exportCSV = () => {
    const hdr = ['購入日','ティッカー','会社名','セクター','方向','安定スコア','確信度','出来高比率','規律可能性%','OBV','連続日数','停滞','マグネット','初速','2日目確認','エグジット信号','相場環境','購入価格','参考終値','売却日','売却価格','損益%','保有日数','売却理由']
    const rows = trades.map(t => {
      const p = pnl(t); const d = daysHeld(t)
      return [
        t.entryDate, t.ticker, t.name || '', t.sector || '',
        t.direction || '', t.stableScore ?? '', t.confidence ?? '',
        t.relativeVolume != null ? (t.relativeVolume * 100).toFixed(0) + '%' : '',
        t.disciplinaryPct ?? '',
        t.obvTrend || '', t.trendDays ?? '',
        t.isStagnating == null ? '' : (t.isStagnating ? '有' : '無'),
        t.magnetStatus || '', t.initialVelocityLevel || '', t.day2ConfirmStatus || '',
        t.exitSignal || '', t.marketPhase || '',
        t.entryPrice, t.entryRefClose || '',
        t.exitDate || '', t.exitPrice || '',
        p ? p + '%' : '', d ?? '', t.exitReason || '',
      ]
    })
    const csv = [hdr, ...rows].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a   = Object.assign(document.createElement('a'), { href: url, download: `ct_trades_${today()}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }

  const handleNewManual = () => {
    setIsPreFill(false)
    setAutoData(null)
    setEntryDate(today())
    setEntryPrice('')
    setManualTicker('')
    setShowForm(v => !v)
  }

  const holding = trades.filter(t => !t.exitDate)
  const closed  = trades.filter(t =>  t.exitDate)
  const wins    = closed.filter(t => +pnl(t) > 0).length
  const winRate = closed.length > 0 ? Math.round(wins / closed.length * 100) : null

  const phaseClass = { EASY: 'tj-phase-easy', NORMAL: 'tj-phase-normal', HARD: 'tj-phase-hard' }
  const obvLabel   = (v) => v === 'UP' ? '▲ 上昇' : v === 'DOWN' ? '▼ 下降' : '━ 横ばい'
  const magLabel   = (s) => {
    if (!s) return '-'
    const MAP = { NEW_HIGH: '新高値', BREAKOUT: 'ブレイクアウト', APPROACHING: '接近中', RESISTANCE: '抵抗帯', FAR: '遠い' }
    return MAP[s] || s
  }

  return (
    <div className="card trade-journal-panel" ref={panelRef}>
      <div className="tj-header">
        <div>
          <div className="tj-title">トレード記録</div>
          <div className="tj-subtitle">CT理論に基づく売買履歴・損益管理</div>
        </div>
        <div className="tj-header-btns">
          <button className="btn-tj-add" onClick={handleNewManual}>
            {showForm && !isPreFill ? '▲ 閉じる' : '＋ 新規記録'}
          </button>
          {trades.length > 0 && (
            <button className="btn-tj-csv" onClick={exportCSV}>CSV出力</button>
          )}
        </div>
      </div>

      {/* サマリー */}
      {trades.length > 0 && (
        <div className="tj-summary">
          <div className="tj-stat"><span>総取引数</span><strong>{trades.length}</strong></div>
          <div className="tj-stat"><span>保有中</span><strong>{holding.length}</strong></div>
          <div className="tj-stat"><span>完了</span><strong>{closed.length}</strong></div>
          {winRate !== null && (
            <div className="tj-stat"><span>勝率</span><strong className={winRate >= 50 ? 'val-up' : 'val-down'}>{winRate}%</strong></div>
          )}
        </div>
      )}

      {/* エントリーフォーム */}
      {showForm && (
        <div className="tj-form">
          <div className="tj-form-title">
            {isPreFill && autoData ? `📝 ${autoData.ticker}（${autoData.name || ''}）— エントリー記録` : 'エントリー記録（手動）'}
          </div>

          {/* 手動入力時のみティッカー入力欄を表示 */}
          {!isPreFill && (
            <label className="tj-note-label">ティッカー
              <input value={manualTicker} onChange={e => setManualTicker(e.target.value.toUpperCase())} placeholder="例: 5803.T" />
            </label>
          )}

          {/* CT自動入力データ（プレフィル時のみ） */}
          {isPreFill && autoData && (
            <div className="tj-prefill-section">
              <div className="tj-prefill-label">CT分析データ（自動記録 — 14項目）</div>
              {autoData.lastClose != null && (() => {
                const isUS  = !autoData.ticker.endsWith('.T')
                const jpyVal = isUS
                  ? Math.round(autoData.lastClose * USD_JPY_RATE)
                  : Math.round(autoData.lastClose)
                return (
                  <div className="tj-ref-price">
                    直近終値（参考）:{' '}
                    <strong>¥{jpyVal.toLocaleString()}</strong>
                    {isUS && (
                      <span className="tj-ref-usd">
                        　${autoData.lastClose.toFixed(2)} × {USD_JPY_RATE}円/USD
                      </span>
                    )}
                  </div>
                )
              })()}
              <div className="tj-prefill-grid">
                <div className="tj-pf-item">
                  <span className="tj-pf-label">方向</span>
                  <span className={`tj-pf-val ${autoData.direction === 'UP' ? 'val-up' : 'val-down'}`}>
                    {autoData.direction === 'UP' ? '▲ UP' : '▼ DOWN'}
                  </span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">安定スコア</span>
                  <span className={`tj-pf-val ${autoData.stableScore > 0 ? 'val-up' : 'val-down'}`}>
                    {autoData.stableScore > 0 ? '+' : ''}{autoData.stableScore}
                  </span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">確信度</span>
                  <span className="tj-pf-val">{autoData.confidence}%</span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">OBV</span>
                  <span className={`tj-pf-val ${autoData.obvTrend === 'UP' ? 'val-up' : autoData.obvTrend === 'DOWN' ? 'val-down' : ''}`}>
                    {obvLabel(autoData.obvTrend)}
                  </span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">出来高比率</span>
                  <span className="tj-pf-val">
                    {autoData.relativeVolume != null ? (autoData.relativeVolume * 100).toFixed(0) + '%' : '-'}
                  </span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">規律可能性</span>
                  <span className="tj-pf-val">{autoData.disciplinaryPct != null ? autoData.disciplinaryPct + '%' : '-'}</span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">連続日数</span>
                  <span className="tj-pf-val">{autoData.trendDays != null ? autoData.trendDays + '日' : '-'}</span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">停滞シグナル</span>
                  <span className={`tj-pf-val ${autoData.isStagnating ? 'val-up' : ''}`}>
                    {autoData.isStagnating == null ? '-' : autoData.isStagnating ? '有り' : '無し'}
                  </span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">マグネット</span>
                  <span className="tj-pf-val">{magLabel(autoData.magnetStatus)}</span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">初速判定</span>
                  <span className="tj-pf-val">{autoData.initialVelocityLevel || '-'}</span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">2日目確認</span>
                  <span className="tj-pf-val">{autoData.day2ConfirmStatus || '-'}</span>
                </div>
                <div className="tj-pf-item">
                  <span className={`tj-pf-val ${autoData.exitSignal && autoData.exitSignal !== 'HOLD' ? 'val-down' : 'val-up'}`}>
                    <span className="tj-pf-label">エグジット信号</span>
                    {autoData.exitSignal || '-'}
                  </span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">相場環境</span>
                  <span className={`tj-pf-val tj-phase-text-${(autoData.marketPhase || '').toLowerCase()}`}>
                    {autoData.marketPhase || '-'}
                  </span>
                </div>
                <div className="tj-pf-item">
                  <span className="tj-pf-label">セクター</span>
                  <span className="tj-pf-val">{autoData.sector || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* ユーザー入力: 購入日 + 購入価格のみ */}
          <div className="tj-user-inputs">
            <label>購入日
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </label>
            <label>購入価格（円）
              <input
                type="number"
                value={entryPrice}
                onChange={e => setEntryPrice(e.target.value)}
                placeholder={autoData?.lastClose != null
                  ? (() => {
                      const isUS = !autoData.ticker.endsWith('.T')
                      const jpyVal = isUS ? Math.round(autoData.lastClose * USD_JPY_RATE) : Math.round(autoData.lastClose)
                      return `参考: ¥${jpyVal.toLocaleString()}`
                    })()
                  : '例: 6200'
                }
              />
            </label>
          </div>

          <div className="tj-form-actions">
            <button
              className="btn-tj-save"
              onClick={addTrade}
              disabled={isPreFill ? !entryPrice : (!manualTicker.trim() || !entryPrice)}
            >
              記録する
            </button>
            <button className="btn-tj-cancel" onClick={() => { setShowForm(false); setIsPreFill(false); setAutoData(null) }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 保有中 */}
      {holding.length > 0 && (
        <div className="tj-section">
          <div className="tj-section-title">保有中 ({holding.length}件)</div>
          {holding.map(t => (
            <div key={t.id} className="tj-trade-item tj-holding">
              <div className="tj-trade-left">
                <span className="tj-trade-ticker">{t.ticker}</span>
                {t.marketPhase && (
                  <span className={`tj-trade-phase ${phaseClass[t.marketPhase] || ''}`}>{t.marketPhase}</span>
                )}
                {t.direction && (
                  <span className={`tj-trade-dir ${t.direction === 'UP' ? 'val-up' : 'val-down'}`}>
                    {t.direction === 'UP' ? '▲' : '▼'}
                  </span>
                )}
                {t.stableScore != null && (
                  <span className="tj-trade-score">安定{t.stableScore > 0 ? '+' : ''}{t.stableScore}</span>
                )}
              </div>
              <div className="tj-trade-right">
                <span className="tj-trade-meta">¥{t.entryPrice.toLocaleString()}　{t.entryDate}</span>
                {exitId === t.id ? (
                  <div className="tj-exit-form">
                    <input type="date" value={exitForm.exitDate} onChange={e => setExitForm(f => ({...f, exitDate: e.target.value}))} />
                    <input type="number" value={exitForm.exitPrice} onChange={e => setExitForm(f => ({...f, exitPrice: e.target.value}))} placeholder="売却価格" />
                    <select value={exitForm.exitReason} onChange={e => setExitForm(f => ({...f, exitReason: e.target.value}))}>
                      <option>利確</option>
                      <option>分散エグジット発動</option>
                      <option>損切り</option>
                      <option>その他</option>
                    </select>
                    <button className="btn-tj-exit-ok" onClick={() => recordExit(t.id)}>確定</button>
                    <button className="btn-tj-cancel" onClick={() => setExitId(null)}>×</button>
                  </div>
                ) : (
                  <div className="tj-trade-actions">
                    <button
                      className="btn-tj-exit"
                      onClick={() => { setExitId(t.id); setExitForm({ exitDate: today(), exitPrice: '', exitReason: '利確' }) }}
                    >
                      手仕舞い記録
                    </button>
                    <button className="btn-tj-del" onClick={() => deleteTrade(t.id)}>削除</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 完了トレード */}
      {closed.length > 0 && (
        <div className="tj-section">
          <div className="tj-section-title">完了 ({closed.length}件)</div>
          {closed.map(t => {
            const p = pnl(t); const d = daysHeld(t)
            return (
              <div key={t.id} className={`tj-trade-item ${+p > 0 ? 'tj-win' : 'tj-loss'}`}>
                <div className="tj-trade-left">
                  <span className="tj-trade-ticker">{t.ticker}</span>
                  {t.marketPhase && (
                    <span className={`tj-trade-phase ${phaseClass[t.marketPhase] || ''}`}>{t.marketPhase}</span>
                  )}
                  <span className={`tj-pnl ${+p > 0 ? 'val-up' : 'val-down'}`}>{+p > 0 ? '+' : ''}{p}%</span>
                </div>
                <div className="tj-trade-right">
                  <span className="tj-trade-meta">
                    {t.entryDate}→{t.exitDate}　{d !== null ? `${d}日` : ''}　{t.exitReason}
                  </span>
                  <button className="btn-tj-del" onClick={() => deleteTrade(t.id)}>削除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {trades.length === 0 && !showForm && (
        <div className="tj-empty">各分析パネルの「📝」ボタンからCTデータを自動取り込みできます。または「＋ 新規記録」から手動入力も可能です。</div>
      )}
    </div>
  )
}

// ── 詳細カード ─────────────────────────────────────────────────────────────
function DetailCard({ item, onClose }) {
  const p = item.prediction
  return (
    <div className="card result detail-card">
      <div className="detail-header">
        <div>
          <div className="result-ticker-label">{item.ticker}</div>
          {item.name && <div className="result-company-name">{item.name}</div>}
        </div>
        <button className="btn-close" onClick={onClose}>✕ 閉じる</button>
      </div>

      <div className={`direction ${p.direction === 'UP' ? 'up' : 'down'}`}>
        <span className="arrow">{p.direction === 'UP' ? '▲' : '▼'}</span>
        <span className="label">{p.direction === 'UP' ? '上昇傾向' : '下降傾向'}</span>
        <span className="confidence">確信度 {p.confidence}%</span>
      </div>

      <div className="score-row">
        <div className="score-block">
          <span className="score-label">安定スコア</span>
          <span className={`score-val ${p.stableScore > 0 ? 'val-up' : 'val-down'}`}>
            {p.stableScore > 0 ? '+' : ''}{p.stableScore}
          </span>
          <span className="score-sub">銘柄品質（7指標）</span>
        </div>
        <div className="score-block">
          <span className="score-label">総合スコア</span>
          <span className={`score-val ${p.score > 0 ? 'val-up' : 'val-down'}`}>
            {p.score > 0 ? '+' : ''}{p.score}
          </span>
          <span className="score-sub">＋エントリータイミング</span>
        </div>
      </div>

      <EntryJudgmentBadge p={p} />

      <CTMetrics p={p} />

      <ExitPanel p={p} />

      {p.forecast && (
        <div className="forecast">
          <div className="forecast-label">1か月後の見通し（CLEAR TRADE分析）</div>
          <div className={`forecast-outlook ${p.forecast.outlook === 'LIKELY_UP' ? 'up' : p.forecast.outlook === 'LIKELY_DOWN' ? 'down' : 'uncertain'}`}>
            {p.forecast.outlook === 'LIKELY_UP' ? '▲ 上昇の可能性あり' : p.forecast.outlook === 'LIKELY_DOWN' ? '▼ 下落リスクあり' : '━ 方向性は不透明'}
          </div>
          <p className="forecast-text">{p.forecast.text}</p>
        </div>
      )}

      {(() => {
        const sector = getStockSector(item.ticker)
        const sm = sector ? SECTOR_MACRO[sector] : null
        if (!sm) return null
        const dirLabel = sm.direction === 'UP' ? '▲ 強気' : sm.direction === 'DOWN' ? '▼ 弱気' : '━ 中立'
        const dirClass = sm.direction === 'UP' ? 'macro-dir-up' : sm.direction === 'DOWN' ? 'macro-dir-down' : 'macro-dir-neutral'
        return (
          <div className="macro-stock-section">
            <div className="macro-stock-header">
              <span className="macro-stock-title">マクロ環境（参考）</span>
              <span className="macro-stock-sector">{sector}</span>
              <span className={`macro-stock-dir ${dirClass}`}>{dirLabel}</span>
              <span className={`macro-stock-score ${sm.score > 0 ? 'pos' : sm.score < 0 ? 'neg' : 'zero'}`}>
                スコア {sm.score > 0 ? '+' : ''}{sm.score}
              </span>
            </div>
            <p className="macro-stock-signal">{sm.signal}</p>
          </div>
        )
      })()}

      {(() => {
        const rec = getSameIndustryRecommendations(item.ticker)
        if (!rec) return null
        return (
          <div className="recommendation">
            <div className="recommendation-label">同業種のおすすめ銘柄 <span className="rec-industry">({rec.industry})</span></div>
            <div className="recommendation-list">
              {rec.stocks.map(s => (
                <div key={s.ticker} className="recommendation-item">
                  <span className="rec-ticker">{s.ticker}</span>
                  {s.name && <span className="rec-name">{s.name}</span>}
                </div>
              ))}
            </div>
            <p className="recommendation-hint">※ 上記のティッカーシンボルを入力して比較できます</p>
          </div>
        )
      })()}

      <div className="signals">
        <h3>判定根拠（CLEAR TRADE指標）</h3>
        <ul>
          {p.signals.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      <div className="chart-wrap">
        <StockChart chartData={p.chartData} />
      </div>

      <p className="disclaimer">※ CLEAR TRADE理論（出来高＋純粋チャート分析）による参考情報です。投資判断の最終責任はご自身にあります。</p>
    </div>
  )
}

// ── 日経平均パネル ─────────────────────────────────────────────────────────
function NikkeiPanel({ gasUrl, apiKey }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const mc = MACRO_CONTEXT

  const heatLabel = mc.heatLevel === 'OVERHEAT' ? '⚠ 過熱ぎみ（短期）'
    : mc.heatLevel === 'ROOM_TO_RISE' ? '↑ 上昇余地あり' : '● 適正水準'
  const heatClass = mc.heatLevel === 'OVERHEAT' ? 'overheat'
    : mc.heatLevel === 'ROOM_TO_RISE' ? 'room' : 'neutral'
  const weeklyClass = mc.weeklyOutlook === 'UP' ? 'up' : mc.weeklyOutlook === 'DOWN' ? 'down' : 'uncertain'
  const weeklyLabel = mc.weeklyOutlook === 'UP' ? '▲ 上昇予測'
    : mc.weeklyOutlook === 'DOWN' ? '▼ 下落予測' : '━ 方向性不透明（調整→もみ合い）'

  const handleAnalyze = async () => {
    if (!gasUrl && !apiKey) { setError('GAS URL を入力してください。'); return }
    setLoading(true); setError(null)
    try {
      const { prices } = await fetchStockData('^N225', { gasUrl, apiKey })
      setData(predict(prices, 7))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="card nikkei-panel">
      <div className="nikkei-header">
        <div>
          <div className="nikkei-title">日経平均株価（^N225）1週間予測</div>
          <div className="nikkei-subtitle">CLEAR TRADE分析 ＋ マクロ環境参考</div>
        </div>
        <button className="btn-nikkei" onClick={handleAnalyze} disabled={loading}>
          {loading ? '取得中...' : '今すぐ分析'}
        </button>
      </div>

      {error && <div className="nikkei-error">{error}</div>}

      {data && (
        <div className="nikkei-tech">
          <div className={`direction ${data.direction === 'UP' ? 'up' : 'down'}`} style={{ margin: '12px 0' }}>
            <span className="arrow">{data.direction === 'UP' ? '▲' : '▼'}</span>
            <span className="label">{data.direction === 'UP' ? '上昇傾向' : '下降傾向'}</span>
            <span className="confidence">確信度 {data.confidence}%</span>
          </div>
          <div className="metrics">
            <div className="metric"><span>現在値</span><strong>{data.lastClose.toFixed(0)}円</strong></div>
            <div className="metric">
              <span>出来高比率</span>
              <strong>{data.relativeVolume != null ? `${(data.relativeVolume * 100).toFixed(0)}%` : '-'}</strong>
            </div>
            <div className="metric">
              <span>規律可能性</span>
              <strong>{data.disciplinaryPct != null ? `${data.disciplinaryPct}%` : '-'}</strong>
            </div>
            <div className="metric">
              <span>OBV</span>
              <strong className={data.obvTrend === 'UP' ? 'val-up' : data.obvTrend === 'DOWN' ? 'val-down' : ''}>
                {data.obvTrend === 'UP' ? '▲ 上昇' : data.obvTrend === 'DOWN' ? '▼ 下降' : '━ 横ばい'}
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="macro-score-row">
        <div className="macro-score-box">
          <div className="macro-score-label">マクロスコア</div>
          <div className="macro-score-value">
            {mc.totalScore > 0 ? '+' : ''}{mc.totalScore}
            <span className="macro-score-max"> / {mc.maxScore}</span>
          </div>
          <div className="macro-score-desc">やや強気</div>
        </div>
        <div className={`heat-box ${heatClass}`}>
          <div className="heat-label">過熱度判定</div>
          <div className="heat-value">{heatLabel}</div>
        </div>
      </div>

      <div className={`nikkei-weekly ${weeklyClass}`}>
        <div className="nikkei-weekly-label">1週間の方向性</div>
        <div className="nikkei-weekly-dir">{weeklyLabel}</div>
        <p className="nikkei-weekly-text">{mc.weeklyText}</p>
      </div>

      <div className="macro-factors">
        <div className="macro-factors-col">
          <div className="factors-title bull">強気要因（Bull）</div>
          {mc.factors.bull.map((f, i) => (
            <div key={i} className="factor-item bull">
              <span className="factor-label">{f.label}</span>
              <span className="factor-text">{f.text}</span>
            </div>
          ))}
        </div>
        <div className="macro-factors-col">
          <div className="factors-title bear">弱気要因（Bear）</div>
          {mc.factors.bear.map((f, i) => (
            <div key={i} className="factor-item bear">
              <span className="factor-label">{f.label}</span>
              <span className="factor-text">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <details className="macro-breakdown">
        <summary>スコア内訳を見る</summary>
        <table className="breakdown-table">
          <thead><tr><th>項目</th><th>スコア</th><th>根拠</th></tr></thead>
          <tbody>
            {mc.scoreBreakdown.map((r, i) => (
              <tr key={i}>
                <td>{r.item}</td>
                <td className={r.score > 0 ? 'score-pos' : r.score < 0 ? 'score-neg' : ''}>{r.score > 0 ? '+' : ''}{r.score}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="disclaimer">調査日: {mc.researchDate}　※マクロ情報は参考目安です。投資判断の最終責任はご自身にあります。</p>
    </div>
  )
}

// ── メインApp ──────────────────────────────────────────────────────────────
export default function App() {
  const [gasUrl, setGasUrl]         = useState(() => localStorage.getItem('gas_url') || '')
  const [apiKey, setApiKey]         = useState(() => localStorage.getItem('av_api_key') || '')
  const [symbols, setSymbols]       = useState('AAPL')
  const [days, setDays]             = useState(14)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [result, setResult]         = useState(null)
  const [rankingResults, setRankingResults]   = useState(null)
  const [selectedDetail, setSelectedDetail]   = useState(null)
  const [lastMarketPhase, setLastMarketPhase] = useState(null)
  const [tradePreFill, setTradePreFill]       = useState(null)

  const handlePhaseResolved = (phase) => setLastMarketPhase(phase)
  const handleRecordTrade   = (ctData) => setTradePreFill({ ...ctData, marketPhase: ctData.marketPhase ?? lastMarketPhase })

  // スクリーナー・先導株から銘柄をフォームに送り込むコールバック
  const handleSelectTicker = (ticker) => {
    setSymbols(ticker)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleSelectSet = (tickersCsv) => {
    setSymbols(tickersCsv)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!gasUrl.trim() && !apiKey.trim()) {
      setError('GAS URL または Alpha Vantage APIキーのどちらかを入力してください。')
      return
    }
    if (gasUrl.trim()) localStorage.setItem('gas_url', gasUrl.trim())
    if (apiKey.trim()) localStorage.setItem('av_api_key', apiKey.trim())

    const tickerList = symbols.split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_TICKERS)

    if (tickerList.length === 0) {
      setError('ティッカーシンボルを入力してください。')
      return
    }

    setLoading(true); setError(null); setResult(null)
    setRankingResults(null); setSelectedDetail(null)

    if (tickerList.length === 1) {
      try {
        const { prices, name } = await fetchStockData(tickerList[0], { gasUrl: gasUrl.trim(), apiKey: apiKey.trim() })
        const sector0     = getStockSector(tickerList[0])
        const macroAdjust = sector0 && SECTOR_MACRO[sector0] ? { sector: sector0, ...SECTOR_MACRO[sector0] } : null
        setResult({ ticker: tickerList[0], name, ...predict(prices, days, macroAdjust) })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    } else {
      try {
        const settled = await Promise.allSettled(
          tickerList.map(ticker => fetchStockData(ticker, { gasUrl: gasUrl.trim(), apiKey: apiKey.trim() }))
        )
        const ranked = settled
          .map((r, i) => {
            const sec = getStockSector(tickerList[i])
            const ma  = sec && SECTOR_MACRO[sec] ? { sector: sec, ...SECTOR_MACRO[sec] } : null
            return {
              ticker:     tickerList[i],
              name:       r.status === 'fulfilled' ? r.value.name : null,
              prediction: r.status === 'fulfilled' ? predict(r.value.prices, days, ma) : null,
              error:      r.status === 'rejected'  ? r.reason.message : null,
            }
          })
          .sort((a, b) => {
            if (!a.prediction) return 1
            if (!b.prediction) return -1
            return b.prediction.score - a.prediction.score
          })
        setRankingResults(ranked)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleTickerClick = (item) => {
    if (!item.prediction) return
    setSelectedDetail(prev => prev?.ticker === item.ticker ? null : item)
  }

  return (
    <div className="app">
      <h1>株価予測アプリ</h1>

      {/* ── 入力フォーム ── */}
      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label>GAS URL <span className="badge">日本株・米国株対応</span></label>
          <input
            type="text"
            value={gasUrl}
            onChange={e => setGasUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/..."
          />
          <span className="hint">GASをデプロイして取得したURLを貼り付けてください（設定方法は下記参照）</span>
        </div>

        <div className="divider">または</div>

        <div className="field">
          <label>Alpha Vantage APIキー <span className="badge gray">米国株のみ</span></label>
          <input
            type="text"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="YOUR_API_KEY"
          />
          <span className="hint">
            無料取得：<a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer">alphavantage.co</a>（25回/日）
          </span>
        </div>

        <div className="row">
          <div className="field">
            <label>ティッカーシンボル <span className="badge">最大{MAX_TICKERS}銘柄</span></label>
            <input
              type="text"
              value={symbols}
              onChange={e => setSymbols(e.target.value.toUpperCase())}
              placeholder="例: 5706.T, 7203.T, AAPL"
            />
            <span className="hint">複数銘柄はカンマ区切りで入力（例: 5706.T, 7203.T）</span>
          </div>
          <div className="field">
            <label>分析期間</label>
            <select value={days} onChange={e => setDays(Number(e.target.value))}>
              <option value={7}>1週間</option>
              <option value={14}>2週間</option>
              <option value={21}>3週間</option>
              <option value={28}>4週間</option>
              <option value={56}>8週間</option>
              <option value={84}>12週間</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn">
          {loading ? '分析中...' : '予測する'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {/* ── 次元1：相場環境判断パネル ── */}
      <MarketPhasePanel
        gasUrl={gasUrl.trim()}
        onSelectTicker={handleSelectTicker}
        onPhaseResolved={handlePhaseResolved}
      />

      {/* ── 先導株パネル ── */}
      <LeaderPanel
        gasUrl={gasUrl.trim()}
        onSelectTicker={handleSelectTicker}
        onSelectSet={handleSelectSet}
        onRecordTrade={handleRecordTrade}
      />

      {/* ── CTスクリーニングパネル ── */}
      <CTScreenerPanel
        gasUrl={gasUrl.trim()}
        onSelectTicker={handleSelectTicker}
        onSelectSet={handleSelectSet}
        onRecordTrade={handleRecordTrade}
      />

      {/* ── トレード記録パネル ── */}
      <TradeJournalPanel
        preFill={tradePreFill}
        onPreFillConsumed={() => setTradePreFill(null)}
      />

      {/* ── 単体分析結果 ── */}
      {result && (
        <div className="card result">
          <div className="result-ticker-label">{result.ticker}</div>
          {result.name && <div className="result-company-name">{result.name}</div>}
          <div className={`direction ${result.direction === 'UP' ? 'up' : 'down'}`}>
            <span className="arrow">{result.direction === 'UP' ? '▲' : '▼'}</span>
            <span className="label">{result.direction === 'UP' ? '上昇傾向' : '下降傾向'}</span>
            <span className="confidence">確信度 {result.confidence}%</span>
          </div>

          <EntryJudgmentBadge p={result} />

          <CTMetrics p={result} />

          <ExitPanel p={result} />

          {result.forecast && (
            <div className="forecast">
              <div className="forecast-label">1か月後の見通し（CLEAR TRADE分析）</div>
              <div className={`forecast-outlook ${result.forecast.outlook === 'LIKELY_UP' ? 'up' : result.forecast.outlook === 'LIKELY_DOWN' ? 'down' : 'uncertain'}`}>
                {result.forecast.outlook === 'LIKELY_UP' ? '▲ 上昇の可能性あり' : result.forecast.outlook === 'LIKELY_DOWN' ? '▼ 下落リスクあり' : '━ 方向性は不透明'}
              </div>
              <p className="forecast-text">{result.forecast.text}</p>
            </div>
          )}

          {(() => {
            const sector = getStockSector(result.ticker)
            const sm = sector ? SECTOR_MACRO[sector] : null
            if (!sm) return null
            const dirLabel = sm.direction === 'UP' ? '▲ 強気' : sm.direction === 'DOWN' ? '▼ 弱気' : '━ 中立'
            const dirClass = sm.direction === 'UP' ? 'macro-dir-up' : sm.direction === 'DOWN' ? 'macro-dir-down' : 'macro-dir-neutral'
            return (
              <div className="macro-stock-section">
                <div className="macro-stock-header">
                  <span className="macro-stock-title">マクロ環境（参考）</span>
                  <span className="macro-stock-sector">{sector}</span>
                  <span className={`macro-stock-dir ${dirClass}`}>{dirLabel}</span>
                  <span className={`macro-stock-score ${sm.score > 0 ? 'pos' : sm.score < 0 ? 'neg' : 'zero'}`}>
                    スコア {sm.score > 0 ? '+' : ''}{sm.score}
                  </span>
                </div>
                <p className="macro-stock-signal">{sm.signal}</p>
              </div>
            )
          })()}

          {(() => {
            const rec = getSameIndustryRecommendations(result.ticker)
            if (!rec) return null
            return (
              <div className="recommendation">
                <div className="recommendation-label">同業種のおすすめ銘柄 <span className="rec-industry">({rec.industry})</span></div>
                <div className="recommendation-list">
                  {rec.stocks.map(s => (
                    <div key={s.ticker} className="recommendation-item">
                      <span className="rec-ticker">{s.ticker}</span>
                      {s.name && <span className="rec-name">{s.name}</span>}
                    </div>
                  ))}
                </div>
                <p className="recommendation-hint">※ 上記のティッカーシンボルを入力して比較できます</p>
              </div>
            )
          })()}

          <div className="signals">
            <h3>判定根拠（CLEAR TRADE指標）</h3>
            <ul>
              {result.signals.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="chart-wrap">
            <StockChart chartData={result.chartData} />
          </div>

          <button
            className="btn-tj-record-main"
            onClick={() => handleRecordTrade(buildTradeData(result.ticker, getStockSector(result.ticker) || '', result.name || '', result))}
          >
            📝 購入を記録
          </button>

          <p className="disclaimer">※ CLEAR TRADE理論（出来高＋純粋チャート分析）による参考情報です。投資判断の最終責任はご自身にあります。</p>
        </div>
      )}

      {/* ── 比較ランキング ── */}
      {rankingResults && (() => {
        const advice = generateBuyAdvice(rankingResults)
        return (
          <>
            {advice && (
              <div className="card buy-advice">
                <div className="buy-advice-eyebrow">今買うなら</div>
                <div className="buy-advice-winner-row">
                  <span className="buy-advice-arrow">▲</span>
                  <div className="buy-advice-name-block">
                    <span className="buy-advice-ticker">{advice.winner.ticker}</span>
                    {advice.winner.name && <span className="buy-advice-name">{advice.winner.name}</span>}
                  </div>
                  <div className="buy-advice-score-block">
                    <span className="buy-advice-score-label">総合スコア</span>
                    <span className="buy-advice-score-val">{advice.winner.prediction.score > 0 ? '+' : ''}{advice.winner.prediction.score}</span>
                    <span className="buy-advice-conf">確信度 {advice.winner.prediction.confidence}%</span>
                  </div>
                </div>
                {advice.allDown && (
                  <div className="buy-advice-warning">全銘柄が下降傾向です。購入は慎重に。最も下落が小さいと予測される銘柄を示しています。</div>
                )}
                {advice.reasons.length > 0 && (
                  <ul className="buy-advice-reasons">
                    {advice.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                {advice.comparisonNote && (
                  <div className="buy-advice-vs">{advice.comparisonNote}</div>
                )}
              </div>
            )}

            <div className="card">
              <h2 className="ranking-title">比較ランキング（{rankingResults.filter(i => i.prediction).length}銘柄）</h2>
              <div className="ranking">
                {rankingResults.map((item, i) => (
                  <div key={item.ticker} className={`rank-card ${i === 0 ? 'winner' : ''} ${selectedDetail?.ticker === item.ticker ? 'selected' : ''}`}>
                    <div className="rank-number">{RANK_LABELS[i]}</div>
                    <div className="rank-body">
                      <div
                        className={`rank-ticker ${item.prediction ? 'clickable' : ''}`}
                        onClick={() => handleTickerClick(item)}
                      >
                        <span className="rank-ticker-code">{item.ticker}</span>
                        {item.name && <span className="rank-company-name">{item.name}</span>}
                      </div>
                      {item.prediction ? (
                        <>
                          <div className={`rank-direction ${item.prediction.direction === 'UP' ? 'up' : 'down'}`}>
                            {item.prediction.direction === 'UP' ? '▲ 上昇傾向' : '▼ 下降傾向'}
                          </div>
                          <div className="rank-meta">
                            <span>確信度 {item.prediction.confidence}%</span>
                            <span>スコア {item.prediction.score > 0 ? '+' : ''}{item.prediction.score}</span>
                            {fmtPrice(item.ticker, item.prediction.lastClose) && (
                              <span className="item-last-price">{fmtPrice(item.ticker, item.prediction.lastClose)}</span>
                            )}
                          </div>
                          <IndicatorBadges p={item.prediction} />
                        </>
                      ) : (
                        <div className="rank-error">{item.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="disclaimer">※ ティッカーシンボルをクリックすると詳細を表示します。投資判断の最終責任はご自身にあります。</p>
            </div>
          </>
        )
      })()}

      {selectedDetail && (
        <DetailCard item={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}

      <NikkeiPanel gasUrl={gasUrl} apiKey={apiKey} />

      <div className="card guide">
        <h2>GAS設定方法（日本株を使う場合）</h2>
        <ol>
          <li><a href="https://script.google.com" target="_blank" rel="noreferrer">script.google.com</a> を開く</li>
          <li>「新しいプロジェクト」をクリック</li>
          <li>GitHubの <code>gas/Code.gs</code> の内容をコピーして貼り付けて保存</li>
          <li>「デプロイ」→「新しいデプロイ」→ 種類：「ウェブアプリ」を選択</li>
          <li>「次のユーザーとして実行：自分」「アクセス：全員」に設定して「デプロイ」</li>
          <li>表示されたURLを上の「GAS URL」欄に貼り付ける</li>
        </ol>
      </div>
    </div>
  )
}
