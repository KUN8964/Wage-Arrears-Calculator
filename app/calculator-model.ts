import { DEFAULT_PERSONAL_SOCIAL_RATES, DEFAULT_SOCIAL_RATES } from "./contribution-calculator.mjs";

export type Row = {
  id:number; wageMonth:string; payDate:string; normalPay:number; note:string; paid:number;
  status:"已结清"|"未结清"; duePay:number; arrears:number; contractPay:number;
  wageDeduction:number;
  socialPaid:number; socialBase:number; socialActualBase:number; socialPersonalPaid:number; socialRate:number; socialDue:number;
  fundPaid:number; fundBase:number; fundActualBase:number; fundPersonalPaid:number; fundRate:number; fundDue:number;
};

export type DoublePayRule = { enabled:boolean; contractEnd:string; continuedUntil:string };
export type Claim = "wage"|"social"|"fund"|"doublePay"|"reimbursement"|"annualLeave"|"overtime"|"compTime"|"termination"|"workInjury";
export type FlowStep = "basic"|"scenario"|"questions"|"review"|"results";
export type SocialRates = { pension:number; unemployment:number; injury:number; maternity:number; medical:number };
export type Confirmation = "yes"|"no"|"unknown";
export type QuestionIssue = { id:string; message:string; targetId:string };
export type RightsRoute = { id:string; tone:"primary"|"secondary"|"warning"; badge:string; title:string; suitable:string; description:string; steps:string[]; caution:string };
export type RightsPlan = { headline:string; summary:string; routes:RightsRoute[]; evidence:string[]; activeMoneyClaims:string[]; socialGapKind:"none"|"underpaid"|"unpaid" };

export type QuickSetup = {
  employmentStatus:"active"|"departed"; employmentDate:string; departureDate:string; cutoffDate:string; contractStart:string; contractEnd:string; contractPay:number;
  arrearsStartMonth:string; firstArrearsPaidRate:number;
  socialHasPaid:boolean; socialPaid:number; socialActualBase:number; socialPersonalPaid:number; socialPaidStartMonth:string; socialPaidEndMonth:string; socialBase:number; socialRate:number;
  socialPensionRate:number; socialUnemploymentRate:number; socialInjuryRate:number; socialMaternityRate:number; socialMedicalRate:number;
  socialPersonalPensionRate:number; socialPersonalUnemploymentRate:number; socialPersonalInjuryRate:number; socialPersonalMaternityRate:number; socialPersonalMedicalRate:number;
  fundHasPaid:boolean; fundPaid:number; fundActualBase:number; fundPersonalPaid:number; fundPaidStartMonth:string; fundPaidEndMonth:string; fundBase:number; fundRate:number; fundPersonalRate:number;
  reimbursementAmount:number; reimbursementNote:string; reimbursementIncluded:boolean;
  annualLeaveWorkYears:number; annualLeaveTakenDays:number; annualLeavePriorUnusedDays:number; annualLeaveAveragePay:number; annualLeaveWrittenWaiver:boolean;
  overtimeWageBase:number; weekdayOvertimeHours:number; restDayOvertimeHours:number; holidayOvertimeHours:number;
  compTimeWageBase:number; outstandingCompTimeDays:number; restDayClaimsDistinct:boolean;
  terminationType:"forced"|"layoff"; terminationAveragePay:number; terminationAdditionalMonths:number; terminationExtraPayBase:number; terminationLocalAveragePay:number;
  personalResignationSigned:Confirmation; forcedNoticeSent:Confirmation; forcedNoticeProof:Confirmation;
  terminationEmployeeName:string; terminationCompanyName:string; terminationNoticeContact:string; terminationNoticeDate:string;
  workInjuryKind:"work"|"commute"|"businessTrip"|"occupationalDisease"|"suddenDeath"|"unclear";
  workInjuryDate:string; workInjuryCommuteResponsibility:"nonPrimary"|"primary"|"pending"; workInjuryEmployerApplied:"yes"|"no"|"unknown";
};

export type LegacyQuickSetup = Partial<QuickSetup> & { startMonth?:string; endMonth?:string; duePay?:number; actualPay?:number };

export const defaultRule:DoublePayRule = {enabled:false,contractEnd:"",continuedUntil:""};

export const defaultSetup:QuickSetup = {
  employmentStatus:"active",employmentDate:"",departureDate:"",cutoffDate:"",contractStart:"",contractEnd:"",contractPay:0,
  arrearsStartMonth:"",firstArrearsPaidRate:0,
  socialHasPaid:false,socialPaid:0,socialActualBase:0,socialPersonalPaid:0,socialPaidStartMonth:"",socialPaidEndMonth:"",socialBase:0,socialRate:27.6,
  socialPensionRate:DEFAULT_SOCIAL_RATES.pension,socialUnemploymentRate:DEFAULT_SOCIAL_RATES.unemployment,socialInjuryRate:DEFAULT_SOCIAL_RATES.injury,socialMaternityRate:DEFAULT_SOCIAL_RATES.maternity,socialMedicalRate:DEFAULT_SOCIAL_RATES.medical,
  socialPersonalPensionRate:DEFAULT_PERSONAL_SOCIAL_RATES.pension,socialPersonalUnemploymentRate:DEFAULT_PERSONAL_SOCIAL_RATES.unemployment,socialPersonalInjuryRate:DEFAULT_PERSONAL_SOCIAL_RATES.injury,socialPersonalMaternityRate:DEFAULT_PERSONAL_SOCIAL_RATES.maternity,socialPersonalMedicalRate:DEFAULT_PERSONAL_SOCIAL_RATES.medical,
  fundHasPaid:false,fundPaid:0,fundActualBase:0,fundPersonalPaid:0,fundPaidStartMonth:"",fundPaidEndMonth:"",fundBase:0,fundRate:5,fundPersonalRate:5,
  reimbursementAmount:0,reimbursementNote:"",reimbursementIncluded:true,
  annualLeaveWorkYears:1,annualLeaveTakenDays:0,annualLeavePriorUnusedDays:0,annualLeaveAveragePay:0,annualLeaveWrittenWaiver:false,
  overtimeWageBase:0,weekdayOvertimeHours:0,restDayOvertimeHours:0,holidayOvertimeHours:0,
  compTimeWageBase:0,outstandingCompTimeDays:0,restDayClaimsDistinct:false,
  terminationType:"forced",terminationAveragePay:0,terminationAdditionalMonths:1,terminationExtraPayBase:0,terminationLocalAveragePay:0,
  personalResignationSigned:"unknown",forcedNoticeSent:"unknown",forcedNoticeProof:"unknown",
  terminationEmployeeName:"",terminationCompanyName:"",terminationNoticeContact:"",terminationNoticeDate:"",
  workInjuryKind:"unclear",workInjuryDate:"",workInjuryCommuteResponsibility:"pending",workInjuryEmployerApplied:"unknown",
};

export const claimOptions:{key:Claim;title:string;copy:string;mark:string}[] = [
  {key:"wage",title:"工资少发或未发",copy:"从欠薪开始月自动计算",mark:"欠"},
  {key:"social",title:"社保少缴或未缴",copy:"计算公司部分尚欠差额",mark:"社"},
  {key:"fund",title:"公积金少缴或未缴",copy:"实缴金额先抵扣应缴",mark:"积"},
  {key:"doublePay",title:"未签订劳动合同或合同到期仍在工作",copy:"满一个月自动双倍计薪",mark:"2×"},
  {key:"reimbursement",title:"报销费用未支付",copy:"可计入合计或仅在报告记录",mark:"报"},
  {key:"annualLeave",title:"未休年假折现",copy:"按工龄和离职当年天数折算",mark:"年"},
  {key:"overtime",title:"加班工资未支付",copy:"工作日、休息日和法定节假日分开算",mark:"加"},
  {key:"compTime",title:"调休尚未兑现",copy:"只计算休息日加班尚未补休",mark:"休"},
  {key:"termination",title:"离职经济补偿",copy:"被迫离职 N / 公司解除 N+X",mark:"N"},
  {key:"workInjury",title:"工作中或通勤途中受伤",copy:"资格与申报期限初筛，不计入合计",mark:"伤"},
];
