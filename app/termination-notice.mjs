const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const displayDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : "（请填写日期）";
};

const displayEmploymentDate = value => value ? displayDate(value) : "双方劳动关系建立之日";

export const TERMINATION_NOTICE_REASONS = {
  wage: {
    label:"未及时足额支付劳动报酬",
    legalBasis:"《中华人民共和国劳动合同法》第三十八条第一款第二项",
    paragraph:"贵公司存在未及时足额支付本人劳动报酬的情形。",
  },
  socialUnpaid: {
    label:"未依法缴纳社会保险费",
    legalBasis:"《中华人民共和国劳动合同法》第三十八条第一款第三项",
    paragraph:"贵公司存在未依法为本人缴纳社会保险费的情形。",
  },
  socialUnderpaid: {
    label:"社会保险缴费基数或金额可能不足（需复核）",
    legalBasis:"《中华人民共和国劳动合同法》第三十八条第一款第三项（是否足以支持解除及经济补偿，应结合参保地核定和当地裁审口径复核）",
    paragraph:"根据本人现有缴费记录，贵公司申报的社会保险缴费基数或缴费金额可能未依法足额确定，具体差额及法律后果以社会保险费征收机构核定和有权机关认定为准。",
  },
};

export const TERMINATION_NOTICE_RIGHTS = {
  wage: {
    label:"欠付工资",
    paragraph:"请核对并支付截至劳动合同解除之日应付未付的工资；具体金额以工资记录、银行流水和最终核算为准。",
  },
  social: {
    label:"社会保险核查补缴",
    paragraph:"请依法办理社会保险核查补缴；具体险种、缴费基数、期间和金额以社会保险费征收机构或经办机构核定为准。",
  },
  fund: {
    label:"住房公积金核查补缴",
    paragraph:"请依法办理住房公积金缴存核查及补缴；住房公积金不等同于社会保险，本项不单独作为《中华人民共和国劳动合同法》第三十八条所称未缴社会保险费的解除理由。",
  },
  reimbursement: {
    label:"未支付的工作费用报销",
    paragraph:"请核对并支付本人已垫付且尚未报销的合理工作费用；具体金额以票据、审批及业务记录为准。",
  },
  overtime: {
    label:"未支付的加班工资",
    paragraph:"请核对并支付尚未结清的加班工资；具体时数、工时制度与计算基数以考勤等证据和适用规则为准。",
  },
};

const reasonList = reasons => reasons
  .map(key => TERMINATION_NOTICE_REASONS[key])
  .filter(Boolean);

const rightList = rights => rights
  .map(key => TERMINATION_NOTICE_RIGHTS[key])
  .filter(Boolean);

/**
 * @param {{employeeName?:string, companyName?:string, employmentDate?:string, noticeDate?:string, contact?:string, reasons?:Array<keyof typeof TERMINATION_NOTICE_REASONS>, rights?:Array<keyof typeof TERMINATION_NOTICE_RIGHTS>}} input
 */
export const buildTerminationNotice = ({
  employeeName,
  companyName,
  employmentDate,
  noticeDate,
  contact,
  reasons = [],
  rights = [],
}) => {
  const employee = String(employeeName || "").trim() || "（请填写劳动者姓名）";
  const company = String(companyName || "").trim() || "（请填写用人单位全称）";
  const contactText = String(contact || "").trim();
  const selectedReasons = reasonList(reasons);
  const basis = selectedReasons.map(item => item.legalBasis).join("、");
  const reasonParagraphs = selectedReasons.map(item => item.paragraph);
  const safeReasons = reasonParagraphs.length ? reasonParagraphs : ["（尚未选择解除理由，请勿直接发送本通知。）"];
  const selectedRights = rightList(rights);
  const rightsParagraphs = selectedRights.map(item => item.paragraph);
  const intro = `本人${employee}自${displayEmploymentDate(employmentDate)}起与贵公司建立劳动关系。现因下列事由，依法向贵公司作出解除劳动合同的通知：`;
  const effective = `基于上述事实，本人依据${basis || "（请核对并填写法律依据）"}解除双方劳动合同。本通知自送达贵公司之日起生效。`;
  const requests = [
    "请依法及时、足额结清截至劳动合同解除之日应付未付的工资、加班工资及其他劳动报酬；",
    "请依据《中华人民共和国劳动合同法》第四十六条、第四十七条依法支付经济补偿；",
    "请依据《中华人民共和国劳动合同法》第五十条出具解除劳动合同证明，并依法办理档案和社会保险关系转移等手续；",
    "请与本人联系办理工作交接及其他离职手续。",
  ];
  const dateText = displayDate(noticeDate);
  const markdown = [
    "# 解除劳动合同通知书",
    "",
    `**致：${company}**`,
    "",
    intro,
    "",
    "## 一、解除事由",
    "",
    ...safeReasons.flatMap((paragraph, index) => [`${index + 1}. ${paragraph}`, ""]),
    ...(rightsParagraphs.length ? ["## 二、随通知一并列明的待处理权益事项", "", ...rightsParagraphs.flatMap((paragraph, index) => [`${index + 1}. ${paragraph}`, ""])] : []),
    `## ${rightsParagraphs.length ? "三" : "二"}、解除通知与后续事项`,
    "",
    effective,
    "",
    ...requests.flatMap((paragraph, index) => [`${index + 1}. ${paragraph}`, ""]),
    "本人愿依法配合办理必要的工作交接。本通知一式两份，劳动者与用人单位各留存一份。",
    "",
    `通知人：${employee}`,
    contactText ? `联系方式：${contactText}` : "联系方式：________________",
    `日期：${dateText}`,
  ].join("\n");
  const reasonHtml = safeReasons.map((paragraph, index) => `<li>${index + 1}. ${escapeHtml(paragraph)}</li>`).join("");
  const rightsHtml = rightsParagraphs.map((paragraph, index) => `<li>${index + 1}. ${escapeHtml(paragraph)}</li>`).join("");
  const requestHtml = requests.map((paragraph, index) => `<li>${index + 1}. ${escapeHtml(paragraph)}</li>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>解除劳动合同通知书</title><style>
    @page{size:A4;margin:25mm 26mm 24mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#161616;font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",Arial,sans-serif;font-size:11pt;line-height:1.78}main{max-width:160mm;margin:0 auto}h1{margin:8mm 0 12mm;text-align:center;font-size:22pt;line-height:1.25;letter-spacing:.08em}h2{margin:7mm 0 3mm;font-size:12pt;line-height:1.5}p{margin:0 0 4mm;text-align:justify}ol{margin:0 0 5mm;padding:0;list-style:none}li{margin:0 0 2.5mm;text-align:justify}.recipient{margin-top:4mm;font-weight:700}.signature{width:72mm;margin:14mm 0 0 auto}.signature p{margin:0 0 3mm;text-align:left}
  </style></head><body><main><h1>解除劳动合同通知书</h1><p class="recipient">致：${escapeHtml(company)}</p><p>${escapeHtml(intro)}</p><h2>一、解除事由</h2><ol>${reasonHtml}</ol>${rightsParagraphs.length ? `<h2>二、随通知一并列明的待处理权益事项</h2><ol>${rightsHtml}</ol>` : ""}<h2>${rightsParagraphs.length ? "三" : "二"}、解除通知与后续事项</h2><p>${escapeHtml(effective)}</p><ol>${requestHtml}</ol><p>本人愿依法配合办理必要的工作交接。本通知一式两份，劳动者与用人单位各留存一份。</p><div class="signature"><p>通知人：${escapeHtml(employee)}</p><p>联系方式：${escapeHtml(contactText || "________________")}</p><p>日期：${escapeHtml(dateText)}</p></div></main></body></html>`;
  return { employee, company, intro, effective, requests, reasonParagraphs:safeReasons, rightsParagraphs, markdown, html };
};

export const safeTerminationNoticeFileName = ({ employeeName, noticeDate }) => {
  const employee = String(employeeName || "劳动者").trim().replace(/[\\/:*?"<>|]/g, "_") || "劳动者";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(noticeDate || "")) ? noticeDate : "未定日期";
  return `${employee}-解除劳动合同通知书-${date}`;
};
