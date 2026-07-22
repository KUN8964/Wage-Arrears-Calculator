const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const money = value => Number(value || 0).toLocaleString("zh-CN", {
  minimumFractionDigits:2,
  maximumFractionDigits:2,
});

const displayDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : "____年__月__日";
};

const filled = (value, fallback = "________________") => String(value || "").trim() || fallback;

export const ARBITRATION_CLAIMS = {
  wage:{label:"拖欠工资"},
  doublePay:{label:"未续订书面劳动合同二倍工资差额"},
  annualLeave:{label:"未休年休假工资报酬"},
  overtime:{label:"加班工资"},
  compTime:{label:"休息日加班未补休工资"},
  reimbursement:{label:"工作费用报销款（受案范围需复核）"},
  termination:{label:"解除或终止劳动合同经济补偿"},
};

export const ARBITRATION_PREPARATION_MATERIALS = [
  "劳动合同",
  "银行工资流水（例如工资卡所属银行流水）",
  "社会保险缴费记录",
  "申请人身份证明",
  "企业工商登记信息",
];

const claimDetails = (key, input) => {
  const amount = Number(input.amounts?.[key] || 0);
  if (!(key in ARBITRATION_CLAIMS) || amount <= 0) return null;
  const amountText = `人民币${money(amount)}元`;
  if (key === "wage") return {
    request:`请求裁决被申请人支付申请人${input.wagePeriod && input.wagePeriod !== "当前未形成欠薪" ? `${input.wagePeriod}期间` : "截至劳动关系解除、终止或本申请提出之日"}拖欠的工资${amountText}。`,
    fact:`被申请人未及时足额支付申请人工资。根据申请人现有工资记录和银行流水初步核算，欠付工资为${amountText}，涉及期间为${filled(input.wagePeriod, "待根据工资记录补充")}。`,
  };
  if (key === "doublePay") return {
    request:`请求裁决被申请人支付申请人劳动合同期满后未续订书面劳动合同期间的二倍工资差额${amountText}。`,
    fact:`双方书面劳动合同于${displayDate(input.contractEnd)}期满。此后申请人继续提供劳动，被申请人继续用工，至${displayDate(input.cutoffDate)}仍未另行续订书面劳动合同。二倍工资差额暂计${amountText}。`,
  };
  if (key === "annualLeave") return {
    request:`请求裁决被申请人支付申请人未休年休假工资报酬${amountText}。`,
    fact:`申请人根据累计工作年限、当年在职期间和已休假记录，初步核算尚有${filled(input.annualLeaveDays, "待核对")}天年休假未依法安排或结算，未休年休假工资报酬暂计${amountText}。`,
  };
  if (key === "overtime") return {
    request:`请求裁决被申请人支付申请人尚未结清的加班工资${amountText}。`,
    fact:`申请人在工作日、休息日或法定节假日存在加班情形，相关工资尚未结清，加班工资暂计${amountText}；具体时数、工时制度和计算基数以考勤、排班、工作成果及审理认定为准。`,
  };
  if (key === "compTime") return {
    request:`请求裁决被申请人支付申请人休息日加班后未安排补休对应的加班工资${amountText}。`,
    fact:`申请人存在休息日加班且未获补休的情形，相关加班工资暂计${amountText}；该部分与其他加班工资请求所涉日期不重复。`,
  };
  if (key === "reimbursement") return {
    request:`请求裁决被申请人支付申请人为完成工作任务垫付且尚未报销的费用${amountText}。`,
    fact:`申请人为完成工作任务垫付相关费用，被申请人尚未报销，暂计${amountText}。本项是否属于劳动人事争议仲裁受案范围，请结合费用性质、审批记录和当地受理口径复核。`,
  };
  if (key === "termination") return {
    request:`请求裁决被申请人支付申请人解除或终止劳动合同经济补偿${amountText}。`,
    fact:`${input.employmentStatus === "departed" ? `双方劳动关系于${displayDate(input.departureDate || input.cutoffDate)}解除或终止。` : input.forcedNoticeSent === "yes" ? "申请人已向被申请人作出解除劳动合同通知，具体送达事实需以证据核对。" : "申请人尚需核对劳动关系是否已经解除、终止，以及解除通知是否有效送达。"}申请人根据本单位工作年限和解除、终止原因，初步核算经济补偿为${amountText}；具体资格和金额以解除事实、送达证据及审理认定为准。`,
  };
  return null;
};

/**
 * Build a locally generated, editable labor-arbitration application.
 * All amounts and facts remain subject to the user's evidence and tribunal review.
 */
export const buildArbitrationApplication = (input = {}) => {
  const applicant = {
    name:filled(input.applicant?.name, "（请填写申请人姓名）"),
    gender:filled(input.applicant?.gender, "____"),
    birthDate:displayDate(input.applicant?.birthDate),
    idNumber:filled(input.applicant?.idNumber),
    address:filled(input.applicant?.address),
    serviceAddress:filled(input.applicant?.serviceAddress),
    phone:filled(input.applicant?.phone),
    position:filled(input.applicant?.position, "待补充"),
  };
  const respondent = {
    name:filled(input.respondent?.name, "（请填写被申请人单位全称）"),
    registeredAddress:filled(input.respondent?.registeredAddress),
    officeAddress:filled(input.respondent?.officeAddress, "同注册地址或待补充"),
    legalRepresentative:filled(input.respondent?.legalRepresentative),
    legalRepresentativeTitle:filled(input.respondent?.legalRepresentativeTitle, "法定代表人或主要负责人"),
    phone:filled(input.respondent?.phone),
  };
  const selectedClaims = [...new Set(Array.isArray(input.claims) ? input.claims : [])];
  const claimEntries = selectedClaims.map(key => ({key,...claimDetails(key, input)})).filter(item => item.request);
  const requestParagraphs = claimEntries.map(item => item.request);
  const facts = [
    `申请人于${displayDate(input.employmentDate)}入职被申请人处，工作岗位为${applicant.position}，约定月工资为人民币${money(input.contractPay)}元。${input.employmentStatus === "active" ? `截至${displayDate(input.cutoffDate)}，双方劳动关系仍在持续。` : `双方劳动关系于${displayDate(input.departureDate || input.cutoffDate)}解除或终止。`}`,
    ...claimEntries.map(item => item.fact),
    String(input.additionalFacts || "").trim(),
    "为维护申请人的合法权益，现依据《中华人民共和国劳动争议调解仲裁法》《中华人民共和国劳动合同法》等相关规定申请仲裁。上述金额为依据现有材料作出的初步核算，申请人将根据证据交换、被申请人提交材料及仲裁庭审理情况依法核对。",
  ].filter(Boolean);
  const evidence = [...new Set((Array.isArray(input.evidence) ? input.evidence : []).map(item => String(item || "").trim()).filter(Boolean))];
  const committee = filled(input.committee, "________________劳动人事争议仲裁委员会");
  const applicationDate = displayDate(input.applicationDate);
  const requestsForDocument = requestParagraphs.length ? requestParagraphs : ["（尚未选择仲裁请求，请勿直接提交本申请书。）"];
  const evidenceForDocument = evidence.length ? evidence : ["（请根据实际持有材料补充证据名称、证明目的和来源。）"];
  const applicantLine = `申请人：${applicant.name}，性别：${applicant.gender}，出生日期：${applicant.birthDate}，身份证件号码：${applicant.idNumber}，住所：${applicant.address}，通讯/送达地址：${applicant.serviceAddress}，联系电话：${applicant.phone}。`;
  const respondentLine = `被申请人：${respondent.name}，注册地址：${respondent.registeredAddress}，实际办公地址：${respondent.officeAddress}，法定代表人或主要负责人：${respondent.legalRepresentative}，职务：${respondent.legalRepresentativeTitle}，联系电话：${respondent.phone}。`;
  const markdown = [
    "# 劳动人事争议仲裁申请书",
    "",
    applicantLine,
    "",
    respondentLine,
    "",
    "## 仲裁请求事项",
    "",
    ...requestsForDocument.flatMap((paragraph, index) => [`${index + 1}. ${paragraph}`, ""]),
    "## 事实和理由",
    "",
    ...facts.map(paragraph => `${paragraph}\n`),
    "## 证据和证据来源",
    "",
    ...evidenceForDocument.flatMap((paragraph, index) => [`${index + 1}. ${paragraph}`, ""]),
    "如有证人，证人姓名、住所、通讯地址和联系电话：________________。",
    "",
    "此致",
    "",
    committee,
    "",
    `申请人（签名或盖章）：${applicant.name}`,
    `日期：${applicationDate}`,
    "",
    `附：${ARBITRATION_PREPARATION_MATERIALS.join("、")}等材料复印件。单一被申请人的常见场景可先准备一式三份，最终份数以受理机构要求为准。`,
    "",
    "> 提交前提示：请核对仲裁管辖、时效、请求期间与金额，并删除不符合实际情况的请求、事实或证据。社会保险和住房公积金补缴通常需另向对应行政主管机关申请核查，本申请书未自动将其列为劳动仲裁金额请求。",
  ].join("\n");
  const listHtml = values => values.map((paragraph, index) => `<li>${index + 1}. ${escapeHtml(paragraph)}</li>`).join("");
  const factsHtml = facts.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const attachmentText = `附：${ARBITRATION_PREPARATION_MATERIALS.join("、")}等材料复印件。单一被申请人的常见场景可先准备一式三份，最终份数以受理机构要求为准。`;
  const html = `<!doctype html><html lang="zh-CN" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>劳动人事争议仲裁申请书</title><style>
    @page{size:A4 portrait;margin:25.4mm 31.75mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:"STFangsong","FangSong","仿宋","Noto Serif CJK SC",serif;font-size:14pt;line-height:1.8}main{width:100%;margin:0 auto}h1{margin:0 0 12mm;text-align:center;font-family:"STZhongsong","华文中宋","STSong","SimSun",serif;font-size:20pt;font-weight:700;letter-spacing:.28em;line-height:1.4}h2{margin:6mm 0 2mm;font:700 14pt/1.6 "STFangsong","FangSong","仿宋",serif}p{margin:0 0 2.4mm;text-align:justify}ol{margin:0 0 3mm;padding:0;list-style:none}li{margin:0 0 2.4mm;text-align:justify}.party{margin-bottom:4mm}.recipient{margin:5mm 0 0 2em}.committee{margin:0 0 8mm 4em}.signature{width:88mm;margin:8mm 0 0 auto}.signature p{text-align:left}.attachments{margin-top:8mm;font-family:"STSong","SimSun","宋体",serif;font-size:10.5pt;line-height:1.65}.note{margin-top:3mm;padding-top:2mm;border-top:.5pt solid #999;font-family:"STSong","SimSun","宋体",serif;font-size:10.5pt;line-height:1.65}
  </style></head><body><main><h1>劳动人事争议仲裁申请书</h1><p class="party">${escapeHtml(applicantLine)}</p><p class="party">${escapeHtml(respondentLine)}</p><h2>仲裁请求事项：</h2><ol>${listHtml(requestsForDocument)}</ol><h2>事实和理由：</h2>${factsHtml}<h2>证据和证据来源：</h2><ol>${listHtml(evidenceForDocument)}</ol><p>如有证人，证人姓名、住所、通讯地址和联系电话：________________。</p><p class="recipient">此致</p><p class="committee">${escapeHtml(committee)}</p><div class="signature"><p>申请人（签名或盖章）：${escapeHtml(applicant.name)}</p><p>日期：${escapeHtml(applicationDate)}</p></div><p class="attachments">${escapeHtml(attachmentText)}</p><p class="note">提交前提示：请核对仲裁管辖、时效、请求期间与金额，并删除不符合实际情况的请求、事实或证据。社会保险和住房公积金补缴通常需另向对应行政主管机关申请核查，本申请书未自动将其列为劳动仲裁金额请求。</p></main></body></html>`;
  return {
    applicant,
    respondent,
    committee,
    requestParagraphs:requestsForDocument,
    factParagraphs:facts,
    evidenceParagraphs:evidenceForDocument,
    total:selectedClaims.reduce((sum, key) => sum + Number(input.amounts?.[key] || 0), 0),
    markdown,
    html,
  };
};

export const safeArbitrationApplicationFileName = ({ applicantName, applicationDate }) => {
  const applicant = String(applicantName || "申请人").trim().replace(/[\\/:*?"<>|]/g, "_") || "申请人";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(applicationDate || "")) ? applicationDate : "未定日期";
  return `${applicant}-劳动人事争议仲裁申请书-${date}`;
};
