const moneyClaimLabels = {
  wage: "欠薪",
  doublePay: "双倍工资",
  annualLeave: "未休年假工资",
  overtime: "加班工资",
  compTime: "未补休工资",
  reimbursement: "报销欠款",
};

const dedupe = values => [...new Set(values.filter(Boolean))];

export function buildRightsRoutePlan(input = {}) {
  const hasSocialGap = Boolean(input.socialEnabled && Number(input.socialDue) > 0);
  const hasFundGap = Boolean(input.fundEnabled && Number(input.fundDue) > 0);
  const hasContributionGap = hasSocialGap || hasFundGap;
  const socialGapKind = hasSocialGap ? (input.socialHasPaid ? "underpaid" : "unpaid") : "none";
  const activeMoneyClaims = Object.entries(moneyClaimLabels)
    .filter(([key]) => Number(input[`${key}Due`]) > 0)
    .map(([, label]) => label);
  const hasLaborMoneyClaim = activeMoneyClaims.length > 0;
  const hasWageClaim = Number(input.wageDue) > 0;
  const forcedTermination = Boolean(input.terminationEnabled && input.terminationType === "forced");
  const workInjury = Boolean(input.workInjuryEnabled);
  const routes = [];

  if (hasContributionGap) {
    const targets = [hasSocialGap ? "社会保险" : "", hasFundGap ? "住房公积金" : ""].filter(Boolean).join("和");
    routes.push({
      id:"contribution",
      tone:"primary",
      badge:"优先处理",
      title:`申请${targets}核查补缴`,
      suitable:`系统已测算出${targets}可能存在未缴或少缴`,
      description:hasSocialGap && hasFundGap
        ? "社保与公积金应分别进入对应行政核查渠道，补缴请求本身不宜只依赖劳动仲裁。"
        : hasSocialGap
          ? "先依据官方缴费明细申请核查。参保登记、基数核定和征收职责可能分属人社、医保与税务部门。"
          : "向缴存地住房公积金管理中心申请核查并责令单位补缴。",
      steps:dedupe([
        hasSocialGap ? "下载或打印含缴费基数、险种和月份的官方社保明细" : "",
        hasFundGap ? "下载或打印住房公积金缴存明细" : "",
        "整理工资流水、工资条、劳动合同和个税收入记录",
        "可先书面催告并保留EMS、邮件或平台送达记录",
        hasSocialGap ? "按参保地公开指南向12333、人社/社保、医保或12366税务渠道确认具体受理机关" : "",
        hasFundGap ? "向当地住房公积金管理中心办理，12329可作为查询入口" : "",
      ]),
      caution:"催告有助于固定证据，但不是投诉的全国统一法定前置程序；缴费基数和最终金额以主管机关核定为准。",
    });
  }

  if (hasLaborMoneyClaim) {
    const simpleWageClaim = activeMoneyClaims.length === 1 && activeMoneyClaims[0] === "欠薪" && !forcedTermination;
    routes.push({
      id:"labor",
      tone:hasContributionGap ? "secondary" : "primary",
      badge:simpleWageClaim ? "先催发" : "争议处理",
      title:simpleWageClaim ? "劳动监察催发，争议不清再仲裁" : "准备劳动仲裁请求与计算明细",
      suitable:`当前涉及${activeMoneyClaims.join("、")}`,
      description:simpleWageClaim
        ? "单位和欠薪事实较清楚时，可先向有管辖权的人社行政部门或劳动保障监察机构投诉；金额、责任或解除性质发生争议时转劳动仲裁。"
        : "把不同项目拆成明确的仲裁请求，逐项列明期间、计算式、金额和证据，避免只提交一个总数。",
      steps:dedupe([
        "保存劳动合同、工资流水、工资条、考勤和完整沟通记录",
        `按${activeMoneyClaims.join("、")}分别制作月份与金额清单`,
        simpleWageClaim ? "书面催告工资并保留送达记录，可同步咨询劳动保障监察受理窗口" : "核对劳动仲裁管辖地、时效及所需申请材料",
        simpleWageClaim ? "存在金额或责任争议时，向劳动人事争议仲裁委员会提出请求" : "向有管辖权的劳动人事争议仲裁委员会提交明确请求和证据目录",
      ]),
      caution:"一般劳动争议仲裁时效为一年；劳动关系存续期间的欠薪争议适用特别规则，但劳动关系终止后仍应及时提出。债权到期、金额明确且无实质争议时，可另行评估支付令。",
    });
  }

  if (hasWageClaim) {
    routes.push({
      id:"payment-order",
      tone:"secondary",
      badge:"快速程序",
      title:"债权明确时，评估申请支付令",
      suitable:"当前测算已形成欠薪金额；工资已经到期、金额确定且单位没有实质争议时更适用",
      description:"《劳动合同法》第30条允许劳动者就拖欠或未足额支付的劳动报酬向当地人民法院申请支付令。支付令是督促程序，不替代存在实质争议时的劳动仲裁或诉讼。",
      steps:[
        "整理劳动合同、工资确认单、对账记录、工资流水和工资到期证明",
        "确认用人单位主体、住所和可送达地址，并按法院公开指南确认有管辖权的基层人民法院",
        "按月份列明已经到期的工资本金、计算口径和对应证据，不把未经主管机关核定的社保或公积金差额混入申请",
        "关注法院受理、送达和单位异议；程序终结或争议实质化后，及时转劳动仲裁或后续诉讼",
      ],
      caution:"适合债权债务关系清楚、工资已经到期、金额确定且能够送达的情形；单位提出有效书面异议或支付令无法送达时，督促程序可能终结。",
    });

    routes.push({
      id:"wage-crime",
      tone:"warning",
      badge:"刑事门槛",
      title:"恶意欠薪：符合条件时启动刑事线索移送",
      suitable:"存在欠薪不等于犯罪；需结合逃避支付或有能力而拒不支付、数额较大，以及经政府有关部门责令支付后仍不支付等条件",
      description:"法定罪名是拒不支付劳动报酬罪。通常先向劳动保障监察机构投诉，或通过全国根治欠薪线索反映平台提交线索，由行政机关调查、责令支付；涉嫌犯罪的，再依法移送公安机关。",
      steps:[
        "向有管辖权的劳动保障监察机构投诉，或通过全国根治欠薪线索反映平台提交欠薪线索",
        "提交劳动关系、应付与实付工资、欠薪期间、负责人和经营场所信息，以及转移财产、逃匿或持续拒付等线索",
        "保存责令支付或限期整改文书、行政处理决定书、送达或张贴记录，以及期限届满后仍未支付的证明",
        "符合涉嫌犯罪条件时，向人社部门查询移送公安情况；直接向公安机关提交材料时，保留受案登记或接报案回执",
      ],
      caution:"不要仅凭欠薪金额自行认定单位构成犯罪。是否立案和定罪，由公安、检察和审判机关结合数额、行为方式、责令支付程序及后果依法认定。",
    });
  }

  if (forcedTermination) {
    let title = "被迫解除与经济补偿N需先复核";
    let badge = "条件评估";
    let tone = "warning";
    let description = "经济补偿N不是补缴差额的自动附加项，必须同时核对单位违法事实、解除理由、通知内容和送达证据。";
    if (input.personalResignationSigned === "yes") {
      title = "已签普通离职文件，优先专业复核";
      badge = "高风险";
      description = "已提交“个人原因辞职”或签署离职协议，可能与依据第38条被迫解除的主张冲突，不宜直接发送第二份相互矛盾的通知。";
    } else if (input.forcedNoticeSent === "yes" && input.forcedNoticeProof === "yes") {
      title = "整理第38条解除证据并评估仲裁N";
      badge = "可进入复核";
      tone = "secondary";
      description = "系统记录显示已发送第38条解除通知并保留送达证明，可继续核对通知理由是否与现有违法证据一致。";
    } else if (input.forcedNoticeSent === "no") {
      title = "先固定违法证据，不要写普通辞职";
      description = "尚未发送第38条解除通知。先核对违法事实与证据，再决定是否解除；书面催告有价值，但并非全国统一的法定必经步骤。";
    }
    const socialCaution = socialGapKind === "underpaid"
      ? "当前属于已缴但可能基数偏低，能否据此支持经济补偿N存在个案和地区裁审风险。"
      : socialGapKind === "unpaid"
        ? "当前显示存在未缴社保情形，但仍需以官方记录、劳动关系和解除通知为准。"
        : "仅有公积金少缴或其他争议时，不应自动等同于《劳动合同法》第38条的未缴社会保险情形。";
    routes.push({
      id:"forced-termination",
      tone,
      badge,
      title,
      suitable:"用户选择了被迫离职（N）",
      description,
      steps:dedupe([
        "核对是否已经提交普通辞职申请、离职协议或其他解除文件",
        "固定单位违法事实及其发生期间，保留原始电子文件",
        input.forcedNoticeSent === "yes" ? "核对第38条通知写明的解除理由，并保存通知正文" : "发送任何解除文件前，先复核解除理由和证据是否对应",
        input.forcedNoticeProof === "yes" ? "保存EMS签收、邮件原文或企业通讯工具送达记录" : "补充能够证明单位收到通知的送达证据",
        "解除性质、基数少缴或文件冲突存在疑问时，先咨询律师或法律援助机构",
      ]),
      caution:`${socialCaution} 最终是否支持N，由仲裁机构或法院结合证据认定。`,
    });
  } else if (hasContributionGap) {
    routes.push({
      id:"remain-employed",
      tone:"secondary",
      badge:"继续在职",
      title:"暂不离职，先要求整改并跟踪结果",
      suitable:"当前未选择被迫离职经济补偿",
      description:"可以只主张核查和补缴，不需要为了追缴而先行离职。",
      steps:["保留在职状态下的劳动关系和工资证据", "发出书面补缴要求并记录单位答复", "向主管机关提交核查材料并保存受理编号", "跟踪补缴月份、基数和个人承担部分"],
      caution:"不要把行政补缴、个人承担部分和经济补偿N合并成一个未经核定的金额。",
    });
  }

  if (workInjury) {
    routes.unshift({
      id:"work-injury",
      tone:"primary",
      badge:"注意期限",
      title:"工伤认定程序优先于待遇测算",
      suitable:"用户选择了工伤情况初筛",
      description:"先确认单位是否申请工伤认定；单位未申请时，劳动者或近亲属应关注事故伤害发生或职业病诊断后的一年申请期限。",
      steps:["保存病历、诊断、事故现场和劳动关系证明", "核实单位是否已经提交工伤认定申请", "向当地社会保险行政部门确认材料和受理窗口"],
      caution:"系统初筛不构成工伤认定，也不替代劳动能力鉴定。",
    });
  }

  if (!routes.length) {
    routes.push({
      id:"review",
      tone:"secondary",
      badge:"先复核",
      title:"当前没有形成明确的程序分流",
      suitable:"尚未测算出欠款或未选择需要处理的事项",
      description:"返回测算条件核对月份、金额和事项；如实际存在争议但无法量化，可先整理劳动关系和付款记录。",
      steps:["核对入职和截止日期", "确认已选择实际发生的事项", "补充官方记录和原始凭证"],
      caution:"不要仅凭系统未算出金额判断不存在劳动权益问题。",
    });
  }

  const evidence = dedupe([
    "劳动合同、入职通知、工牌或其他劳动关系证明",
    hasLaborMoneyClaim || hasContributionGap || forcedTermination ? "银行工资流水、工资条、个税收入记录及奖金津贴凭证" : "",
    hasSocialGap ? "官方社保缴费明细，尽量包含年度、险种、缴费工资或申报基数" : "",
    hasFundGap ? "住房公积金官方缴存明细" : "",
    hasLaborMoneyClaim ? "考勤、排班、审批、工资沟通及催告记录的原始文件" : "",
    forcedTermination ? "解除通知正文、EMS面单与签收、邮件原文或企业通讯工具送达记录" : "",
    workInjury ? "病历、诊断证明、事故现场材料、交通事故责任认定及工伤申报材料" : "",
  ]);

  const headline = routes[0].title;
  const summary = hasContributionGap && hasLaborMoneyClaim
    ? "补缴请求与劳动报酬争议需要分开走对应程序，可并行准备证据，但不要把所有金额混成一个请求。"
    : hasContributionGap
      ? "当前主要是缴费差额问题，优先走行政核查；是否离职和是否主张N是另一项独立决定。"
      : hasLaborMoneyClaim
        ? "当前主要是劳动报酬或补偿争议，应把请求、月份、金额和证据逐项对应。"
        : "系统根据当前选择给出程序导航，结果不替代受理机关的管辖判断。";

  return { headline, summary, routes, evidence, activeMoneyClaims, socialGapKind };
}
