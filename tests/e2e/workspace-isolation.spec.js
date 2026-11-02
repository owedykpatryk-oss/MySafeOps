import { test, expect } from '@playwright/test';

test.skip(({ baseURL }) => !baseURL?.endsWith(':4188'), 'Requires isolated local workspace');

async function seed(page) {
  await page.goto('/app?view=documents', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    for (const org of ['default', 'qa-org-b']) localStorage.setItem(`mysafeops_org_settings_${org}`, JSON.stringify({ name: org, onboardingWizardCompleted: true }));
    localStorage.setItem('mysafeops_subscription_status', 'active');
    localStorage.setItem('mysafeops_billing_plan', 'team');
    for (const [key, id] of [['rams_builder_docs_default','A'], ['rams_builder_docs_qa-org-b','B'], ['rams_builder_docs_default__country_qa-pl','PL']]) localStorage.setItem(key, JSON.stringify([{ id, title: `QA ${id} original`, rows: [], status: 'draft' }]));
  });
}

for (const kind of ['organisation','country']) test(`two tabs preserve separate RAMS registers after ${kind} change`, async ({ page, context }) => {
  await seed(page); await page.goto('/app?view=rams', { waitUntil: 'domcontentloaded' }); await expect(page.getByText('QA A original', { exact: true })).toBeVisible();
  const second = await context.newPage(); await second.goto('/app?view=documents', { waitUntil: 'domcontentloaded' }); await expect(second.locator('#main-content')).toBeVisible({ timeout: 30000 });
  await second.evaluate(async kind => {
    if (kind === 'organisation') { const { setOrgId } = await import('/src/utils/orgId.js'); setOrgId('qa-org-b'); }
    else { const { cacheActiveCountryWorkspace } = await import('/src/utils/countryWorkspaces.js'); cacheActiveCountryWorkspace({ id:'qa-pl', is_primary:false, market_id:'pl' }); }
  }, kind);
  const id = kind === 'organisation' ? 'B' : 'PL';
  await expect(page.getByText(`QA ${id} original`, { exact: true })).toBeVisible();
  await expect(page.getByText('QA A original', { exact: true })).toHaveCount(0);
  page.once('dialog', d => d.accept(`QA ${id} edited`)); await page.getByRole('button',{ name:kind === 'country' ? 'Zmień nazwę' : 'Rename', exact:true }).click();
  const destination = kind === 'organisation' ? 'rams_builder_docs_qa-org-b' : 'rams_builder_docs_default__country_qa-pl';
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key))[0].title, destination)).toBe(`QA ${id} edited`);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rams_builder_docs_default'))[0])).toMatchObject({ id:'A', title:'QA A original' });
  await second.close();
});

test('GPR draft stays with its organisation and returns when switching back', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => { const { blankGprReport } = await import('/src/modules/gprReport/gprReportConstants.js'); localStorage.setItem('gpr_reports_default', JSON.stringify([blankGprReport({ id:'gpr-a', title:'QA GPR A', ref:'GPR-A' })])); });
  await page.goto('/app?view=gpr-report', { waitUntil: 'domcontentloaded' }); await page.getByText('QA GPR A',{ exact:true }).click(); await expect(page.locator('input[value="QA GPR A"]')).toBeVisible();
  await page.evaluate(async () => { const {setOrgId}=await import('/src/utils/orgId.js');setOrgId('qa-org-b'); });
  await page.reload(); await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 }); await expect(page.locator('input[value="QA GPR A"]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gpr_reports_qa-org-b')||'[]'))).toEqual([]);
  await page.evaluate(async () => { const {setOrgId}=await import('/src/utils/orgId.js');setOrgId('default'); });
  await expect(page.locator('input[value="QA GPR A"]')).toBeVisible();
});

test('GPR failed save retains the editable recovery draft and refuses close', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => { const {blankGprReport}=await import('/src/modules/gprReport/gprReportConstants.js');localStorage.setItem('gpr_reports_default',JSON.stringify([blankGprReport({id:'gpr-fail',title:'QA GPR original',ref:'GPR-FAIL'})])); });
  await page.goto('/app?view=gpr-report', { waitUntil: 'domcontentloaded' });await page.getByText('QA GPR original',{exact:true}).click();
  await page.evaluate(() => { const original=Storage.prototype.setItem;window.qaRestoreStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='gpr_reports_default')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);}; });
  await page.locator('input[value="QA GPR original"]').fill('QA GPR recovered');await page.getByRole('button',{name:'Save report',exact:true}).click();
  await expect(page.getByText('GPR report stays open.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('input[value="QA GPR recovered"]')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gpr_reports_default'))[0].title)).toBe('QA GPR original');
  await page.evaluate(()=>window.qaRestoreStorage());await page.getByRole('button',{name:'Save report',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gpr_reports_default'))[0].title)).toBe('QA GPR recovered');
});

test('drawing export reference does not follow another organisation', async ({ page }) => {
  await seed(page);await page.evaluate(()=>sessionStorage.setItem('pde_onboarding_v1','1'));
  await page.goto('/app?view=project-drawings', { waitUntil: 'domcontentloaded' });await page.getByText('Import & export',{exact:true}).click();await page.getByPlaceholder('optional — added to exports').fill('QA private A permit');
  await page.evaluate(async()=>{const {setOrgId}=await import('/src/utils/orgId.js');setOrgId('qa-org-b');});
  await page.reload();await page.getByText('Import & export',{exact:true}).click();await expect(page.getByPlaceholder('optional — added to exports')).toHaveValue('');
  await page.evaluate(async()=>{const {setOrgId}=await import('/src/utils/orgId.js');setOrgId('default');});
  await page.getByText('Import & export',{exact:true}).click();await expect(page.getByPlaceholder('optional — added to exports')).toHaveValue('QA private A permit');
});

test('legacy unowned AI prefill is not adopted into another company', async ({ page }) => {
  await seed(page);await page.evaluate(async()=>{sessionStorage.setItem('mysafeops_ai_rams_prefill',JSON.stringify({title:'QA private AI content A',hazards:[]}));const {setOrgId}=await import('/src/utils/orgId.js');setOrgId('qa-org-b');});
  await page.goto('/app?view=rams', { waitUntil: 'domcontentloaded' });await page.getByRole('button',{name:'+ Blank RAMS',exact:true}).click();await expect(page.locator('input[value="QA private AI content A"]')).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('mysafeops_ai_rams_prefill'))).toContain('QA private AI content A');
});
