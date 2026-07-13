"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Row = {
  id: number;
  wageMonth: string;
  payDate: string;
  normalPay: number;
  note: string;
  paid: number;
  status: "已结清" | "未结清";
  duePay: number;
  arrears: number;
  contractPay: number;
  socialPaid: number;
  socialBase: number;
  socialRate: number;
  socialDue: number;
  fundPaid: number;
  fundBase: number;
  fundRate: number;
  fundDue: number;
};

type DoublePayRule = { enabled: boolean; contractEnd: string; continuedUntil: string };
const defaultRule: DoublePayRule = { enabled: false, contractEnd: "", continuedUntil: "" };
type QuickSetup = { employmentDate: string; cutoffDate: string; contractPay: number; duePay: number; actualPay: number; socialPaid: number; socialBase: number; socialRate: number; fundPaid: number; fundBase: number; fundRate: number };
const defaultSetup: QuickSetup = { employmentDate: "", cutoffDate: "", contractPay: 0, duePay: 0, actualPay: 0, socialPaid: 0, socialBase: 0, socialRate: 0, fundPaid: 0, fundBase: 0, fundRate: 0 };

const exampleRows: Row[] = [
  [1,"2025/06",0,"",0,"已结清",0,0,20000,384.96,4812,3979.256,250,2490,2101.2],
  [2,"2025-07-10",10363.34,"6月工资",0,"已结清",0,0,20000,384.96,4812,3979.256,250,2490,2101.2],
  [3,"2025/8/11",14088.65,"7月工资",0,"已结清",0,0,20000,384.96,4812,3979.256,250,2490,2101.2],
  [4,"2025/9/10",16931.75,"8月工资",0,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [5,"2025/10/11",18532.34,"9月工资",0,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [6,"2025/11/10",17866.99,"10月工资",0,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [7,"2025/12/10",0,"11月工资",17891.18,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [8,"2026/1/10",0,"12月工资",17916.32,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [9,"2026/2/10",0,"1月工资",18920.92,"已结清",0,0,20000,398.88,4986,3933.668,250,2490,2101.2],
  [10,"2026/3/10",0,"发2月工资的30%",5676.28,"未结清",18920.92,13244.64,20000,398.88,4986,3933.668,250,2490,2101.2],
  [11,"2026/4/10",0,"实际应发3月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
  [12,"2026/5/10",0,"实际应发4月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
  [13,"2026/6/10",0,"实际应发5月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
  [14,"2026/7/10",0,"实际应发6月工资",0,"未结清",18000,18000,20000,398.88,4986,3933.668,250,2490,2101.2],
].map(([id,payDate,normalPay,note,paid,status,duePay,arrears,contractPay,socialPaid,socialBase,socialDue,fundPaid,fundBase,fundDue], index) => {
  const start = new Date(2025, 5 + Math.max(0, index - 1), 1);
  const wageMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const targetBase = Number(contractPay || 0);
  return { id, wageMonth, payDate, normalPay, note, paid, status, duePay, arrears, contractPay, socialPaid, socialBase:targetBase, socialRate:targetBase ? (Number(socialDue)+Number(socialPaid))/targetBase*100 : 0, socialDue, fundPaid, fundBase:targetBase, fundRate:targetBase ? (Number(fundDue)+Number(fundPaid))/targetBase*100 : 0, fundDue } as Row;
});

const blankRow = (): Row => ({ id: Date.now(), wageMonth:"", payDate:"", normalPay:0, note:"", paid:0, status:"未结清", duePay:0, arrears:0, contractPay:0, socialPaid:0, socialBase:0, socialRate:0, socialDue:0, fundPaid:0, fundBase:0, fundRate:0, fundDue:0 });

const socialDueFor = (row: Row) => Math.max(0, Number(row.socialBase || 0) * Number(row.socialRate || 0) / 100 - Number(row.socialPaid || 0));
const fundDueFor = (row: Row) => Math.max(0, Number(row.fundBase || 0) * Number(row.fundRate || 0) / 100 - Number(row.fundPaid || 0));
const monthCountBetween = (startValue: string, endValue: string) => {
  const start = atMidnight(startValue), end = atMidnight(endValue);
  if (!start || !end || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
};
const normalizeRow = (row: Row, index = 0): Row => {
  if (row.socialRate != null && row.fundRate != null) return row;
  const fallback = exampleRows[Math.min(index, exampleRows.length - 1)] || blankRow();
  const socialBase = Number(row.contractPay || row.socialBase || 0);
  const fundBase = Number(row.contractPay || row.fundBase || 0);
  return {
    ...fallback, ...row, socialBase, fundBase,
    socialRate: socialBase ? (Number(row.socialDue || 0) + Number(row.socialPaid || 0)) / socialBase * 100 : 0,
    fundRate: fundBase ? (Number(row.fundDue || 0) + Number(row.fundPaid || 0)) / fundBase * 100 : 0,
  };
};

const money = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const atMidnight = (value: string) => value ? new Date(`${value}T00:00:00`) : null;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const addMonths = (date: Date, months: number) => {
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
};
const dateLabel = (date: Date | null) => date ? date.toLocaleDateString("zh-CN") : "—";
const normalizeSetup = (old: Partial<QuickSetup> & { startMonth?: string; endMonth?: string } = {}): QuickSetup => {
  const oldEnd = old.endMonth ? new Date(Number(old.endMonth.slice(0,4)), Number(old.endMonth.slice(5,7)), 0) : null;
  return {...defaultSetup, ...old, employmentDate:old.employmentDate || (old.startMonth ? `${old.startMonth}-01` : ""), cutoffDate:old.cutoffDate || (oldEnd ? `${oldEnd.getFullYear()}-${String(oldEnd.getMonth()+1).padStart(2,"0")}-${String(oldEnd.getDate()).padStart(2,"0")}` : "")};
};
const weekdayCount = (start: Date, endExclusive: Date) => {
  let count = 0;
  for (let day = new Date(start); day < endExclusive; day = addDays(day, 1)) if (day.getDay() !== 0 && day.getDay() !== 6) count++;
  return count;
};

function doublePayForRow(row: Row, rule: DoublePayRule) {
  const contractEnd = atMidnight(rule.contractEnd);
  const continuedUntil = atMidnight(rule.continuedUntil);
  if (!rule.enabled || !contractEnd || !continuedUntil || !/^\d{4}-\d{2}$/.test(row.wageMonth)) return 0;
  const eligibleStart = addDays(contractEnd, 1);
  if (addDays(continuedUntil, 1) < addMonths(eligibleStart, 1)) return 0;
  const capExclusive = addMonths(eligibleStart, 11);
  const continuedEndExclusive = addDays(continuedUntil, 1);
  const workEndExclusive = continuedEndExclusive < capExclusive ? continuedEndExclusive : capExclusive;
  const [year, month] = row.wageMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const overlapStart = monthStart > eligibleStart ? monthStart : eligibleStart;
  const overlapEnd = monthEnd < workEndExclusive ? monthEnd : workEndExclusive;
  if (overlapEnd <= overlapStart) return 0;
  const monthWorkdays = weekdayCount(monthStart, monthEnd);
  return monthWorkdays ? Number(row.contractPay || 0) * weekdayCount(overlapStart, overlapEnd) / monthWorkdays : 0;
}

const fields: { key: keyof Row; label: string; group?: string; width?: number }[] = [
  {key:"wageMonth",label:"工资所属月",width:112}, {key:"payDate",label:"实际发薪日",width:126}, {key:"normalPay",label:"已发工资",width:116},
  {key:"note",label:"备注",width:178}, {key:"paid",label:"后续补发",width:108},
  {key:"status",label:"结清状态",width:100}, {key:"duePay",label:"应发薪水",width:110},
  {key:"arrears",label:"欠薪",width:108}, {key:"contractPay",label:"合同月薪",width:110},
  {key:"socialPaid",label:"实际已缴",group:"社保",width:105}, {key:"socialBase",label:"应缴基数",group:"社保",width:105}, {key:"socialRate",label:"比例(%)",group:"社保",width:94},
  {key:"socialDue",label:"应补缴金额",group:"社保",width:122}, {key:"fundPaid",label:"已缴金额",group:"公积金",width:105},
  {key:"fundBase",label:"应缴基数",group:"公积金",width:105}, {key:"fundRate",label:"比例(%)",group:"公积金",width:94}, {key:"fundDue",label:"应补缴金额",group:"公积金",width:122},
];

export default function Home() {
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [doubleRule, setDoubleRule] = useState<DoublePayRule>(defaultRule);
  const [setup, setSetup] = useState<QuickSetup>(defaultSetup);
  const [caseName, setCaseName] = useState("我的欠款测算");
  const [filter, setFilter] = useState<"全部" | "未结清" | "已结清">("全部");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cached = localStorage.getItem("xinbao-rows");
    if (cached) try {
      const parsed = JSON.parse(cached) as Row[];
      setRows(parsed.map((row, index) => normalizeRow({ ...row, wageMonth: row.wageMonth || exampleRows[index]?.wageMonth || "" } as Row, index)));
    } catch { /* use seed data */ }
    const cachedRule = localStorage.getItem("xinbao-double-rule");
    if (cachedRule) try { setDoubleRule(JSON.parse(cachedRule)); } catch { /* use defaults */ }
    const cachedMeta = localStorage.getItem("xinbao-meta");
    if (cachedMeta) try {
      const meta = JSON.parse(cachedMeta), old = meta.setup || {};
      setCaseName(meta.caseName || "我的欠款测算");
      setSetup(normalizeSetup(old));
    } catch { /* use defaults */ }
  }, []);

  const doubleById = useMemo(() => new Map(rows.map(row => [row.id, doublePayForRow(row, doubleRule)])), [rows, doubleRule]);
  const totals = useMemo(() => rows.reduce((a, r) => ({
    normal: a.normal + Number(r.normalPay || 0), paid: a.paid + Number(r.paid || 0),
    arrears: a.arrears + Number(r.arrears || 0), social: a.social + socialDueFor(r),
    fund: a.fund + fundDueFor(r), double: a.double + Number(doubleById.get(r.id) || 0),
  }), {normal:0,paid:0,arrears:0,social:0,fund:0,double:0}), [rows, doubleById]);
  const grandTotal = totals.arrears + totals.social + totals.fund + totals.double;
  const openRows = rows.filter(r => r.status === "未结清").length;
  const socialMonths = rows.filter(r => socialDueFor(r) > 0).length;
  const fundMonths = rows.filter(r => fundDueFor(r) > 0).length;
  const setupMonths = monthCountBetween(setup.employmentDate, setup.cutoffDate);
  const visible = rows.filter(r => (filter === "全部" || r.status === filter) && `${r.payDate}${r.note}`.includes(query));

  const update = (id: number, key: keyof Row, value: string) => setRows(prev => prev.map(r => r.id === id ? {
    ...r, [key]: key === "wageMonth" || key === "payDate" || key === "note" || key === "status" ? value : Number(value),
    ...(["duePay","normalPay","paid"].includes(String(key)) ? { arrears: Math.max(0, Number(key === "duePay" ? value : r.duePay) - Number(key === "normalPay" ? value : r.normalPay) - Number(key === "paid" ? value : r.paid)) } : {})
  } : r));

  const rowsWithComputedGaps = () => rows.map(r => ({...r, socialDue:socialDueFor(r), fundDue:fundDueFor(r)}));
  const save = () => { localStorage.setItem("xinbao-rows", JSON.stringify(rowsWithComputedGaps())); localStorage.setItem("xinbao-double-rule", JSON.stringify(doubleRule)); localStorage.setItem("xinbao-meta", JSON.stringify({caseName,setup})); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const addRow = () => setRows(prev => [...prev, { ...(prev[prev.length - 1] || blankRow()), id: Date.now(), wageMonth:"", payDate:"", normalPay:0, note:"新增月份", paid:0, status:"未结清", duePay:Number(setup.duePay || setup.contractPay || 0), arrears:Number(setup.duePay || setup.contractPay || 0), contractPay:Number(setup.contractPay || 0), socialPaid:Number(setup.socialPaid||0), socialBase:Number(setup.socialBase||setup.contractPay||0), socialRate:Number(setup.socialRate||0), fundPaid:Number(setup.fundPaid||0), fundBase:Number(setup.fundBase||setup.contractPay||0), fundRate:Number(setup.fundRate||0) }]);
  const remove = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const exportCsv = () => {
    const header = [...fields.map(f => `${f.group ? f.group + "-" : ""}${f.label}`), "未续签双倍工资差额", "合计欠款"];
    const body = rows.map(r => [...fields.map(f => String(f.key === "socialDue" ? socialDueFor(r) : f.key === "fundDue" ? fundDueFor(r) : r[f.key])), String(doubleById.get(r.id) || 0), String(r.arrears + socialDueFor(r) + fundDueFor(r) + (doubleById.get(r.id) || 0))]);
    const csv = "\ufeff" + [header, ...body].map(line => line.map(v => `"${v.replaceAll('"','""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = "薪保清算明细.csv"; a.click();
  };
  const exportData = () => {
    const data = JSON.stringify({ version:2, caseName, setup, doubleRule, rows:rowsWithComputedGaps() }, null, 2);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], {type:"application/json"})); a.download = `${caseName || "欠款测算"}.json`; a.click();
  };
  const importData = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (!Array.isArray(data.rows)) throw new Error(); setRows(data.rows.map((row:Row,index:number)=>normalizeRow(row,index))); setDoubleRule({...defaultRule,...data.doubleRule}); setSetup(normalizeSetup(data.setup)); setCaseName(data.caseName || "导入的欠款测算"); } catch { alert("文件无法识别，请选择由本计算器导出的 JSON 文件。"); } };
    reader.readAsText(file);
  };
  const generateRows = () => {
    if (!setup.employmentDate || !setup.cutoffDate) return alert("请先填写入职日期和统计截止日期。");
    const startDate=atMidnight(setup.employmentDate), endDate=atMidnight(setup.cutoffDate);
    if (!startDate || !endDate) return alert("日期格式无法识别，请重新选择。");
    const sy=startDate.getFullYear(), sm=startDate.getMonth()+1, count=monthCountBetween(setup.employmentDate,setup.cutoffDate);
    if (count < 1 || count > 60) return alert("测算期间需为 1—60 个月。");
    const generated = Array.from({length:count}, (_,i) => {
      const date = new Date(sy, sm - 1 + i, 1), wageMonth = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
      const due = Number(setup.duePay || setup.contractPay || 0), actual = Number(setup.actualPay || 0);
      const socialPaid=Number(setup.socialPaid||0), socialBase=Number(setup.socialBase||setup.contractPay||0), socialRate=Number(setup.socialRate||0);
      const fundPaid=Number(setup.fundPaid||0), fundBase=Number(setup.fundBase||setup.contractPay||0), fundRate=Number(setup.fundRate||0);
      const socialDue=Math.max(0,socialBase*socialRate/100-socialPaid), fundDue=Math.max(0,fundBase*fundRate/100-fundPaid);
      return { id:Date.now()+i, wageMonth, payDate:"", normalPay:actual, note:`${date.getMonth()+1}月工资`, paid:0, status:due-actual>0||socialDue>0||fundDue>0?"未结清":"已结清", duePay:due, arrears:Math.max(0,due-actual), contractPay:Number(setup.contractPay||0), socialPaid, socialBase, socialRate, socialDue, fundPaid, fundBase, fundRate, fundDue } as Row;
    });
    if (rows.some(r => r.wageMonth || r.duePay || r.normalPay) && !confirm("批量生成会替换当前明细，是否继续？")) return;
    setRows(generated);
  };
  const newCase = () => { if (!confirm("新建测算会清空当前页面数据，建议先导出备份。是否继续？")) return; setRows([blankRow()]); setDoubleRule(defaultRule); setSetup(defaultSetup); setCaseName("我的欠款测算"); localStorage.removeItem("xinbao-rows"); localStorage.removeItem("xinbao-double-rule"); localStorage.removeItem("xinbao-meta"); };

  return <main>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">薪</span><div><strong>薪保计算器</strong><small>免登录 · 本地保存 · 开箱即用</small></div></div>
      <div className="top-actions"><span className="safe">● 数据仅保存在本机</span><button className="ghost" onClick={newCase}>新建</button><button className="ghost" onClick={()=>importInput.current?.click()}>导入</button><button className="ghost" onClick={exportData}>备份</button><button className="ghost" onClick={exportCsv}>CSV</button><button className="primary" onClick={save}>{saved ? "已保存 ✓" : "保存"}</button><input ref={importInput} className="file-input" type="file" accept="application/json,.json" onChange={e=>{importData(e.target.files?.[0]);e.target.value=""}}/></div>
    </header>

    <section className="hero">
      <div><p className="eyebrow">WAGE & BENEFITS CALCULATOR / 薪保计算器</p><h1>工资与社保欠款，<br/><em>一表算清。</em></h1><p className="intro">无需注册登录。填写月份和工资数据，即可计算欠薪、未续签双倍工资、社保及公积金补缴，并生成可导出的测算底稿。</p></div>
      <div className="grand-card"><span>当前合计欠款</span><strong><small>¥</small>{money(grandTotal)}</strong><div><b>{openRows} 个未结清月份</b><i>测算至 {rows.at(-1)?.wageMonth || "—"}</i></div></div>
    </section>

    <section className="quick-card">
      <div className="quick-head"><div><p className="eyebrow">QUICK START / 快速开始</p><h2>输入任职期间，按月生成明细</h2></div><label className="case-name"><span>测算名称</span><input value={caseName} onChange={e=>setCaseName(e.target.value)} placeholder="例如：2026年工资欠款测算"/></label></div>
      <div className="quick-grid">
        <label><span>入职日期</span><input type="date" value={setup.employmentDate} onChange={e=>setSetup(s=>({...s,employmentDate:e.target.value}))}/></label>
        <label><span>统计截止日期</span><input type="date" value={setup.cutoffDate} onChange={e=>setSetup(s=>({...s,cutoffDate:e.target.value}))}/></label>
        <label><span>合同月薪</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.contractPay || ""} placeholder="0" onChange={e=>setSetup(s=>({...s,contractPay:Number(e.target.value)}))}/></div></label>
        <label><span>每月应发工资</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.duePay || ""} placeholder="默认等于合同月薪" onChange={e=>setSetup(s=>({...s,duePay:Number(e.target.value)}))}/></div></label>
        <label><span>每月已发工资</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.actualPay || ""} placeholder="0" onChange={e=>setSetup(s=>({...s,actualPay:Number(e.target.value)}))}/></div></label>
        <label><span>社保每月实际已缴</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.socialPaid || ""} placeholder="公司每月实际缴纳" onChange={e=>setSetup(s=>({...s,socialPaid:Number(e.target.value)}))}/></div></label>
        <label><span>社保应缴基数</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.socialBase || ""} placeholder="默认使用合同月薪" onChange={e=>setSetup(s=>({...s,socialBase:Number(e.target.value)}))}/></div></label>
        <label><span>社保应缴比例</span><div className="money-input"><i>%</i><input type="number" min="0" step="0.01" value={setup.socialRate || ""} placeholder="填写单位或综合比例" onChange={e=>setSetup(s=>({...s,socialRate:Number(e.target.value)}))}/></div></label>
        <label><span>公积金每月实际已缴</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.fundPaid || ""} placeholder="公司每月实际缴纳" onChange={e=>setSetup(s=>({...s,fundPaid:Number(e.target.value)}))}/></div></label>
        <label><span>公积金应缴基数</span><div className="money-input"><i>¥</i><input type="number" min="0" value={setup.fundBase || ""} placeholder="默认使用合同月薪" onChange={e=>setSetup(s=>({...s,fundBase:Number(e.target.value)}))}/></div></label>
        <label><span>公积金应缴比例</span><div className="money-input"><i>%</i><input type="number" min="0" step="0.01" value={setup.fundRate || ""} placeholder="填写单位或综合比例" onChange={e=>setSetup(s=>({...s,fundRate:Number(e.target.value)}))}/></div></label>
        <button className="generate" onClick={generateRows}><span>生成月度明细</span><small>生成后仍可逐项修改</small></button>
      </div>
      <div className="formula-preview"><div><span>社保补缴 · {setupMonths} 个月</span><strong>¥ {money(Math.max(0, Number(setup.socialBase||setup.contractPay||0)*Number(setup.socialRate||0)/100-Number(setup.socialPaid||0))*setupMonths)}</strong><small>每月 ¥ {money(Math.max(0, Number(setup.socialBase||setup.contractPay||0)*Number(setup.socialRate||0)/100-Number(setup.socialPaid||0)))}</small></div><div><span>公积金补缴 · {setupMonths} 个月</span><strong>¥ {money(Math.max(0, Number(setup.fundBase||setup.contractPay||0)*Number(setup.fundRate||0)/100-Number(setup.fundPaid||0))*setupMonths)}</strong><small>每月 ¥ {money(Math.max(0, Number(setup.fundBase||setup.contractPay||0)*Number(setup.fundRate||0)/100-Number(setup.fundPaid||0)))}</small></div><p><b>系统公式：</b>应缴基数 × 比例 − 实际已缴。实际已缴填单位金额时，比例也填单位比例；填单位与个人合计金额时，比例应填双方比例之和。各地费率和基数上下限不同，请按缴费地当期政策填写。</p></div>
      <p className="quick-tip"><b>月份口径：</b>入职月份和截止月份均计入统计，当前共 {setupMonths} 个月；不足整月默认按一个缴费月生成，可在明细中删除或单独调整。系统将逐月计算并累计补缴金额。</p>
    </section>

    <section className="metrics" aria-label="测算汇总">
      <article><span className="metric-icon wage">工</span><div><small>欠薪合计</small><strong>¥ {money(totals.arrears)}</strong><p>占总欠款 {grandTotal ? (totals.arrears / grandTotal * 100).toFixed(1) : 0}%</p></div></article>
      <article><span className="metric-icon social">社</span><div><small>社保应补缴</small><strong>¥ {money(totals.social)}</strong><p>{socialMonths} 个补缴月份 · 共 {rows.length} 个月</p></div></article>
      <article><span className="metric-icon fund">积</span><div><small>公积金应补缴</small><strong>¥ {money(totals.fund)}</strong><p>{fundMonths} 个补缴月份 · 共 {rows.length} 个月</p></div></article>
      <article><span className="metric-icon double">2×</span><div><small>未续签双倍工资差额</small><strong>¥ {money(totals.double)}</strong><p>{doubleRule.enabled ? "已启用 · 最多支持 11 个月" : "规则当前未启用"}</p></div></article>
      <article className="settled"><span className="metric-icon paid">✓</span><div><small>后续补发工资</small><strong>¥ {money(totals.paid)}</strong><p>另有已发工资 ¥ {money(totals.normal)}</p></div></article>
    </section>

    <section className={`rule-card ${doubleRule.enabled ? "enabled" : ""}`}>
      <div className="rule-title"><span className="rule-badge">2×</span><div><p className="eyebrow">DOUBLE PAY RULE / 未续签双倍工资</p><h2>合同期满后持续用工</h2></div><label className="switch"><input type="checkbox" checked={doubleRule.enabled} onChange={e => setDoubleRule(rule => ({...rule, enabled:e.target.checked}))}/><span></span><b>{doubleRule.enabled ? "已启用" : "未启用"}</b></label></div>
      <div className="rule-fields">
        <label><span>劳动合同期满日</span><input type="date" value={doubleRule.contractEnd} onChange={e => setDoubleRule(rule => ({...rule, contractEnd:e.target.value}))}/><small>双倍工资从期满次日起算</small></label>
        <span className="rule-arrow">→</span>
        <label><span>持续用工截止日</span><input type="date" value={doubleRule.continuedUntil} onChange={e => setDoubleRule(rule => ({...rule, continuedUntil:e.target.value}))}/><small>可填补签或实际离职前一日</small></label>
        <div className="rule-result"><span>规则测算结果</span><strong>¥ {money(totals.double)}</strong><small>{(() => { const end = atMidnight(doubleRule.contractEnd); const until = atMidnight(doubleRule.continuedUntil); if (!doubleRule.enabled) return "启用后参与合计"; if (!end || !until) return "请完整填写两个日期"; const start = addDays(end,1); if (addDays(until,1) < addMonths(start,1)) return "持续用工未满 1 个月，不触发"; return `计薪期 ${dateLabel(start)} 起，最迟至 ${dateLabel(addDays(addMonths(start,11),-1))}`; })()}</small></div>
      </div>
      <p className="rule-note"><b>计算口径：</b>持续用工达到 1 个月后，追溯至合同期满次日计算额外一倍工资；不足整月按该月工作日比例折算，累计最多 11 个月。工资基数取明细中的“合同月薪”，所属期间取“工资所属月”。不同地区裁审口径可能存在差异。</p>
    </section>

    <section className="sheet">
      <div className="sheet-head"><div><p className="eyebrow">MONTHLY LEDGER / 月度台账</p><h2>欠薪与补缴明细</h2></div><div className="tools"><label className="search">⌕<input aria-label="搜索月份或备注" placeholder="搜索月份或备注" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="filters">{(["全部","未结清","已结清"] as const).map(x => <button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div><button className="add" onClick={addRow}>＋ 新增月份</button></div></div>
      <div className="table-wrap"><table><thead><tr>{fields.map((f,i) => <th key={`${f.key}-${i}`} style={{minWidth:f.width}}>{f.group && <span>{f.group}</span>}{f.label}</th>)}<th className="double-col"><span>未续签</span>双倍工资差额</th><th className="sticky-right">本月欠款</th><th className="sticky-right action-col"></th></tr></thead>
      <tbody>{visible.map(r => <tr key={r.id} className={r.status === "未结清" ? "open" : ""}>{fields.map((f,i) => <td key={`${String(f.key)}-${i}`}>
        {f.key === "status" ? <select aria-label={`${r.payDate}结清状态`} className={r.status === "未结清" ? "status open" : "status"} value={r.status} onChange={e=>update(r.id,f.key,e.target.value)}><option>已结清</option><option>未结清</option></select>
        : f.key === "socialDue" || f.key === "fundDue" ? <div className="calculated-cell"><b>¥ {money(f.key === "socialDue" ? socialDueFor(r) : fundDueFor(r))}</b><small>自动计算</small></div>
        : <input aria-label={`${r.payDate}${f.label}`} className={f.key === "wageMonth" || f.key === "note" || f.key === "payDate" ? "text" : "number"} type={f.key === "wageMonth" ? "month" : f.key === "note" || f.key === "payDate" ? "text" : "number"} step="0.001" value={r[f.key]} onChange={e=>update(r.id,f.key,e.target.value)}/>}</td>)}
        <td className={`double-value ${(doubleById.get(r.id) || 0) > 0 ? "active" : ""}`}>¥ {money(doubleById.get(r.id) || 0)}</td>
        <td className="row-total sticky-right">¥ {money(r.arrears + socialDueFor(r) + fundDueFor(r) + (doubleById.get(r.id) || 0))}</td><td className="sticky-right action-col"><button aria-label={`删除${r.payDate}`} className="delete" onClick={()=>remove(r.id)}>×</button></td></tr>)}</tbody>
      <tfoot><tr>{fields.map((f,i) => <td key={`${String(f.key)}-total`}>{i === 0 ? "总计" : f.key === "normalPay" ? `¥ ${money(totals.normal)}` : f.key === "paid" ? `¥ ${money(totals.paid)}` : f.key === "arrears" ? `¥ ${money(totals.arrears)}` : f.key === "socialDue" ? `¥ ${money(totals.social)}` : f.key === "fundDue" ? `¥ ${money(totals.fund)}` : ""}</td>)}<td>¥ {money(totals.double)}</td><td className="sticky-right">¥ {money(grandTotal)}</td><td className="sticky-right action-col"></td></tr></tfoot></table></div>
      <div className="sheet-foot"><span>显示 {visible.length} / {rows.length} 条记录 · 修改后请保存</span><span><i></i> 可编辑单元格 <b>合计欠款 = 欠薪 + 双倍工资差额 + 社保应补缴 + 公积金应补缴</b></span></div>
    </section>

    <footer><span>薪保计算器</span><p>测算结果仅供核对参考，工资、缴费基数、双倍工资及例外情形请以当地有效规定和经办机构核定为准。</p><button onClick={() => { if(confirm("加载示例会替换当前页面数据，是否继续？")) { setRows(exampleRows); setDoubleRule(defaultRule); setCaseName("示例：欠薪与补缴测算"); } }}>加载示例数据</button></footer>
  </main>;
}
