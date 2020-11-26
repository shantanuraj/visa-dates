const fs = require('fs')
const puppeteer = require('puppeteer')
const express = require('express')

const resultFile = `${__dirname}/result.json`
const embassyURL = `https://www.vfsvisaonline.com/Netherlands-Global-Online-Appointment_Zone1/AppScheduling/AppWelcome.aspx?P=c%2f75XIhVUvxD%2bgDk%2bH%2bCGBV5n9rG51cpAkEXPymduoQ%3d`;
// 10 minutes
const refreshDelta = 600000

const getResult = () => {
  if (!fs.existsSync(resultFile)) return null
  const data = fs.readFileSync(resultFile, 'utf-8')
  return JSON.parse(data)
}

const saveResult = async (result) => {
  return new Promise((resolve) => {
    fs.writeFile(resultFile, JSON.stringify({
      result,
      lastCheck: Date.now(),
    }, undefined, 2), 'utf-8', resolve)
  })
}

const getSchedule = async () => {
  const browser = await puppeteer.launch()
  const [page] = await browser.pages()
  await page.goto(embassyURL)

  // Click appointment link
  await page.evaluate(() => document.getElementById('DIV1').querySelector('a').click())

  // Wait for navigation
  await page.waitForNavigation()

  await page.evaluate(() => {
    // Select New Delhi consulate
    document.querySelector('select').value = '26'
    // Submit
    document.querySelector('input[type="submit"]').click()
  })

  // Wait for navigation
  await page.waitForNavigation()

  // Select category
  await page.evaluate(() => {
    // Select MVV category
    document.querySelector('select').value = '943'
    // Submit
    document.querySelector('input[type="submit"]').click()
  })

  // Wait for navigation
  await page.waitForNavigation()

  // Fill contact info
  await page.evaluate(() => {
    const [
      title,
      name,
      lastName,
      phone,
      email
    ] = [...document.querySelector('select').closest('tr').children].map(e => e.firstElementChild)

    title.value = title.options[1].value
    name.value = 'Not'
    lastName.value = 'Will'
    phone.value = '9316905555'
    email.value = 'will@example.com'

    const confirmation = document.getElementById('plhMain_cboConfirmation')
    confirmation.value = confirmation.options[1].value

    document.querySelector('input[type="submit"]').click()
  })

  // Wait for navigation
  await page.waitForNavigation()

  await page.screenshot({path: 'public/schedule.png'})

  const result = await page.evaluate(() => {
    const monthYear = document.querySelector('#plhMain_cldAppointment > tbody > tr:nth-child(1) > td > table > tbody > tr').children[1].textContent
    const date = document.querySelector('.OpenDateAllocated').textContent
    return `${date} ${monthYear}`
  })

  await browser.close()

  console.log('Earliest appointment date is', result)

  await saveResult(result)

  return result
}

let scheduleCheck = null

const handler = async (_, res) => {
  const lastResult = getResult()
  let date
  if (!lastResult || (Date.now() - lastResult.lastCheck) >= refreshDelta) {
    scheduleCheck = scheduleCheck || getSchedule()
    date = await scheduleCheck
    scheduleCheck = null
  } else {
    console.log('Reusing last result')
    date = lastResult.result
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <meta property="og:title" content="${date}" />
      <meta property="og:url" content="https://visa.sixth.io" />
      <meta property="og:image" content="https://visa.sixth.io/schedule.png" />

      <title>📅 ${date}</title>
      <style>
        html, body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          height: 100vh;
        }
        h1 {
          font-weight: 400;
          margin: 0;
          padding: 0 16px;
          text-align: center;
        }
        main {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-evenly;
          height: 100%;
        }
        img {
          max-width: 100%;
        }
      </style>
    </head>
    <body>
      <main>
        <img src="schedule.png" alt="Appointment calendar">
        <h1>Earliest appointment date is ${date}</h1>
      </main>
    </body>
    </html>
  `)
}

const app = express()
app.use(express.static('public'))
app.get('/', handler)
app.listen(6969, () => {
  console.log(`App listening at http://localhost:6969`)
})
