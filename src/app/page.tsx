'use client';

import React, { useCallback, useMemo, useState } from 'react';

type CalcResult = {
  amount: number;
  premiumPct: number;
  settleDays: number; // T+N
  currentDay: number; // 申购后的第几天（1=今天）
  sellDelayDays: number; // 卖出失败额外延迟天数
  remainingDays: number; // 距离可卖出剩余天数（基线）
  effectiveDays: number; // 用于复利计算的有效天数
  limitPct: number;

  minProfit: number;
  maxProfit: number;
  minRoi: number;
  maxRoi: number;
  minValue: number;
  maxValue: number;
};

function parseNumber(raw: unknown): number {
  if (raw == null) return Number.NaN;
  const s = String(raw).trim().replace(/,/g, '');
  if (s === '') return Number.NaN;
  return Number(s);
}

function fmtPct(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

export default function Page() {
  const fmtCNY = useMemo(
    () =>
      new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        maximumFractionDigits: 2,
      }),
    [],
  );

  // inputs
  const [amount, setAmount] = useState<string>('');
  const [premium, setPremium] = useState<string>('');

  const [settleDays, setSettleDays] = useState<string>('3'); // T+N
  const [currentDay, setCurrentDay] = useState<string>('1'); // 第几天（1=今天）
  const [sellDelayDays, setSellDelayDays] = useState<string>('0'); // 额外延迟天数

  const [limit, setLimit] = useState<string>('10');

  // ui state
  const [errMsg, setErrMsg] = useState<string>('');
  const [metaBadge, setMetaBadge] = useState<string>('等待输入');

  const [rangeText, setRangeText] = useState<string>('—');
  const [note, setNote] = useState<string>(
    '这是一个“区间估算器”：只把溢价与涨跌停复利叠加，帮助你快速理解风险/弹性。',
  );

  const [minValue, setMinValue] = useState<string>('—');
  const [minProfit, setMinProfit] = useState<string>('—');
  const [minRoi, setMinRoi] = useState<string>('—');

  const [maxValue, setMaxValue] = useState<string>('—');
  const [maxProfit, setMaxProfit] = useState<string>('—');
  const [maxRoi, setMaxRoi] = useState<string>('—');

  const [minProfitSign, setMinProfitSign] = useState<'negative' | 'positive' | 'neutral'>('neutral');
  const [maxProfitSign, setMaxProfitSign] = useState<'negative' | 'positive' | 'neutral'>('neutral');
  const [minRoiSign, setMinRoiSign] = useState<'negative' | 'positive' | 'neutral'>('neutral');
  const [maxRoiSign, setMaxRoiSign] = useState<'negative' | 'positive' | 'neutral'>('neutral');

  const [copyLabel, setCopyLabel] = useState<string>('复制结果');
  const [lastData, setLastData] = useState<CalcResult | null>(null);

  const signOf = (v: number): 'negative' | 'positive' | 'neutral' => {
    if (v > 0) return 'positive';
    if (v < 0) return 'negative';
    return 'neutral';
  };

  const vClass = (sign: 'negative' | 'positive' | 'neutral') => {
    if (sign === 'positive') return 'text-[#6ee7b7]';
    if (sign === 'negative') return 'text-[#fb7185]';
    return 'text-[#dbe7ff]';
  };

  const calculate = useCallback((): CalcResult | null => {
    setErrMsg('');

    const a = parseNumber(amount);
    const premiumPct = parseNumber(premium);

    let N = parseNumber(settleDays);
    let day = parseNumber(currentDay);
    let delay = parseNumber(sellDelayDays);

    const limitPct = parseNumber(limit);

    if (!Number.isFinite(N)) N = 3;
    if (!Number.isFinite(day)) day = 1;
    if (!Number.isFinite(delay)) delay = 0;

    N = Math.floor(N);
    day = Math.floor(day);
    delay = Math.floor(delay);

    if (!Number.isFinite(a) || a <= 0) {
      setErrMsg('请输入有效的“申购金额”（大于 0 的数字）。');
      return null;
    }
    if (!Number.isFinite(premiumPct)) {
      setErrMsg('请输入有效的“溢价百分比”（例如 5 表示 5%）。可为负数。');
      return null;
    }
    if (!Number.isFinite(N) || N < 0) {
      setErrMsg('请输入有效的 “T+N” 的 N（非负整数）。');
      return null;
    }
    if (!Number.isFinite(day) || day < 1) {
      setErrMsg('请输入有效的“当前是申购第几天”（从 1 开始的正整数）。');
      return null;
    }
    if (!Number.isFinite(delay) || delay < 0) {
      setErrMsg('请输入有效的“卖出延迟天数”（非负整数）。');
      return null;
    }
    if (!Number.isFinite(limitPct) || limitPct <= 0 || limitPct >= 100) {
      setErrMsg('请输入有效的“每日涨跌停幅度”，范围建议在 (0, 100) 之间。');
      return null;
    }

    const remainingDays = Math.max(N - (day - 1), 0);
    const effectiveDays = remainingDays + delay;

    const p = premiumPct / 100;
    const L = limitPct / 100;

    // Normalize NAV=1, market price today = 1*(1+p)
    const m0 = 1 * (1 + p);

    // Consecutive limit-down/up compounded for effectiveDays days
    const minPrice = m0 * Math.pow(1 - L, effectiveDays);
    const maxPrice = m0 * Math.pow(1 + L, effectiveDays);

    // ROI relative to subscription cost (NAV=1)
    const minR = minPrice - 1;
    const maxR = maxPrice - 1;

    const minP = a * minR;
    const maxP = a * maxR;

    const minV = a + minP;
    const maxV = a + maxP;

    setMetaBadge(
      `T+${N} · 第${day}天 · 剩余${remainingDays}天 · 延迟+${delay} · 有效${effectiveDays}天`,
    );

    setMinValue(fmtCNY.format(minV));
    setMaxValue(fmtCNY.format(maxV));

    setMinProfit(fmtCNY.format(minP));
    setMaxProfit(fmtCNY.format(maxP));

    setMinRoi(fmtPct(minR));
    setMaxRoi(fmtPct(maxR));

    setMinProfitSign(signOf(minP));
    setMaxProfitSign(signOf(maxP));
    setMinRoiSign(signOf(minR));
    setMaxRoiSign(signOf(maxR));

    setRangeText(
      `有效天数：${effectiveDays}（剩余 ${remainingDays} + 延迟 ${delay}） · 区间：${fmtCNY.format(
        minP,
      )}（${fmtPct(minR)}） ～ ${fmtCNY.format(maxP)}（${fmtPct(maxR)}）`,
    );

    if (p <= -0.5) {
      setNote('提示：你输入的是明显折价（溢价为负且幅度较大）。结果依然按同一逻辑估算。');
    } else if (p >= 0.3) {
      setNote('提示：溢价偏高时，连续跌停情景下回撤会更剧烈；请谨慎评估流动性与溢价回归风险。');
    } else if (delay > 0) {
      setNote('提示：你启用了“卖出延迟”。这会把可卖日当天封板/卖不出等情况折算成额外持有天数。');
    } else {
      setNote('这是一个“区间估算器”：只把溢价与涨跌停复利叠加，帮助你快速理解风险/弹性。');
    }

    const result: CalcResult = {
      amount: a,
      premiumPct,
      settleDays: N,
      currentDay: day,
      sellDelayDays: delay,
      remainingDays,
      effectiveDays,
      limitPct,
      minProfit: minP,
      maxProfit: maxP,
      minRoi: minR,
      maxRoi: maxR,
      minValue: minV,
      maxValue: maxV,
    };

    return result;
  }, [amount, premium, settleDays, currentDay, sellDelayDays, limit, fmtCNY]);

  const onCalc = useCallback(() => {
    const r = calculate();
    setLastData(r);
  }, [calculate]);

  const copyResult = useCallback(async () => {
    setErrMsg('');
    if (!lastData) {
      setErrMsg('请先点击“计算”生成结果后再复制。');
      return;
    }

    const lines = [
      '基金溢价预期收益区间（估算）',
      `申购金额：${fmtCNY.format(lastData.amount)}`,
      `当前溢价：${lastData.premiumPct}%`,
      `确认周期：T+${lastData.settleDays}`,
      `当前第几天：第${lastData.currentDay}天（1=今天）`,
      `距离可卖出剩余：${lastData.remainingDays} 天（基线）`,
      `卖出延迟：${lastData.sellDelayDays} 天`,
      `用于计算的有效天数：${lastData.effectiveDays} 天`,
      `每日涨跌停：${lastData.limitPct}%`,
      `最差（连续跌停）收益：${fmtCNY.format(lastData.minProfit)}（${fmtPct(
        lastData.minRoi,
      )}），卖出价值：${fmtCNY.format(lastData.minValue)}`,
      `最好（连续涨停）收益：${fmtCNY.format(lastData.maxProfit)}（${fmtPct(
        lastData.maxRoi,
      )}），卖出价值：${fmtCNY.format(lastData.maxValue)}`,
      '备注：默认按NAV不变简化，仅用于区间理解，不构成预测。',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setCopyLabel('已复制 ✓');
      window.setTimeout(() => setCopyLabel('复制结果'), 1200);
    } catch {
      setErrMsg('复制失败：当前浏览器可能不允许 clipboard 权限。你可以手动选中文本复制。');
    }
  }, [lastData, fmtCNY]);

  const onKeyDownCalc: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCalc();
    }
  };

  return (
    <main
      className={[
        'min-h-screen w-full flex items-center justify-center p-[28px_16px]',
        'text-[#e7eefc]',
        'bg-[radial-gradient(1200px_600px_at_20%_15%,rgba(122,167,255,0.22),transparent_55%),radial-gradient(900px_520px_at_80%_25%,rgba(110,231,183,0.18),transparent_55%),radial-gradient(900px_520px_at_70%_85%,rgba(251,191,36,0.12),transparent_55%),linear-gradient(180deg,#0b1020,#0b1b2e)]',
      ].join(' ')}
    >
      <div className="w-full max-w-[980px] grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-[18px]">
        {/* Left: inputs */}
        <section className="overflow-hidden rounded-[18px] bg-[#0f172aee] border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <header className="p-[22px_22px_14px] border-b border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="m-0 text-[18px] font-[750] tracking-[0.2px]">
                  基金溢价 · 预期收益区间计算器
                </h1>
                <p className="mt-2 mb-0 text-[13px] leading-[1.45] text-[#93a4bd]">
                  输入申购金额、当前溢价、以及 <code className="px-[6px] py-[1px] rounded-full text-[11px] border border-white/10 bg-white/10 text-white/90">T+N</code>
                  （默认 N=3），计算在 “连续跌停” 到 “连续涨停” 情景下的收益区间（估算）。
                </p>
              </div>

              <div className="h-fit whitespace-nowrap rounded-full px-[10px] py-[7px] text-[12px] text-[#cfe0ff] border border-[rgba(122,167,255,0.24)] bg-[rgba(122,167,255,0.12)]">
                单文件 · 本地可用
              </div>
            </div>
          </header>

          <div className="p-[18px_22px_22px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
              {/* amount */}
              <div>
                <label className="block text-[12px] text-[#93a4bd] mb-2" htmlFor="amount">
                  申购金额
                </label>
                <div className="flex items-center gap-[10px] rounded-[14px] px-3 py-3 bg-white/5 border border-white/10 transition duration-200 ease-out focus-within:border-[rgba(122,167,255,0.5)] focus-within:-translate-y-px">
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">¥</span>
                  <input
                    id="amount"
                    inputMode="decimal"
                    placeholder="例如 10000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={onKeyDownCalc}
                    className="w-full bg-transparent outline-none border-0 p-0 text-[14px] text-[#e7eefc] placeholder:text-[rgba(147,164,189,0.55)]"
                  />
                </div>
              </div>

              {/* premium */}
              <div>
                <label className="block text-[12px] text-[#93a4bd] mb-2" htmlFor="premium">
                  当前基金溢价（%）
                </label>
                <div className="flex items-center gap-[10px] rounded-[14px] px-3 py-3 bg-white/5 border border-white/10 transition duration-200 ease-out focus-within:border-[rgba(122,167,255,0.5)] focus-within:-translate-y-px">
                  <input
                    id="premium"
                    inputMode="decimal"
                    placeholder="例如 5（不用输入%）"
                    value={premium}
                    onChange={(e) => setPremium(e.target.value)}
                    onKeyDown={onKeyDownCalc}
                    className="w-full bg-transparent outline-none border-0 p-0 text-[14px] text-[#e7eefc] placeholder:text-[rgba(147,164,189,0.55)]"
                  />
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">%</span>
                </div>
              </div>

              {/* settleDays (T+N) */}
              <div>
                <label className="block text-[12px] text-[#93a4bd] mb-2" htmlFor="settleDays">
                  申购确认周期（T+N）
                </label>
                <div className="flex items-center gap-[10px] rounded-[14px] px-3 py-3 bg-white/5 border border-white/10 transition duration-200 ease-out focus-within:border-[rgba(122,167,255,0.5)] focus-within:-translate-y-px">
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">T+</span>
                  <input
                    id="settleDays"
                    inputMode="numeric"
                    placeholder="默认 3"
                    value={settleDays}
                    onChange={(e) => setSettleDays(e.target.value)}
                    onKeyDown={onKeyDownCalc}
                    className="w-full bg-transparent outline-none border-0 p-0 text-[14px] text-[#e7eefc] placeholder:text-[rgba(147,164,189,0.55)]"
                  />
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">天</span>
                </div>
              </div>

              {/* currentDay */}
              <div>
                <label className="block text-[12px] text-[#93a4bd] mb-2" htmlFor="currentDay">
                  当前是申购第几天（1=今天）
                </label>
                <div className="flex items-center gap-[10px] rounded-[14px] px-3 py-3 bg-white/5 border border-white/10 transition duration-200 ease-out focus-within:border-[rgba(122,167,255,0.5)] focus-within:-translate-y-px">
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">第</span>
                  <input
                    id="currentDay"
                    inputMode="numeric"
                    placeholder="默认 1"
                    value={currentDay}
                    onChange={(e) => setCurrentDay(e.target.value)}
                    onKeyDown={onKeyDownCalc}
                    className="w-full bg-transparent outline-none border-0 p-0 text-[14px] text-[#e7eefc] placeholder:text-[rgba(147,164,189,0.55)]"
                  />
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">天</span>
                </div>
              </div>

              {/* sellDelayDays */}
              <div>
                <label className="block text-[12px] text-[#93a4bd] mb-2" htmlFor="sellDelayDays">
                  卖出延迟（封板卖不出额外天数）
                </label>
                <div className="flex items-center gap-[10px] rounded-[14px] px-3 py-3 bg-white/5 border border-white/10 transition duration-200 ease-out focus-within:border-[rgba(122,167,255,0.5)] focus-within:-translate-y-px">
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">+</span>
                  <input
                    id="sellDelayDays"
                    inputMode="numeric"
                    placeholder="默认 0"
                    value={sellDelayDays}
                    onChange={(e) => setSellDelayDays(e.target.value)}
                    onKeyDown={onKeyDownCalc}
                    className="w-full bg-transparent outline-none border-0 p-0 text-[14px] text-[#e7eefc] placeholder:text-[rgba(147,164,189,0.55)]"
                  />
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">天</span>
                </div>
              </div>

              {/* limit */}
              <div>
                <label className="block text-[12px] text-[#93a4bd] mb-2" htmlFor="limit">
                  每日涨跌停幅度（%）
                </label>
                <div className="flex items-center gap-[10px] rounded-[14px] px-3 py-3 bg-white/5 border border-white/10 transition duration-200 ease-out focus-within:border-[rgba(122,167,255,0.5)] focus-within:-translate-y-px">
                  <input
                    id="limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    onKeyDown={onKeyDownCalc}
                    className="w-full bg-transparent outline-none border-0 p-0 text-[14px] text-[#e7eefc] placeholder:text-[rgba(147,164,189,0.55)]"
                  />
                  <span className="select-none whitespace-nowrap text-[13px] text-white/75">%</span>
                </div>
              </div>
            </div>

            <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                aria-label="计算"
                onClick={onCalc}
                className={[
                  'min-w-[160px] inline-flex items-center justify-center gap-[10px]',
                  'rounded-[14px] px-[14px] py-3 font-[750] text-[#07111f]',
                  'bg-[linear-gradient(90deg,#7aa7ff,#6ee7b7)] shadow-[0_12px_28px_rgba(122,167,255,0.18)]',
                  'transition duration-150 ease-out active:translate-y-px hover:brightness-[1.03]',
                ].join(' ')}
              >
                <span>计算</span>
                <span className="opacity-80">↵</span>
              </button>

              <button
                type="button"
                onClick={copyResult}
                className={[
                  'min-w-[160px] inline-flex items-center justify-center',
                  'rounded-[14px] px-[14px] py-3 font-[650] text-[#e7eefc]',
                  'bg-white/5 border border-white/10 shadow-none',
                  'transition duration-150 ease-out active:translate-y-px',
                ].join(' ')}
              >
                {copyLabel}
              </button>

              <div className="text-[12px] leading-[1.4] text-[#93a4bd]">
                小提示：回车也可计算；溢价可输入负数（折价）。
              </div>
            </div>

            {errMsg ? (
              <div className="mt-3 rounded-[14px] border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.08)] px-3 py-[10px] text-[12px] leading-[1.4] text-[#ffd0d8]">
                {errMsg}
              </div>
            ) : null}

            <div className="my-4 h-px bg-white/10" />

            <details className="rounded-[16px] border border-dashed border-white/15 bg-white/5 px-3 py-3">
              <summary className="cursor-pointer select-none text-[13px] font-[650] text-white/90">
                计算假设（点开查看）
              </summary>
              <div className="mt-[14px] text-[11px] leading-[1.5] text-[rgba(147,164,189,0.8)]">
                <div className="mt-[10px]">
                  <b>1)</b> 以“申购成本 = 当日 NAV”为基准，记 NAV = 1（归一化）。<br />
                  <b>2)</b> 当前市场价 = NAV × (1 + 溢价)。例如溢价 5%，则市场价 = 1.05。<br />
                  <b>3)</b> 距离可卖出剩余天数：<code className="px-[6px] py-[1px] rounded-full text-[11px] border border-white/10 bg-white/10 text-white/90">remaining = max(N-(day-1),0)</code>
                  <br />
                  <b>4)</b> 卖出延迟（封板卖不出）按额外持有天数折算：<code className="px-[6px] py-[1px] rounded-full text-[11px] border border-white/10 bg-white/10 text-white/90">effective = remaining + delay</code>
                  <br />
                  <b>5)</b> 未来有效天数内市场价按涨跌停幅度复利变化：<br />
                  &nbsp;&nbsp;最差：市场价 × (1 - limit)<sup>effective</sup>（连续跌停）<br />
                  &nbsp;&nbsp;最好：市场价 × (1 + limit)<sup>effective</sup>（连续涨停）<br />
                  <b>6)</b> 为了给出清晰区间，本工具默认 <u>NAV 不变</u>（实际 NAV 会随标的波动）。因此结果是“区间估算”，不是预测。
                  <br />
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* Right: results */}
        <section className="overflow-hidden rounded-[18px] bg-[#0f172aee] border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <header className="p-[22px_22px_14px] border-b border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="m-0 text-[18px] font-[750] tracking-[0.2px]">结果</h1>
                <p className="mt-2 mb-0 text-[13px] leading-[1.45] text-[#93a4bd]">
                  输出最差/最好情景下的：预计卖出价值、收益额、收益率（相对申购成本）。
                </p>
              </div>

              <div
                className="h-fit whitespace-nowrap rounded-full px-[10px] py-[7px] text-[12px] text-[#cfe0ff] border border-[rgba(122,167,255,0.24)] bg-[rgba(122,167,255,0.12)]"
                title={metaBadge}
              >
                {metaBadge}
              </div>
            </div>
          </header>

          <div className="p-[16px_22px_22px]">
            <div className="grid grid-cols-1 gap-3">
              {/* range panel */}
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-[14px]">
                <h3 className="m-0 mb-2 text-[13px] tracking-[0.2px]">收益区间（区间条）</h3>
                <p className="m-0 mb-[10px] text-[12px] leading-[1.4] text-[#93a4bd]">
                  {rangeText}
                </p>

                <div className="relative h-[10px] overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  <div className="absolute inset-y-0 left-0 w-full opacity-85 bg-[linear-gradient(90deg,rgba(251,113,133,0.75),rgba(251,191,36,0.65),rgba(110,231,183,0.7))]" />
                  <div
                    className="absolute top-[-3px] left-1/2 h-[16px] w-[2px] -translate-x-1/2 bg-[rgba(231,238,252,0.8)] opacity-70"
                    title="申购成本基准（0%收益）"
                  />
                </div>
              </div>

              {/* min scenario */}
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-[14px]">
                <h3 className="m-0 mb-2 text-[13px] tracking-[0.2px]">最差情景：连续跌停</h3>
                <p className="m-0 mb-[10px] text-[12px] leading-[1.4] text-[#93a4bd]">
                  有效天数内每天都触发跌停（复利）。
                </p>

                <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 items-baseline text-[13px]">
                  <div className="text-white/80">预计卖出价值</div>
                  <div className="font-[700] tabular-nums text-[#dbe7ff]">{minValue}</div>

                  <div className="text-white/80">收益额</div>
                  <div className={`font-[700] tabular-nums ${vClass(minProfitSign)}`}>{minProfit}</div>

                  <div className="text-white/80">收益率</div>
                  <div className={`font-[700] tabular-nums ${vClass(minRoiSign)}`}>{minRoi}</div>
                </div>
              </div>

              {/* max scenario */}
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-[14px]">
                <h3 className="m-0 mb-2 text-[13px] tracking-[0.2px]">最好情景：连续涨停</h3>
                <p className="m-0 mb-[10px] text-[12px] leading-[1.4] text-[#93a4bd]">
                  有效天数内每天都触发涨停（复利）。
                </p>

                <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 items-baseline text-[13px]">
                  <div className="text-white/80">预计卖出价值</div>
                  <div className="font-[700] tabular-nums text-[#dbe7ff]">{maxValue}</div>

                  <div className="text-white/80">收益额</div>
                  <div className={`font-[700] tabular-nums ${vClass(maxProfitSign)}`}>{maxProfit}</div>

                  <div className="text-white/80">收益率</div>
                  <div className={`font-[700] tabular-nums ${vClass(maxRoiSign)}`}>{maxRoi}</div>
                </div>
              </div>

              {/* note */}
              <div className="rounded-[16px] border border-white/10 bg-white/5 p-[14px]">
                <h3 className="m-0 mb-2 text-[13px] tracking-[0.2px]">备注</h3>
                <p className="m-0 mb-[10px] text-[12px] leading-[1.4] text-[#93a4bd]">{note}</p>
                <div className="text-[11px] leading-[1.5] text-[rgba(147,164,189,0.8)]">
                  如果你希望更贴近真实：可以把 “每日涨跌停幅度” 调成对应品种规则； 或者再加一项 “预估NAV日波动” 做二阶区间（我也可以帮你扩展）。
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
