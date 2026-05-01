import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchStockData } from './utils/api'
import { predict } from './utils/prediction'

export default function App() {
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('gas_url') || '')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('av_api_key') || '')
  const [symbol, setSymbol] = useState('AAPL')
  const [days, setDays] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!gasUrl.trim() && !apiKey.trim()) {
      setError('GAS URL または Alpha Vantage APIキーのどちらかを入力してください。')
      return
    }
    if (gasUrl.trim()) localStorage.setItem('gas_url', gasUrl.trim())
    if (apiKey.trim()) localStorage.setItem('av_api_key', apiKey.trim())
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await fetchStockData(symbol.trim().toUpperCase(), {
        gasUrl: gasUrl.trim(),
        apiKey: apiKey.trim(),
      })
      setResult(predict(data, days))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
            <label>ティッカーシンボル</label>
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="例: 5706.T / AAPL"
            />
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
