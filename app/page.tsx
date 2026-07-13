"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: number;
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
  socialDue: number;
  fundPaid: number;
  fundBase: number;
  fundDue: number;
};

const seedRows: Row[] = [
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
].map(([id,payDate,normalPay,note,paid,status,duePay,arrears,contractPay,socialPaid,socialBase,socialDue,fundPaid,fundBase,fundDue]) => ({ id, payDate, normalPay, note, paid, status, duePay, arrears, contractPay, socialPaid, socialBase, socialDue, fundPaid, fundBase, fundDue } as Row));

const money = (value: number) => value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fields: { key: keyof Row; label: string; group?: string; width?: number }[] = [
  {key:"payDate",label:"发薪时间",width:126}, {key:"normalPay",label:"正常发薪",width:116},
  {key:"note",label:"备注",width:178}, {key:"paid",label:"已补发",width:108},
  {key:"status",label:"结清状态",width:100}, {key:"duePay",label:"应发薪水",width:110},
  {key:"arrears",label:"欠薪",width:108}, {key:"contractPay",label:"合同月薪",width:110},
  {key:"socialPaid",label:"已缴金额",group:"社保",width:105}, {key:"socialBase",label:"实缴基数",group:"社保",width:105},
  {key:"socialDue",label:"应补缴金额",group:"社保",width:122}, {key:"fundPaid",label:"已缴金额",group:"公积金",width:105},
  {key:"fundBase",label:"实缴基数",group:"公积金",width:105}, {key:"fundDue",label:"应补缴金额",group:"公积金",width:122},
];

export default function Home() {
  const [rows, setRows] = useState<Row[]>(seedRows);
  const [filter, setFilter] = useState<"全部" | "未结清" | "已结清">("全部");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("xinbao-rows");
    if (cached) try { setRows(JSON.parse(cached)); } catch { /* use seed data */ }
  }, []);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    normal: a.normal + Number(r.normalPay || 0), paid: a.paid + Number(r.paid || 0),
    arrears: a.arrears + Number(r.arrears || 0), social: a.social + Number(r.socialDue || 0),
    fund: a.fund + Number(r.fundDue || 0),
  }), {normal:0,paid:0,arrears:0,social:0,fund:0}), [rows]);
  const grandTotal = totals.arrears + totals.social + totals.fund;
  const openRows = rows.filter(r => r.status === "未结清").length;
  const visible = rows.filter(r => (filter === "全部" || r.status === filter) && `${r.payDate}${r.note}`.includes(query));

  const update = (id: number, key: keyof Row, value: string) => setRows(prev => prev.map(r => r.id === id ? {
    ...r, [key]: key === "payDate" || key === "note" || key === "status" ? value : Number(value),
    ...(key === "duePay" || key === "paid" ? { arrears: Math.max(0, Number(key === "duePay" ? value : r.duePay) - Number(key === "paid" ? value : r.paid)) } : {})
  } : r));

  const save = () => { localStorage.setItem("xinbao-rows", JSON.stringify(rows)); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const addRow = () => setRows(prev => [...prev, { ...prev[prev.length - 1], id: Date.now(), payDate:"", normalPay:0, note:"新增月份", paid:0, status:"未结清", duePay:18000, arrears:18000 }]);
  const remove = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const exportCsv = () => {
    const header = [...fields.map(f => `${f.group ? f.group + "-" : ""}${f.label}`), "合计欠款"];
    const body = rows.map(r => [...fields.map(f => String(r[f.key])), String(r.arrears + r.socialDue + r.fundDue)]);
    const csv = "\ufeff" + [header, ...body].map(line => line.map(v => `"${v.replaceAll('"','""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"})); a.download = "薪保清算明细.csv"; a.click();
  };

  return <main>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">薪</span><div><strong>薪保清算台</strong><small>欠薪 · 社保 · 公积金测算</small></div></div>
      <div className="top-actions"><span className="safe">● 数据仅保存在本机</span><button className="ghost" onClick={exportCsv}>导出明细</button><button className="primary" onClick={save}>{saved ? "已保存 ✓" : "保存测算"}</button></div>
    </header>

    <section className="hero">
      <div><p className="eyebrow">ARREARS WORKBENCH / 欠款测算工作台</p><h1>把每一笔应得，<br/><em>算清楚。</em></h1><p className="intro">按月核对工资实发、社保与公积金缴纳情况，自动汇总欠款，形成清晰可核验的测算底稿。</p></div>
      <div className="grand-card"><span>当前合计欠款</span><strong><small>¥</small>{money(grandTotal)}</strong><div><b>{openRows} 个未结清月份</b><i>数据更新至 {rows.at(-1)?.payDate || "—"}</i></div></div>
    </section>

    <section className="metrics" aria-label="测算汇总">
      <article><span className="metric-icon wage">工</span><div><small>欠薪合计</small><strong>¥ {money(totals.arrears)}</strong><p>占总欠款 {grandTotal ? (totals.arrears / grandTotal * 100).toFixed(1) : 0}%</p></div></article>
      <article><span className="metric-icon social">社</span><div><small>社保应补缴</small><strong>¥ {money(totals.social)}</strong><p>{rows.length} 个月测算记录</p></div></article>
      <article><span className="metric-icon fund">积</span><div><small>公积金应补缴</small><strong>¥ {money(totals.fund)}</strong><p>基于月实缴与应缴差额</p></div></article>
      <article className="settled"><span className="metric-icon paid">✓</span><div><small>已补发工资</small><strong>¥ {money(totals.paid)}</strong><p>另有正常发薪 ¥ {money(totals.normal)}</p></div></article>
    </section>

    <section className="sheet">
      <div className="sheet-head"><div><p className="eyebrow">MONTHLY LEDGER / 月度台账</p><h2>欠薪与补缴明细</h2></div><div className="tools"><label className="search">⌕<input aria-label="搜索月份或备注" placeholder="搜索月份或备注" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="filters">{(["全部","未结清","已结清"] as const).map(x => <button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div><button className="add" onClick={addRow}>＋ 新增月份</button></div></div>
      <div className="table-wrap"><table><thead><tr>{fields.map((f,i) => <th key={`${f.key}-${i}`} style={{minWidth:f.width}}>{f.group && <span>{f.group}</span>}{f.label}</th>)}<th className="sticky-right">本月欠款</th><th className="sticky-right action-col"></th></tr></thead>
      <tbody>{visible.map(r => <tr key={r.id} className={r.status === "未结清" ? "open" : ""}>{fields.map((f,i) => <td key={`${String(f.key)}-${i}`}>
        {f.key === "status" ? <select aria-label={`${r.payDate}结清状态`} className={r.status === "未结清" ? "status open" : "status"} value={r.status} onChange={e=>update(r.id,f.key,e.target.value)}><option>已结清</option><option>未结清</option></select>
        : <input aria-label={`${r.payDate}${f.label}`} className={f.key === "note" || f.key === "payDate" ? "text" : "number"} type={f.key === "note" || f.key === "payDate" ? "text" : "number"} step="0.001" value={r[f.key]} onChange={e=>update(r.id,f.key,e.target.value)}/>}</td>)}
        <td className="row-total sticky-right">¥ {money(r.arrears + r.socialDue + r.fundDue)}</td><td className="sticky-right action-col"><button aria-label={`删除${r.payDate}`} className="delete" onClick={()=>remove(r.id)}>×</button></td></tr>)}</tbody>
      <tfoot><tr><td>总计</td><td>¥ {money(totals.normal)}</td><td></td><td>¥ {money(totals.paid)}</td><td></td><td></td><td>¥ {money(totals.arrears)}</td><td></td><td></td><td></td><td>¥ {money(totals.social)}</td><td></td><td></td><td>¥ {money(totals.fund)}</td><td className="sticky-right">¥ {money(grandTotal)}</td><td className="sticky-right action-col"></td></tr></tfoot></table></div>
      <div className="sheet-foot"><span>显示 {visible.length} / {rows.length} 条记录 · 修改后请保存</span><span><i></i> 可编辑单元格 <b>计算规则：合计欠款 = 欠薪 + 社保应补缴 + 公积金应补缴</b></span></div>
    </section>

    <footer><span>薪保清算台</span><p>测算结果仅供核对参考，具体缴费基数与比例请以当地政策及经办机构核定为准。</p><button onClick={() => { if(confirm("确认恢复截图中的示例数据？")) { setRows(seedRows); localStorage.removeItem("xinbao-rows"); } }}>恢复示例数据</button></footer>
  </main>;
}
