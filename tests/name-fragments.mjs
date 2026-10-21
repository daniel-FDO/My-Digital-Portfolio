import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('review/name-fragments', {recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
const check=(name,pass)=>{results.push({name,pass});console.log(pass?'PASS':'FAIL',name);};
try {
 for(const width of [1440,768,390]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');await page.evaluate(()=>document.fonts.ready);
  const button=page.getByRole('button',{name:'Animate Daniel’s name'});
  await button.scrollIntoViewIfNeeded();await page.waitForTimeout(900);
  const card=page.locator('.daniel');
  await card.screenshot({path:`review/name-fragments/rest-${width}.png`});
  const box=await button.boundingBox();
  if(width===390) await button.tap(); else await page.mouse.move(box.x+box.width*.36,box.y+box.height*.5);
  await page.waitForTimeout(400);
  check(`${width}: activates`,await card.evaluate(e=>e.classList.contains('is-fragmenting')));
  check(`${width}: painted fragments`,await page.locator('.daniel__fragments').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((n,i)=>i%4===3&&n>0)));
  await card.screenshot({path:`review/name-fragments/active-${width}.png`});
  await page.mouse.move(0,0); await button.evaluate(e=>e.blur());await page.waitForTimeout(2400);
  check(`${width}: settles and stops`,await card.evaluate(e=>!e.classList.contains('is-fragmenting')));
  check(`${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await button.focus();await page.keyboard.press('Enter');await page.waitForTimeout(350);
  check(`${width}: keyboard activation`,await card.evaluate(e=>e.classList.contains('is-fragmenting')));
  await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.waitForTimeout(100);
  await button.click();await page.waitForTimeout(400);await card.screenshot({path:`review/name-fragments/light-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});await button.click();
  check(`${width}: reduced motion stays readable`,await card.evaluate(e=>!e.classList.contains('is-fragmenting')));
  await page.emulateMedia({reducedMotion:'no-preference'});await button.click();await page.locator('#contact').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  check(`${width}: offscreen stops`,await card.evaluate(e=>!e.classList.contains('is-fragmenting')));
  check(`${width}: no page errors`,!errors.length);
  await context.close();
 }
}finally{await browser.close();}
fs.writeFileSync('review/name-fragments/checks.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
