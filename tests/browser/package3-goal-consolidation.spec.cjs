const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {boot,navigate}=require('./helpers/v118-ux-fixture.cjs');

test('spaardoelweergave en subdoeleditor werken op mobiel, desktop en tablet',async({page},info)=>{
 const evidence=[];
 await boot(page,390,false,test.info().project.use.baseURL+'/');
 await page.evaluate(()=>commitChange(()=>{
  state.spaardoelen.dion=[{id:'p3-goal',naam:'Pakket 3 testdoel',doelbedrag:200,algespaard:25,eigenaar:'dion',subdoelen:[{id:'p3-child',naam:'Eerste stap',doelbedrag:200,gespaard:25,voltooid:false}]}];
 },{render:false}));
 for(const width of [390,1440,820]){
  await page.setViewportSize({width,height:900});
  await navigate(page,'spaardoelen');
  evidence.push(await page.evaluate(()=>{
   const root=document.querySelector('#tab-spaardoelen');
   const rows=[...root.querySelectorAll('.mobile-goal-row,.u2-goal-accordion,.u2-inline-actions')].map(el=>{
    const c=getComputedStyle(el),r=el.getBoundingClientRect();
    return {text:el.textContent.trim(),display:c.display,gap:c.gap,padding:c.padding,fontSize:c.fontSize,color:c.color,width:r.width,height:r.height};
   });
   const probe=document.createElement('div');probe.className='u2-dashboard-extra';root.append(probe);
   const c=getComputedStyle(probe),extra={display:c.display,gap:c.gap,fontSize:c.fontSize,color:c.color,gridColumn:c.gridColumn,justifyContent:c.justifyContent,marginTop:c.marginTop};probe.remove();
   return {width:innerWidth,rows,extra};
  }));
  await page.screenshot({path:info.outputPath(`goals-${width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:390,height:900});await navigate(page,'spaardoelen');
 await page.locator('[data-open-goal-editor="dion:p3-goal"]:visible').click();
 await expect(page.getByRole('heading',{name:'Spaardoel bewerken'})).toBeVisible();
 await page.locator('#incomeEditModal details summary',{hasText:'Subdoelen'}).click();
 await expect(page.locator('[data-u2-child-name]')).toHaveValue('Eerste stap');
 const baseline='.cache/pakket3-goals-before.json';
 if(process.env.FINIZE_P3_BASELINE==='1')fs.writeFileSync(baseline,JSON.stringify(evidence,null,2));
 else if(process.env.FINIZE_P3_COMPARE==='1')expect(evidence).toEqual(JSON.parse(fs.readFileSync(baseline,'utf8')));
 fs.writeFileSync(info.outputPath('computed.json'),JSON.stringify(evidence,null,2));
});
