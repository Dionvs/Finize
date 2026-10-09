// Money distribution is independent of UI, persistence and financial projection.
export const processingCents = value => {
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=Number(value),c=Math.round(n*100);
  return Number.isFinite(n)&&Number.isSafeInteger(c)&&Math.abs(n*100-c)<1e-6?c:null;
};
export function processingFamily(type){
  if(['uitgave','vaste-last','niet-meetellen'].includes(type))return 'uitgave';
  if(['sparen','naar-spaarrekening','van-spaarrekening'].includes(type))return 'sparen';
  if(['terugbetaling','refund'].includes(type))return 'terugbetaling';
  if(['inkomen','salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten'].includes(type))return 'inkomen';
  return type;
}
export function distributeProcessingCents(totalCents,lines){
  if(!Number.isSafeInteger(totalCents)||totalCents<0)throw new Error('Vul een geldig totaal in eurocenten in.');
  const result=lines.map(line=>({...line}));
  // No metadata on an old line is never permission to change its amount.
  const automatic=result.filter(line=>line.amountMode==='auto');
  const fixed=result.filter(line=>line.amountMode!=='auto').reduce((sum,line)=>sum+(processingCents(line.amount)??0),0);
  const remainder=Math.max(0,totalCents-fixed),share=automatic.length?Math.floor(remainder/automatic.length):0;
  automatic.forEach((line,index)=>{line.amount=(share+(index<remainder%automatic.length?1:0))/100;});
  return result;
}
export function redistributeProcessing(processing){
  const cents=processingCents(processing.processedAmount);
  if(cents!==null)processing.splits=distributeProcessingCents(Math.abs(cents),processing.splits||[]);
  return processing;
}
export function addProcessingSplit(processing,id,nextId){
  if(!(processing.splits||[]).length){
    const first={...processing,id,amount:processing.processedAmount,amountMode:'auto'};
    delete first.splits;delete first.singleLineAmount;delete first.singleLineId;
    const second={...first,id:nextId,amount:0,fixedExpenseId:'',fixedOccurrenceId:'',fixedOccurrenceMonth:'',fixedAmountMode:'none'};
    if(first.transactionType==='vaste-last'){second.transactionType='uitgave';second.category='Ongecategoriseerd';}
    processing.splits=[first,second];
  }else{
    const template=processing.splits[0],allManual=processing.splits.every(line=>line.amountMode!=='auto');
    processing.splits.push({id,amount:0,amountMode:'auto',transactionType:processing.transactionType==='vaste-last'?'uitgave':processing.transactionType,category:processing.transactionType==='vaste-last'?'Ongecategoriseerd':template.category,budgetOwner:template.budgetOwner||processing.budgetOwner,include:true,savingsGoalId:processing.savingsGoalId||'',refundCategory:template.refundCategory||'',refundMonth:template.refundMonth||'',advanceMode:processing.advanceMode||'none'});
    if(allManual){delete processing.singleLineAmount;delete processing.singleLineId;return processing;}
  }
  delete processing.singleLineAmount;delete processing.singleLineId;
  return redistributeProcessing(processing);
}
export function removeProcessingSplit(processing,index){
  processing.splits.splice(index,1);
  if(processing.splits.length===1){
    const remaining=processing.splits[0],total=processing.processedAmount;
    Object.assign(processing,remaining,{processedAmount:total,singleLineAmount:remaining.amount,singleLineId:remaining.id,splits:[]});
    delete processing.id;delete processing.amount;
  }else redistributeProcessing(processing);
  return processing;
}
export function splitDifference(processing){
  const total=processingCents(processing.processedAmount);
  const lines=processing.splits?.length?processing.splits:[{amount:processing.singleLineAmount??processing.processedAmount}];
  const actual=lines.reduce((sum,line)=>sum+(processingCents(line.amount)??0),0);
  return {expectedCents:total===null?0:Math.abs(total),actualCents:actual,differenceCents:(total===null?0:Math.abs(total))-actual};
}
