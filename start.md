After signin user lands on patient module: 
locator: page.locator(':text-is("Patient")')

Click :page.getByText('Patient List')

Cick Add artient: page.getByRole('button', { name: /Add Patient/i })

Verify patient registration modal opens:
page.getByText('Patient Registration', { exact: true })

We need to enter patient firstname here: await page.getByRole('textbox', { name: 'First Name *' })
// we need t generate a random first name with refix QA [exampe: QA Jack]

//Enter last name as a 4 digit unique code:
page.getByRole('textbox', { name: /Last Name/i })

// Enter mbie number we need t enter 10 digit unique mdule number always start with 9:
await page.getByRole('textbox', { name: /Mobile number \*/i })

// CLick on register patient button:
await page.getByRole('button', { name: /Register Patient/i })

// confirm registration modal is opened:
page.getByRole('heading', { name: /Confirm registration/i })

// Click on register patient button:
page.locator('button').filter({ hasText: 'Register Patient' }).first()

// We need to confirm that paitent is added by checking the firstname+lastname is displayed in atient ist:
xpath = //span[normalize-space()='selectorshub selectorshub']




