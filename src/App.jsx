import { useState } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchStockData } from './utils/api'
import { predict } from './utils/prediction'
import { getSameIndustryRecommendations, getStockSector } from './utils/industries'
import { MACRO_CONTEXT, SECTOR_MACRO } from './utils/macroContext'

const RANK_LABELS = ['1位', '2位', '3位', '4位', '5位']
const MAX_TICKERS = 5

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
            name === '出来高'
              ? fmtVol(value)
              : (typeof value === 'number' ? value.toFixed(2) : value)
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

  // OBV + 規律可能性
  if (p.obvTrend === 'UP') {
    if (p.disciplinaryPct != null && p.disciplinaryPct >= 70) {
      reasons.push(`OBV（資金フロー）上昇 + 規律可能性 ${p.disciplinaryPct}%：機関投資家の買いが継続し動きも予測しやすい`)
    } else {
      reasons.push('OBV（資金フロー）が上昇中：機関投資家・大口の買いが続いている')
    }
  }

  // 停滞シグナル
  if (p.isStagnating) {
    reasons.push('上昇後に出来高減少で価格が安定（停滞）：売り手が不在→上昇継続の可能性が高い')
  }

  // マグネット効果（高値突破）
  if (p.magnetEffect && (p.magnetEffect.status === 'NEW_HIGH' || p.magnetEffect.status === 'BREAKOUT')) {
    reasons.push(`過去高値を突破（+${p.magnetEffect.distancePct}%）：上値抵抗を超えた→慣性の法則で上昇継続`)
  }

  // 慣性の法則
  if (p.trendDays >= 4) {
    reasons.push(`${p.trendDays}日連続上昇：慣性の法則が発動中—強いトレンドは続く`)
  }

  // 出来高＋上昇
  if (p.relativeVolume !== null && p.relativeVolume > 1.2 && p.direction === 'UP') {
    reasons.push(`出来高 ${(p.relativeVolume * 100).toFixed(0)}%（平均比）：資金流入を伴う健全な上昇`)
  }

  // 規律可能性（単体）
  if (p.disciplinaryPct != null && p.disciplinaryPct >= 75 && !reasons.some(r => r.includes('規律'))) {
    reasons.push(`規律可能性 ${p.disciplinaryPct}%：値動きが予測しやすい状態`)
  }

  // セクターマクロ（参考）
  const sector = getStockSector(winner.ticker)
  const sm     = sector ? SECTOR_MACRO[sector] : null
  if (sm && sm.score >= 2) {
    reasons.push(`${sector}セクター：AI・半導体需要の追い風（マクロ参考 +${sm.score}）`)
  }

  const scoreDiff = p.score - runnerUp.prediction.score
  const discDiff  = (p.disciplinaryPct || 0) - (runnerUp.prediction.disciplinaryPct || 0)
  if (discDiff > 10) {
    comparisonNote = `2位 ${runnerUp.name || runnerUp.ticker}より規律可能性が${discDiff.toFixed(0)}%高い（より予測しやすい）。スコア差 +${scoreDiff}点`
  } else if (scoreDiff > 0) {
    comparisonNote = `2位 ${runnerUp.name || runnerUp.ticker}とのスコア差：+${scoreDiff}点`
  } else {
    comparisonNote = `${runnerUp.name || runnerUp.ticker}とスコアは接近。総合的に${winner.name || winner.ticker}がわずかに有利と判定`
  }

  return { winner, runnerUp, allDown, reasons: reasons.slice(0, 4), comparisonNote, scoreDiff, allCount: valid.length }
}

function IndicatorBadges({ p }) {
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
    </div>
  )
}

function CTMetrics({ p }) {
  const magDist = p.magnetEffect?.distancePct
  const magStatus = p.magnetEffect?.status
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
    </>
  )
}

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

      <CTMetrics p={p} />

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

function NikkeiPanel({ gasUrl, apiKey }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mc = MACRO_CONTEXT

  const heatLabel = mc.heatLevel === 'OVERHEAT' ? '⚠ 過熱ぎみ（短期）'
    : mc.heatLevel === 'ROOM_TO_RISE' ? '↑ 上昇余地あり'
    : '● 適正水準'
  const heatClass = mc.heatLevel === 'OVERHEAT' ? 'overheat'
    : mc.heatLevel === 'ROOM_TO_RISE' ? 'room'
    : 'neutral'

  const weeklyClass = mc.weeklyOutlook === 'UP' ? 'up'
    : mc.weeklyOutlook === 'DOWN' ? 'down' : 'uncertain'
  const weeklyLabel = mc.weeklyOutlook === 'UP' ? '▲ 上昇予測'
    : mc.weeklyOutlook === 'DOWN' ? '▼ 下落予測' : '━ 方向性不透明（調整→もみ合い）'

  const handleAnalyze = async () => {
    if (!gasUrl && !apiKey) { setError('GAS URL を入力してください。'); return }
    setLoading(true); setError(null)
    try {
      const { prices } = await fetchStockData('^N225', { gasUrl, apiKey })
      const pred = predict(prices, 7)
      setData(pred)
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

export default function App() {
  const [gasUrl, setGasUrl]         = useState(() => localStorage.getItem('gas_url') || '')
  const [apiKey, setApiKey]         = useState(() => localStorage.getItem('av_api_key') || '')
  const [symbols, setSymbols]       = useState('AAPL')
  const [days, setDays]             = useState(14)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [result, setResult]         = useState(null)
  const [rankingResults, setRankingResults] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)

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

    setLoading(true)
    setError(null)
    setResult(null)
    setRankingResults(null)
    setSelectedDetail(null)

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
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn">
          {loading ? '分析中...' : '予測する'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="card result">
          <div className="result-ticker-label">{result.ticker}</div>
          {result.name && <div className="result-company-name">{result.name}</div>}
          <div className={`direction ${result.direction === 'UP' ? 'up' : 'down'}`}>
            <span className="arrow">{result.direction === 'UP' ? '▲' : '▼'}</span>
            <span className="label">{result.direction === 'UP' ? '上昇傾向' : '下降傾向'}</span>
            <span className="confidence">確信度 {result.confidence}%</span>
          </div>

          <CTMetrics p={result} />

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

          <p className="disclaimer">※ CLEAR TRADE理論（出来高＋純粋チャート分析）による参考情報です。投資判断の最終責任はご自身にあります。</p>
        </div>
      )}

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
