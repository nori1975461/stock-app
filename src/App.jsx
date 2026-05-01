import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchStockData } from './utils/api'
import { predict } from './utils/prediction'

const RANK_LABELS = ['1位', '2位', '3位', '4位', '5位']
const MAX_TICKERS = 5

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

      <div className="metrics">
        <div className="metric">
          <span>現在値</span>
          <strong>{p.lastClose.toFixed(2)}</strong>
        </div>
        <div className="metric">
          <span>MA5</span>
          <strong>{p.ma5 ?? '-'}</strong>
        </div>
        <div className="metric">
          <span>MA20</span>
          <strong>{p.ma20 ?? '-'}</strong>
        </div>
        <div className="metric">
          <span>RSI(14)</span>
          <strong>{p.rsi ?? '-'}</strong>
        </div>
      </div>

      <div className="signals">
        <h3>判定根拠</h3>
        <ul>
          {p.signals.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={p.chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={60} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="price" stroke="#4f8ef7" dot={false} name="終値" strokeWidth={2} />
            <Line type="monotone" dataKey="MA5" stroke="#f7a54f" dot={false} name="MA5" strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="MA20" stroke="#e74c4c" dot={false} name="MA20" strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="disclaimer">※ この予測は移動平均・RSIによる参考情報です。投資判断の最終責任はご自身にあります。</p>
    </div>
  )
}

export default function App() {
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('gas_url') || '')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('av_api_key') || '')
  const [symbols, setSymbols] = useState('AAPL')
  const [days, setDays] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
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
        setResult({ ticker: tickerList[0], name, ...predict(prices, days) })
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
          .map((r, i) => ({
            ticker: tickerList[i],
            name: r.status === 'fulfilled' ? r.value.name : null,
            prediction: r.status === 'fulfilled' ? predict(r.value.prices, days) : null,
            error: r.status === 'rejected' ? r.reason.message : null,
          }))
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
              <option value={30}>30日</option>
              <option value={60}>60日</option>
              <option value={90}>90日</option>
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

          <div className="metrics">
            <div className="metric">
              <span>現在値</span>
              <strong>{result.lastClose.toFixed(2)}</strong>
            </div>
            <div className="metric">
              <span>MA5</span>
              <strong>{result.ma5 ?? '-'}</strong>
            </div>
            <div className="metric">
              <span>MA20</span>
              <strong>{result.ma20 ?? '-'}</strong>
            </div>
            <div className="metric">
              <span>RSI(14)</span>
              <strong>{result.rsi ?? '-'}</strong>
            </div>
          </div>

          <div className="signals">
            <h3>判定根拠</h3>
            <ul>
              {result.signals.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={result.chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5a6480' }} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#5a6480' }} width={60} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="price" stroke="#4f8ef7" dot={false} name="終値" strokeWidth={2} />
                <Line type="monotone" dataKey="MA5" stroke="#f7a54f" dot={false} name="MA5" strokeWidth={1.5} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="MA20" stroke="#e74c4c" dot={false} name="MA20" strokeWidth={1.5} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="disclaimer">※ この予測は移動平均・RSIによる参考情報です。投資判断の最終責任はご自身にあります。</p>
        </div>
      )}

      {rankingResults && (
        <div className="card">
          <h2 className="ranking-title">上昇予測ランキング</h2>
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
      )}

      {selectedDetail && (
        <DetailCard item={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}

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
